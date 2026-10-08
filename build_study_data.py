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

ENGINE_VERSION = "v5-2026-10-08"
CFG = dict(target_coverage=0.95, max_passes=3, topk_per_oov=12, max_per_sent=3, max_edits_per_pass=40,
           sim_floor=0.65, temperature=0.2, use_mwe=True, mwe_max_words=4, use_ctx=True, keep=6,
           w_sim=0.35, w_freq=0.20, w_pos=0.10, w_ctx=0.35, cos_floor=0.45,
           use_key_terms=True, key_term_min_count=4, key_term_pos=["NOUN"])

def config_id(cfg):   # identical to the backend's config_hash
    return hashlib.sha256(json.dumps({"v": ENGINE_VERSION, **cfg}, sort_keys=True).encode()).hexdigest()[:12]

def parse_list(s, num=float):
    out = []
    for part in str(s).split("; "):
        m = re.match(r"^(.*?) \(([\d.]+)\)$", part.strip())
        if m:
            out.append((m.group(1), num(m.group(2))))
    return out

def build(run_csvs, transcripts_xlsx, out_dir):
    meta = pd.read_excel(transcripts_xlsx)
    talks = []
    for i, r in meta.iterrows():
        first = re.split(r"(?<=[.!?])\s+", str(r.transcript_text).strip())[0]
        talks.append({"id": r.talk_id, "number": i + 1, "title": "",   # TODO: add titles from the corpus appendix
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
                final = str(r.rag_final)
                mwes = [p for p in str(r.mwes).split("; ") if p and p != "nan"]
                item = {
                    "talk_id": t["id"],
                    "original": str(r.original),
                    "simplified": final,
                    "coverage": round(float(r.coverage_final), 4),
                    "level": level,
                    "coverage_key_terms_known": round(float(r.coverage_targets_known), 4),
                    "key_terms": [{"word": w, "count": int(c)} for w, c in parse_list(r.targets, int)] if use_kt else [],
                    "kept_words": sorted(w for w, _ in parse_list(r.floor_words)),
                    "protected_phrases": sorted({p for p in mwes if p.lower() in final.lower()}, key=str.lower),
                    "stats": {"accepted": int(r.n_accepted), "vetoed": int(r.n_vetoed),
                              "key_term_tokens": int(r.n_target_tokens), "kept_word_tokens": int(r.n_floor_tokens),
                              "original_words": len(re.findall(r"[A-Za-z]+", str(r.original))),
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

if __name__ == "__main__":
    up = sys.argv[1]
    m = build({
        "key_terms_on":  {"1k": (f"{up}/bdc903a8-rag_results_v5_floor_targets.csv", "v5_floor_targets"),
                          "2k": (f"{up}/9e9664dd-rag_results_v5_floor_targets_2k.csv", "v5_floor_targets_2k"),
                          "3k": (f"{up}/rag_results_v5_floor_targets_3k.csv", "v5_floor_targets_3k")},
        "key_terms_off": {"1k": (f"{up}/0e760126-rag_results_v5_floor.csv", "v5_floor"),
                          "2k": (f"{up}/6e18ff68-rag_results_v5_floor_2k.csv", "v5_floor_2k"),
                          "3k": (f"{up}/rag_results_v5_floor_3k.csv", "v5_floor_3k")},
    }, f"{up}/ecfa06c6-ted_transcripts_1.xlsx", sys.argv[2])
    print(json.dumps({k: v for k, v in m.items() if k != "talks"}, indent=1))
    print(len(m["talks"]), "talks")
