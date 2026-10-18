"""
Build static study data for LingoEase from the final paper runs.

Output (copy the `study/` folder into the Next.js `public/` folder, or upload it to Vercel Blob):
  study/manifest.json                         talks, levels, variants, provenance
  study/<variant>/<level>/<talk_id>.json      one result per talk, same shape as POST /simplify

Final configuration (v8b): one variant, key_terms_on (runs v8b_floor_targets, v8b_floor_targets_2k).
  usage: python build_study_data.py <folder with run CSVs> public/study v8b
Older generations (v5/v6/v7) also had key_terms_off.

v8b runs add the substitution check: words whose proposed swap the check rejected (`check_kept`) are listed with
the kept words ("Words with no simple equivalent"), as the pipeline highlights them.

v7 runs also carry highlight spans (`spans`, `original_spans`: start/end/text/type, computed by the pipeline with
the same word lists it used), so the frontend highlights exactly what the pipeline counted as outside the list.
"""
import json, os, re, sys, datetime, hashlib
import pandas as pd

ENGINE_VERSION = os.environ.get("ENGINE_VERSION", "v5-2026-10-08")
CFG = dict(target_coverage=0.95, max_passes=3, topk_per_oov=12, max_per_sent=3, max_edits_per_pass=40,
           sim_floor=0.65, temperature=0.2, use_mwe=True, mwe_max_words=4, use_ctx=True, keep=6,
           w_sim=0.35, w_freq=0.20, w_pos=0.10, w_ctx=0.35, cos_floor=0.45,
           use_key_terms=True, key_term_min_count=4, key_term_pos=["NOUN"])

def config_id(cfg):   # identical to the backend's config_hash
    return hashlib.sha256(json.dumps({"v": ENGINE_VERSION, **cfg}, sort_keys=True).encode()).hexdigest()[:12]

_NLP = None
def nlp():
    global _NLP
    if _NLP is None:
        import spacy
        _NLP = spacy.load("en_core_web_sm")
    return _NLP

def surface_labels(lemmas, *texts):
    """Display label per lemma: the base form if it appears in the text, else its most frequent form
    (e.g. 'datum' -> 'data'). Same rule as the backend."""
    from collections import Counter, defaultdict
    want, labels = set(lemmas), {}
    for t in texts:
        forms = defaultdict(Counter)
        for tok in nlp()(str(t)):
            l = tok.lemma_.lower()
            if l in want and l not in labels and tok.is_alpha:
                forms[l][tok.text.lower()] += 1
        for l, c in forms.items():
            labels[l] = l if l in c else c.most_common(1)[0][0]
    return {l: labels.get(l, l) for l in want}

CUES = re.compile(r"\([^()]{0,40}\)|\[[^\[\]]{0,40}\]|♪+")
def clean_transcript(t):
    t = re.sub(r"^\s*Transcriber:.*?Reviewer:\s*\S+(?:\s+\S+)?\s+", "", str(t), flags=re.S)
    t = re.sub(r"^\s*Transcriber:\s*", "", t)   # some talks have the label but no Reviewer credit
    return re.sub(r"\s+", " ", CUES.sub(" ", t)).strip()

def clean_simplified(t):
    """The LLM sometimes emits markdown emphasis (**word**); the study text is plain prose."""
    t = re.sub(r"\*+", "", str(t))
    assert "*" not in t
    return t

def parse_list(s, num=float):
    out = []
    for part in str(s).split("; "):
        m = re.match(r"^(.*?) \(([\d.]+)\)$", part.strip())
        if m:
            out.append((m.group(1), num(m.group(2))))
    return out

def load_spans(raw, text, where):
    """Spans saved by the pipeline; every offset must point at its own text in `text`."""
    spans = json.loads(raw)
    for s in spans:
        assert text[s["start"]:s["end"]] == s["text"], f"{where}: span {s} does not match the text"
        assert s["type"] in SPAN_TYPES, f"{where}: unknown span type {s['type']}"
    return spans

SPAN_TYPES = ("mwe", "proper_noun", "key_term", "kept_word", "oov")

# The Original tab marks every word outside the level's word list in one style, word by word (no MWE grouping,
# no categories). With WORDLIST_DIR set (folder with nation_<level>.words.json from the embeddings run), the
# original's spans are recomputed that way with the same family-aware check as the pipeline's coverage.
_FAMS = {}
def level_forms(level):
    if level not in _FAMS:
        d = os.environ.get("WORDLIST_DIR")
        if not d:
            _FAMS[level] = None
        else:
            with open(os.path.join(d, f"nation_{level}.words.json"), encoding="utf-8") as f:
                fams = json.load(f)["families"]
            forms = {fm for fd in fams.values() for fm in fd["forms"]}
            _FAMS[level] = (set(fams), forms)
    return _FAMS[level]

def offlist_spans(text, level):
    """Every alphabetic token not covered by the list (same test as the pipeline's lexical_coverage)."""
    heads, forms = level_forms(level)
    out = []
    for t in nlp()(text):
        if not t.is_alpha:
            continue
        s, l = t.text.lower(), t.lemma_.lower()
        if s in forms or l in heads or l in forms:
            continue
        out.append({"start": t.idx, "end": t.idx + len(t.text), "text": t.text, "type": "oov"})
    return out

# Teacher-study subset (v8b): the 3 best and 3 worst talks on the 1k coverage + meaning ranking
# (mean of the 1k coverage-with-key-terms rank and the 1k SBERT F1 rank; ties by the same at 2k), in rank order.
STUDY_TALKS_V8B = [
    "ZmNpeXTj2c4",   # rank 1  — Story in 60 seconds
    "8_zk2DpgLCs",   # rank 2  — Plane crash
    "t0kACis_dJE",   # rank 3  — Better sleep
    "rSQNi5sAwuc",   # rank 18 — Control someone's arm
    "HYepzb4-FWI",   # rank 19 — Frustration into creative success
    "XqUOgqlZ8bc",   # rank 20 — Mysterious design
]

def build(run_csvs, transcripts_xlsx, out_dir, talk_ids=None):
    """talk_ids: optional list of talk ids; only these are built, in this order, numbered 1..n
    (the corpus number is kept as `corpus_number`)."""
    meta = pd.read_excel(transcripts_xlsx)
    titles = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "titles.json"), encoding="utf-8"))
    talks = []
    for i, r in meta.iterrows():
        first = re.split(r"(?<=[.!?])\s+", clean_transcript(r.transcript_text))[0]
        title, speaker = titles.get(r.talk_id, ["", ""])
        talks.append({"id": r.talk_id, "number": i + 1, "corpus_number": i + 1, "title": title, "speaker": speaker,
                      "source_url": r.source_url, "preview": first[:120]})
    if talk_ids:
        by_id = {t["id"]: t for t in talks}
        missing = [t for t in talk_ids if t not in by_id]
        assert not missing, f"talk ids not in the corpus: {missing}"
        talks = [dict(by_id[t], number=k) for k, t in enumerate(talk_ids, 1)]
    variants, checks = {}, []
    for variant, levels in run_csvs.items():
        use_kt = variant == "key_terms_on"
        cid = config_id({**CFG, "use_key_terms": use_kt})
        variants[variant] = {"config_id": cid, "levels": {}}
        for level, (path, run_tag) in levels.items():
            if not os.path.exists(path):
                print(f"  skip {variant}/{level}: {path} not found")
                continue
            d = pd.read_csv(path).set_index("talk_id")
            variants[variant]["levels"][level] = run_tag
            os.makedirs(f"{out_dir}/{variant}/{level}", exist_ok=True)
            for t in talks:
                r = d.loc[t["id"]]
                final = clean_simplified(r.rag_final)
                v7 = "spans_final" in r.index
                if v7:
                    assert final == str(r.rag_final), f"{t['id']}: v7 output should already be clean"
                original = str(r.original_clean) if v7 else clean_transcript(r.original)
                mwes = [p for p in str(r.mwes).split("; ") if p and p != "nan"]
                kt = parse_list(r.targets, int) if use_kt else []
                kw = [w for w, _ in parse_list(r.floor_words)]
                if "check_kept" in r.index:                       # v8b: swap rejected by the check -> word kept
                    kw += [w for w in str(r.check_kept).split("; ") if w and w != "nan"]
                lab = surface_labels({w for w, _ in kt} | set(kw), final, str(r.baseline))
                item = {
                    "talk_id": t["id"],
                    "original": original,   # credits and (Laughter)-type cues removed
                    "simplified": final,
                    "coverage": round(float(r.coverage_final), 4),
                    "level": level,
                    "coverage_key_terms_known": round(float(r.coverage_targets_known), 4),
                    "key_terms": [{"word": lab[w], "count": int(c)} for w, c in kt],
                    "kept_words": sorted({lab[w] for w in kw}),
                    "protected_phrases": ([p for p in str(r.protected_phrases).split("; ") if p and p != "nan"] if v7
                                          else sorted({p for p in mwes if p.lower() in final.lower()}, key=str.lower)),
                    "stats": {"accepted": int(r.n_accepted), "vetoed": int(r.n_vetoed),
                              "key_term_tokens": int(r.n_target_tokens), "kept_word_tokens": int(r.n_floor_tokens),
                              "original_words": len(re.findall(r"[A-Za-z]+", original)),
                              "simplified_words": len(re.findall(r"[A-Za-z]+", final))},
                    "engine_version": ENGINE_VERSION,
                    "config_id": cid,
                    "run": run_tag,
                    "cached": True,
                }
                if v7:
                    where = f"{variant}/{level}/{t['id']}"
                    item["spans"] = load_spans(r.spans_final, final, where)
                    item["original_spans"] = (offlist_spans(original, level) if level_forms(level)
                                              else load_spans(r.spans_original, original, where + " (original)"))
                    item["stats"]["passes"] = int(r.n_passes)
                    if "n_subs_checked" in r.index:
                        item["stats"].update(subs_checked=int(r.n_subs_checked), subs_rejected=int(r.n_subs_rejected),
                                             check_kept_types=int(r.n_check_kept_types))
                    for k in SPAN_TYPES:
                        item["stats"][f"span_{k}"] = sum(1 for s in item["spans"] if s["type"] == k)
                checks.append({"variant": variant, "level": level, "talk_id": t["id"],
                               "accepted": int(r.n_accepted), "passes": int(r.n_passes) if v7 else None})
                with open(f"{out_dir}/{variant}/{level}/{t['id']}.json", "w", encoding="utf-8") as f:
                    json.dump(item, f, ensure_ascii=False, indent=1)
    manifest = {"engine_version": ENGINE_VERSION, "generated": datetime.date.today().isoformat(),
                "level_labels": {"1k": "Elementary", "2k": "Pre-Intermediate", "3k": "Intermediate"},
                "variants": variants, "talks": talks}
    with open(f"{out_dir}/manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    # A talk with no accepted substitution shows the baseline only (v6: 4/20 talks at 2k).
    ck = pd.DataFrame(checks)
    if len(ck):
        for (v, lv), g in ck.groupby(["variant", "level"], sort=False):
            zero = list(g.talk_id[g.accepted == 0])
            print(f"  {v}/{lv}: {len(zero)}/{len(g)} talks with 0 accepted substitutions" + (f" -> {zero}" if zero else ""))
    return manifest

def _cli():
    # usage: python build_study_data.py <folder with run CSVs> <out dir> [v5|v6|v7|v8b]
    global ENGINE_VERSION
    up, out = sys.argv[1], sys.argv[2]
    gen = sys.argv[3] if len(sys.argv) > 3 else "v5"
    if gen == "v5":
        runs = {
            "key_terms_on":  {"1k": (f"{up}/bdc903a8-rag_results_v5_floor_targets.csv", "v5_floor_targets"),
                              "2k": (f"{up}/9e9664dd-rag_results_v5_floor_targets_2k.csv", "v5_floor_targets_2k"),
                              "3k": (f"{up}/rag_results_v5_floor_targets_3k.csv", "v5_floor_targets_3k")},
            "key_terms_off": {"1k": (f"{up}/0e760126-rag_results_v5_floor.csv", "v5_floor"),
                              "2k": (f"{up}/6e18ff68-rag_results_v5_floor_2k.csv", "v5_floor_2k"),
                              "3k": (f"{up}/rag_results_v5_floor_3k.csv", "v5_floor_3k")},
        }
    else:
        # must mirror the backend's ENGINE_VERSION and CFG exactly (config ids)
        ENGINE_VERSION = {"v6": "v6-2026-10-09", "v7": "v7-2026-10-17", "v8b": "v8b-2026-10-18"}[gen]
        CFG.update(baseline="keep_all", baseline_mode=os.environ.get("BASELINE_MODE", "C"), chunk_sents=8)
        if gen == "v7":
            CFG.update(min_passes=1, mwe_prompt="v7", lists="v4")
        if gen == "v8b":
            CFG.update(min_passes=1, mwe_prompt="v7b", lists="v4", max_passes=1, key_term_min_count=3,
                       sub_pos=["NOUN", "VERB", "ADJ", "ADV"], verify_subs=True, check_memory=True, verify_prompt="v8")
        variants = (("key_terms_on", "floor_targets"),) if gen == "v8b" else \
                   (("key_terms_on", "floor_targets"), ("key_terms_off", "floor"))
        runs = {v: {lv: (f"{up}/rag_results_{gen}_{tag}{'' if lv == '1k' else '_' + lv}.csv",
                         f"{gen}_{tag}{'' if lv == '1k' else '_' + lv}") for lv in ("1k", "2k", "3k")}
                for v, tag in variants}
    xlsx = f"{up}/ecfa06c6-ted_transcripts_1.xlsx"
    if not os.path.exists(xlsx):
        xlsx = f"{up}/ted transcripts.xlsx"
    sel = os.environ.get("STUDY_TALKS")              # comma-separated ids, or "all"; v8b default: STUDY_TALKS_V8B
    talk_ids = (None if sel == "all" else sel.split(",") if sel else STUDY_TALKS_V8B if gen == "v8b" else None)
    m = build(runs, xlsx, out, talk_ids)
    print(json.dumps({k: v for k, v in m.items() if k != "talks"}, indent=1))
    print(len(m["talks"]), "talks")


if __name__ == "__main__":
    _cli()
