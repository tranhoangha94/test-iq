"""
Chuẩn hoá lại tham số IRT và chuẩn tuổi từ kết quả ẩn danh đã thu thập.

    python tools/calibrate.py                      # đọc data/results.jsonl, ghi js/params.js
    python tools/calibrate.py --dry-run            # chỉ in báo cáo, không ghi file
    python tools/calibrate.py --input other.jsonl --min-sample 100 --force

Phương pháp
  1. Lọc dữ liệu: đúng phiên bản ngân hàng câu hỏi, chỉ lần làm đầu tiên (tránh hiệu ứng luyện tập),
     làm bài ít nhất 60 giây, trả lời ít nhất 5 câu.
  2. Ước lượng a, b của từng câu bằng Marginal Maximum Likelihood – EM (Bock & Aitkin, 1981),
     mô hình 3PL với c = 1/số phương án cố định, kèm tiên nghiệm nhẹ cho a, b (Bayes modal). Câu bỏ trống được coi là "chưa tới" (dữ liệu khuyết).
  3. Tính θ (EAP) cho từng người, rồi neo thang đo vào nhóm tham chiếu 20–34 tuổi
     (trung bình 0, độ lệch chuẩn 1) — giống cách WAIS chuẩn hoá theo nhóm tuổi.
  4. Chuẩn tuổi μ(tuổi) = năng lực trung bình của từng nhóm tuổi trên thang đã neo,
     có hiệu chỉnh hiện tượng co về trung bình (shrinkage) của EAP.
Cần Node.js để đọc js/questions.js.
"""
import argparse
import json
import math
import os
import subprocess
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUAD = [-4 + 8 * i / 60 for i in range(61)]
LOG_PRIOR = [-t * t / 2 for t in QUAD]
AGE_BINS = [(10, 11), (12, 13), (14, 15), (16, 17), (18, 19), (20, 24), (25, 29), (30, 34),
            (35, 44), (45, 54), (55, 64), (65, 74), (75, 90)]
REF_AGES = (20, 34)
A_RANGE, B_RANGE = (0.3, 3.5), (-4.5, 4.5)
# Tiên nghiệm nhẹ (Bayes modal, như BILOG-MG): ln a ~ N(ln 1.4, 0.4²), b ~ N(0, 2²)
# giúp câu rất khó / rất dễ không bị ước lượng trôi khi dữ liệu ít thông tin
LN_A_MU, LN_A_SD, B_SD = math.log(1.4), 0.4, 2.0


def load_bank():
    js = (
        "global.window={};require(process.argv[1]);"
        "console.log(JSON.stringify({bank:window.QUESTION_BANK_VERSION,items:window.QUESTIONS.map(q=>("
        "{id:q.id,domain:q.domain,a:q.a,b:q.b,k:q.type==='matrix'?q.distractors.length+1:q.options.length}))}))"
    )
    try:
        out = subprocess.run(["node", "-e", js, os.path.join(ROOT, "js", "questions.js")],
                             capture_output=True, text=True, check=True, encoding="utf-8").stdout
    except FileNotFoundError:
        sys.exit("Cần cài Node.js để đọc js/questions.js")
    return json.loads(out)


def load_records(path, bank, item_ids, min_elapsed, include_repeats):
    rows, skipped = [], {"bank": 0, "repeat": 0, "short": 0, "few": 0, "bad": 0}
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                skipped["bad"] += 1
                continue
            if r.get("bank") != bank:
                skipped["bank"] += 1
            elif r.get("attempt", 1) > 1 and not include_repeats:
                skipped["repeat"] += 1
            elif r.get("elapsed", 0) < min_elapsed:
                skipped["short"] += 1
            else:
                resp = [r["responses"].get(i) for i in item_ids]
                if sum(x is not None for x in resp) < 5:
                    skipped["few"] += 1
                else:
                    rows.append((r["age"], resp))
    return rows, skipped


def prob(a, b, c, t):
    return c + (1 - c) / (1 + math.exp(-a * (t - b)))


def log_tables(items):
    lp, lq = [], []
    for it in items:
        ps = [min(max(prob(it["a"], it["b"], it["c"], t), 1e-9), 1 - 1e-9) for t in QUAD]
        lp.append([math.log(p) for p in ps])
        lq.append([math.log(1 - p) for p in ps])
    return lp, lq


def posterior(resp, lp, lq):
    logw = LOG_PRIOR[:]
    for i, x in enumerate(resp):
        if x is None:
            continue
        tab = lp[i] if x else lq[i]
        for q in range(len(QUAD)):
            logw[q] += tab[q]
    m = max(logw)
    w = [math.exp(v - m) for v in logw]
    s = sum(w)
    return [v / s for v in w]


def m_step(it, n_q, r_q, iters=8):
    """Fisher scoring cho (a, b) của 1 câu, c cố định, có tiên nghiệm."""
    a, b, c = it["a"], it["b"], it["c"]
    for _ in range(iters):
        ga = gb = iaa = iab = ibb = 0.0
        for q, t in enumerate(QUAD):
            n = n_q[q]
            if n < 1e-12:
                continue
            s = 1 / (1 + math.exp(-a * (t - b)))
            p = min(max(c + (1 - c) * s, 1e-9), 1 - 1e-9)
            k = (1 - c) * s * (1 - s)
            da, db = k * (t - b), -k * a
            g = (r_q[q] - n * p) / (p * (1 - p))
            info = n / (p * (1 - p))
            ga += g * da
            gb += g * db
            iaa += info * da * da
            iab += info * da * db
            ibb += info * db * db
        ga -= (math.log(a) - LN_A_MU) / (LN_A_SD ** 2 * a)
        iaa += 1 / (LN_A_SD ** 2 * a * a)
        gb -= b / B_SD ** 2
        ibb += 1 / B_SD ** 2
        det = iaa * ibb - iab * iab
        if det <= 1e-12:
            break
        step_a = (ibb * ga - iab * gb) / det
        step_b = (iaa * gb - iab * ga) / det
        a = min(max(a + max(min(step_a, 0.5), -0.5), A_RANGE[0]), A_RANGE[1])
        b = min(max(b + max(min(step_b, 0.5), -0.5), B_RANGE[0]), B_RANGE[1])
        if abs(step_a) < 1e-5 and abs(step_b) < 1e-5:
            break
    return a, b


def calibrate(items, rows, max_iter=200, tol=1e-4):
    for it in items:
        it["c"] = 1 / it["k"]
    for iteration in range(1, max_iter + 1):
        lp, lq = log_tables(items)
        n_iq = [[0.0] * len(QUAD) for _ in items]
        r_iq = [[0.0] * len(QUAD) for _ in items]
        for _, resp in rows:
            w = posterior(resp, lp, lq)
            for i, x in enumerate(resp):
                if x is None:
                    continue
                nrow, rrow = n_iq[i], r_iq[i]
                for q in range(len(QUAD)):
                    nrow[q] += w[q]
                    if x:
                        rrow[q] += w[q]
        change = 0.0
        for i, it in enumerate(items):
            a, b = m_step(it, n_iq[i], r_iq[i])
            change = max(change, abs(a - it["a"]), abs(b - it["b"]))
            it["a"], it["b"] = a, b
        if change < tol:
            break
    return iteration


def person_estimates(items, rows):
    lp, lq = log_tables(items)
    out = []
    for age, resp in rows:
        w = posterior(resp, lp, lq)
        m = sum(wq * t for wq, t in zip(w, QUAD))
        v = sum(wq * (t - m) ** 2 for wq, t in zip(w, QUAD))
        out.append((age, m, v))
    return out


def group_stats(est):
    """Trung bình và độ lệch chuẩn năng lực thật của nhóm, hiệu chỉnh shrinkage của EAP."""
    n = len(est)
    m = sum(e[1] for e in est) / n
    var_eap = sum((e[1] - m) ** 2 for e in est) / max(n - 1, 1)
    err = sum(e[2] for e in est) / n
    return m, math.sqrt(var_eap + err), var_eap / (var_eap + err) if var_eap + err > 0 else 1


def show_path(path):
    try:
        return os.path.relpath(path, ROOT)
    except ValueError:
        return path


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", default=os.path.join(ROOT, "data", "results.jsonl"))
    ap.add_argument("--output", default=os.path.join(ROOT, "js", "params.js"))
    ap.add_argument("--min-sample", type=int, default=500, help="số bài tối thiểu để cập nhật tham số")
    ap.add_argument("--min-group", type=int, default=30, help="số người tối thiểu để tính chuẩn cho 1 nhóm tuổi")
    ap.add_argument("--min-elapsed", type=int, default=60, help="bỏ các bài làm dưới N giây")
    ap.add_argument("--include-repeats", action="store_true", help="dùng cả các lần làm lại")
    ap.add_argument("--force", action="store_true", help="vẫn ghi file dù chưa đủ mẫu")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    bank = load_bank()
    items = [dict(it) for it in bank["items"]]
    prior = {it["id"]: (it["a"], it["b"]) for it in items}
    if not os.path.exists(args.input):
        sys.exit(f"Chưa có dữ liệu: {args.input}")
    rows, skipped = load_records(args.input, bank["bank"], [it["id"] for it in items], args.min_elapsed, args.include_repeats)
    print(f"Ngân hàng câu hỏi {bank['bank']}: dùng {len(rows)} bài, bỏ qua {skipped}")
    if len(rows) < 50:
        sys.exit("Quá ít dữ liệu (cần ít nhất 50 bài) để ước lượng.")

    iters = calibrate(items, rows)
    print(f"EM hội tụ sau {iters} vòng lặp")

    # Neo thang đo vào nhóm tham chiếu 20–34 tuổi
    est = person_estimates(items, rows)
    ref = [e for e in est if REF_AGES[0] <= e[0] <= REF_AGES[1]]
    if len(ref) < args.min_group:
        print(f"! Nhóm 20–34 tuổi chỉ có {len(ref)} người – neo theo toàn bộ mẫu thay thế")
        ref = est
    m_ref, s_ref, rel = group_stats(ref)
    for it in items:
        it["b"] = min(max((it["b"] - m_ref) / s_ref, B_RANGE[0]), B_RANGE[1])
        it["a"] = min(max(it["a"] * s_ref, A_RANGE[0]), A_RANGE[1])
    print(f"Neo thang: μ_ref={m_ref:+.3f}, σ_ref={s_ref:.3f}, độ tin cậy ≈ {rel:.2f}")

    # Chuẩn tuổi
    age_norms = []
    print("\nNhóm tuổi      n     μ (SD so với nhóm 20–34)")
    for lo, hi in AGE_BINS:
        g = [e for e in est if lo <= e[0] <= hi]
        if len(g) < args.min_group:
            print(f"  {lo:>2}–{hi:<2}   {len(g):>5}     (chưa đủ mẫu, dùng nội suy)")
            continue
        m_g, _, rel_g = group_stats(g)
        # EAP co về 0; chia cho độ tin cậy để khôi phục chênh lệch thật giữa các nhóm
        mu = ((m_g - m_ref) / s_ref) / max(rel_g, 0.5)
        mid = (lo + hi) / 2
        age_norms.append([round(mid, 1), round(mu, 3)])
        print(f"  {lo:>2}–{hi:<2}   {len(g):>5}     {mu:+.2f}")

    # Báo cáo câu hỏi
    print("\nCâu   miền      n     %đúng   a cũ→mới       b cũ→mới      ghi chú")
    ids = [it["id"] for it in items]
    for i, it in enumerate(items):
        col = [resp[i] for _, resp in rows if resp[i] is not None]
        n = len(col)
        pc = sum(col) / n if n else float("nan")
        it["n"], it["p"] = n, round(pc, 3)
        note = []
        if it["a"] < 0.6:
            note.append("độ phân biệt thấp – xem lại câu hỏi/đáp án")
        if n and pc < 1 / it["k"]:
            note.append("tỷ lệ đúng < đoán mò – có thể sai đáp án")
        a0, b0 = prior[ids[i]]
        print(f"{it['id']:<5} {it['domain']:<8} {n:>5}   {pc:>5.0%}   {a0:.2f}→{it['a']:.2f}   {b0:+.2f}→{it['b']:+.2f}   {'; '.join(note)}")

    if len(rows) < args.min_sample and not args.force:
        print(f"\nChưa đủ {args.min_sample} bài nên KHÔNG cập nhật {show_path(args.output)} (dùng --force để bỏ qua).")
        return
    if args.dry_run:
        print("\n--dry-run: không ghi file.")
        return

    params = {
        "bank": bank["bank"],
        "calibratedAt": date.today().isoformat(),
        "sampleSize": len(rows),
        "items": {it["id"]: {"a": round(it["a"], 3), "b": round(it["b"], 3), "n": it["n"], "p": it["p"]} for it in items},
        "ageNorms": age_norms if len(age_norms) >= 2 else None,
    }
    with open(args.output, "w", encoding="utf-8") as f:
        f.write("// Tạo tự động bởi tools/calibrate.py — không sửa tay.\n")
        f.write("window.IQ_PARAMS = " + json.dumps(params, ensure_ascii=False, indent=2) + ";\n")
    print(f"\nĐã ghi {show_path(args.output)} ({len(rows)} bài).")


if __name__ == "__main__":
    main()
