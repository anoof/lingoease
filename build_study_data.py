"""
Build static study data for LingoEase from the final paper runs.

Output (copy the `study/` folder into the Next.js `public/` folder, or upload it to Vercel Blob):
  study/manifest.json                         talks, levels, variants, provenance
  study/<variant>/<level>/<talk_id>.json      one result per talk, same shape as POST /simplify

Variants: key_terms_on  = floor 0.45 + key terms   (runs v5_floor_targets, v5_floor_targets_2k)
          key_terms_off = floor 0.45 only           (runs v5_floor, v5_floor_2k)
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

def build(run_csvs, transcripts_xlsx, out_dir):
    meta = pd.read_excel(transcripts_xlsx)
    titles = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "titles.json"), encoding="utf-8"))
    talks = []
    for i, r in meta.iterrows():
        first = re.split(r"(?<=[.!?])\s+", clean_transcript(r.transcript_text))[0]
        title, speaker = titles.get(r.talk_id, ["", ""])
        talks.append({"id": r.talk_id, "number": i + 1, "title": title, "speaker": speaker,
                      "source_url": r.source_url, "preview": first[:120]})
    variants = {}
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
                mwes = [p for p in str(r.mwes).split("; ") if p and p != "nan"]
                kt = parse_list(r.targets, int) if use_kt else []
                kw = [w for w, _ in parse_list(r.floor_words)]
                lab = surface_labels({w for w, _ in kt} | set(kw), final, str(r.baseline))
                item = {
                    "talk_id": t["id"],
                    "original": clean_transcript(r.original),   # credits and (Laughter)-type cues removed
                    "simplified": final,
                    "coverage": round(float(r.coverage_final), 4),
                    "level": level,
                    "coverage_key_terms_known": round(float(r.coverage_targets_known), 4),
                    "key_terms": [{"word": lab[w], "count": int(c)} for w, c in kt],
                    "kept_words": sorted({lab[w] for w in kw}),
                    "protected_phrases": sorted({p for p in mwes if p.lower() in final.lower()}, key=str.lower),
                    "stats": {"accepted": int(r.n_accepted), "vetoed": int(r.n_vetoed),
                              "key_term_tokens": int(r.n_target_tokens), "kept_word_tokens": int(r.n_floor_tokens),
                              "original_words": len(re.findall(r"[A-Za-z]+", clean_transcript(r.original))),
                              "simplified_words": len(re.findall(r"[A-Za-z]+", final))},
                    "engine_version": ENGINE_VERSION,
                    "config_id": cid,
                    "run": run_tag,
                    "cached": True,
                }
                with open(f"{out_dir}/{variant}/{level}/{t['id']}.json", "w", encoding="utf-8") as f:
                    json.dump(item, f, ensure_ascii=False, indent=1)
    manifest = {"engine_version": ENGINE_VERSION, "generated": datetime.date.today().isoformat(),
                "level_labels": {"1k": "Elementary", "2k": "Pre-Intermediate", "3k": "Intermediate"},
                "variants": variants, "talks": talks}
    with open(f"{out_dir}/manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    return manifest

def _cli():
    # usage: python build_study_data.py <folder with run CSVs> <out dir> [v5|v6]
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
        ENGINE_VERSION = "v6-2026-10-09"      # must mirror backend_v6/main.py exactly (config ids)
        CFG.update(baseline="keep_all", baseline_mode=os.environ.get("BASELINE_MODE", "C"), chunk_sents=8)
        runs = {v: {lv: (f"{up}/rag_results_{gen}_{tag}{'' if lv == '1k' else '_' + lv}.csv",
                         f"{gen}_{tag}{'' if lv == '1k' else '_' + lv}") for lv in ("1k", "2k", "3k")}
                for v, tag in (("key_terms_on", "floor_targets"), ("key_terms_off", "floor"))}
    xlsx = f"{up}/ecfa06c6-ted_transcripts_1.xlsx"
    if not os.path.exists(xlsx):
        xlsx = f"{up}/ted transcripts.xlsx"
    m = build(runs, xlsx, out)
    print(json.dumps({k: v for k, v in m.items() if k != "talks"}, indent=1))
    print(len(m["talks"]), "talks")


if __name__ == "__main__":
    _cli()
