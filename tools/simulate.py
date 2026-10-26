"""
Tạo dữ liệu giả lập để kiểm tra tools/calibrate.py.
Người làm bài có tuổi ngẫu nhiên, năng lực θ ~ N(μ(tuổi), 1) theo chuẩn tuổi mặc định,
trả lời theo mô hình 3PL với tham số "thật" (mặc định là tham số trong js/questions.js).

    python tools/simulate.py --n 2000 --out data/simulated.jsonl
    python tools/calibrate.py --input data/simulated.jsonl --output js/params.sim.js
"""
import argparse
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from calibrate import load_bank, prob  # noqa: E402

AGE_NORMS = [(10, -1.6), (12, -1.1), (14, -0.65), (16, -0.3), (18, -0.1), (20, 0), (34, 0),
             (45, -0.15), (55, -0.35), (65, -0.65), (75, -1.0), (90, -1.5)]


def age_mean(age):
    for (x0, y0), (x1, y1) in zip(AGE_NORMS, AGE_NORMS[1:]):
        if age <= x1:
            return y0 + (age - x0) / (x1 - x0) * (y1 - y0)
    return AGE_NORMS[-1][1]


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=2000)
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--perturb", type=float, default=0.5, help="độ lệch ngẫu nhiên của b thật so với b trong questions.js")
    args = ap.parse_args()

    rnd = random.Random(args.seed)
    bank = load_bank()
    truth = {it["id"]: (it["a"] * rnd.uniform(0.7, 1.3), it["b"] + rnd.gauss(0, args.perturb), 1 / it["k"]) for it in bank["items"]}
    with open(args.out, "w", encoding="utf-8") as f:
        for _ in range(args.n):
            age = rnd.choice([rnd.randint(10, 19), rnd.randint(18, 40), rnd.randint(18, 40), rnd.randint(40, 80)])
            theta = rnd.gauss(age_mean(age), 1)
            resp = {}
            for qid, (a, b, c) in truth.items():
                resp[qid] = None if rnd.random() < 0.03 else int(rnd.random() < prob(a, b, c, theta))
            f.write(json.dumps({"bank": bank["bank"], "age": age, "attempt": 1, "elapsed": rnd.randint(300, 2100),
                                "timeLimit": 2100, "responses": resp, "choices": {}}) + "\n")
    with open(args.out + ".truth.json", "w", encoding="utf-8") as f:
        json.dump({k: {"a": v[0], "b": v[1]} for k, v in truth.items()}, f, indent=1)
    print(f"Đã tạo {args.n} bài giả lập → {args.out} (tham số thật: {args.out}.truth.json)")


if __name__ == "__main__":
    main()
