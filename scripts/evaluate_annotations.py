"""Compare manual and model 2D shoulder-elbow-wrist angles in identical image coordinates."""
import argparse
import json
import math
from pathlib import Path


def angle(a, b, c):
    u, v = (a["x"] - b["x"], a["y"] - b["y"]), (c["x"] - b["x"], c["y"] - b["y"])
    norm = math.hypot(*u) * math.hypot(*v)
    if not math.isfinite(norm) or norm == 0:
        raise ValueError("Invalid or coincident points")
    return math.degrees(math.acos(max(-1, min(1, (u[0] * v[0] + u[1] * v[1]) / norm))))


def evaluate(records):
    rows, skipped = [], []
    for record in records:
        for side, ids in [("left", (11, 13, 15)), ("right", (12, 14, 16))]:
            manual = record.get("manual_keypoints", {})
            model = {str(p["id"]): p for p in record.get("model_keypoints", [])}
            keys = [str(i) for i in ids]
            if not record.get("annotator") or any(k not in manual or k not in model for k in keys):
                skipped.append({"image": record.get("image"), "side": side, "reason": "Missing manual points, model points or annotator"}); continue
            if any(model[k].get("visibility", 0) < 0.5 for k in keys):
                skipped.append({"image": record.get("image"), "side": side, "reason": "Low visibility"}); continue
            try:
                truth, predicted = angle(*(manual[k] for k in keys)), angle(*(model[k] for k in keys))
                rows.append({"image": record.get("image"), "side": side, "manual_degrees": truth, "model_degrees": predicted, "absolute_error": abs(predicted - truth)})
            except (ValueError, TypeError, KeyError) as error:
                skipped.append({"image": record.get("image"), "side": side, "reason": str(error)})
    return {"count": len(rows), "mae_degrees": sum(r["absolute_error"] for r in rows) / len(rows) if rows else None, "rows": rows, "skipped": skipped}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("annotations", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = evaluate(json.loads(args.annotations.read_text(encoding="utf-8-sig")))
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
    print(f"Valid comparisons: {result['count']}; MAE: {result['mae_degrees']} (None means no measured result)")
