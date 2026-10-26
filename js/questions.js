/*
 * Ngân hàng câu hỏi dạng KHUÔN (Automatic Item Generation).
 * Mỗi khuôn giữ nguyên quy luật và độ khó, nhưng mỗi lần làm bài sinh ra số liệu, hình, tên khác nhau
 * → làm lại không thể nhớ đáp án. Mọi biến thể của một khuôn dùng chung tham số IRT (giả định đồng dạng).
 *
 *  b  = độ khó (tham số IRT, thang logit)
 *  a  = độ phân biệt (IRT)
 *  make(rng) → một biến thể: { prompt, seq?, options, answer, explain } hoặc với ma trận { gen, distractors, explain }
 *  Với câu ma trận, gen(r, c) mô tả ô ở hàng r, cột c; đáp án đúng là gen(2, 2).
 *  explain chỉ dùng nội bộ (kiểm tra, tài liệu) – không hiển thị cho người làm bài.
 *
 * Mọi khuôn được kiểm tra tự động bằng tools/validate_items.js (độ chính xác + sai lệch).
 */
(function (root) {
  'use strict';

  // Tăng phiên bản khi sửa khuôn hoặc đáp án, để dữ liệu cũ không bị trộn khi chuẩn hoá
  root.QUESTION_BANK_VERSION = 'v3';

  // ───────── Ngẫu nhiên có seed (mulberry32) ─────────
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const perm = (r, arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const dedupe = arr => [...new Set(arr)];
  const mod360 = x => ((x % 360) + 360) % 360;
  const money = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  const deg = x => String(x).replace('.', ',') + '°';
  const canon = o => JSON.stringify(o, Object.keys(o).sort().concat(o.inner ? Object.keys(o.inner) : []));

  /*
   * Phương án số KHÔNG sai lệch thứ hạng: chọn ngẫu nhiên đáp án đứng thứ mấy khi xếp các phương án
   * từ nhỏ đến lớn, rồi lấy phương án nhiễu "hợp lý" (sai lầm thường gặp) và số lân cận ở hai phía.
   */
  function numOptions(r, ans, plausible, { n = 5, min = 1, max = Infinity, step = Math.max(1, Math.round(ans * 0.05)) } = {}) {
    const ok = x => Number.isFinite(x) && x >= min && x <= max && x !== ans && Number.isInteger(x * 2);
    const near = perm(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map(k => k * step);
    const below = dedupe([...perm(r, plausible.filter(x => x < ans)), ...near.map(d => ans - d)].filter(ok));
    const above = dedupe([...perm(r, plausible.filter(x => x > ans)), ...near.map(d => ans + d)].filter(ok));
    const lo = Math.max(0, n - 1 - above.length), hi = Math.min(n - 1, below.length);
    const t = int(r, lo, hi);
    return [ans, ...below.slice(0, t), ...above.slice(0, n - 1 - t)];
  }
  const seqQ = (r, seq, ans, plausible, explain) => ({ prompt: 'Số tiếp theo của dãy là?', seq, options: numOptions(r, ans, plausible), answer: ans, explain });

  /*
   * Phương án nhiễu cho ma trận theo phương pháp RAVEN-FAIR: mỗi phương án mới được tạo bằng cách
   * đổi MỘT thuộc tính của một phương án bất kỳ đã có (không phải luôn của đáp án), để đáp án không
   * phải là phương án "giống các phương án khác nhất".
   */
  function fairOptions(r, answer, mutate, n = 6) {
    const pool = [answer], keys = new Set([canon(answer)]);
    // Dừng khi đủ 3n ứng viên hoặc 40 lần liên tiếp không tạo được phương án mới (miền giá trị nhỏ)
    for (let misses = 0; pool.length < 3 * n && misses < 40;) {
      const next = mutate(r, pick(r, pool)), key = next && canon(next);
      if (next && !keys.has(key)) { keys.add(key); pool.push(next); misses = 0; } else misses++;
    }
    // Chọn n − 1 phương án nhiễu sao cho đáp án đứng ở thứ hạng "giống các phương án khác" ngẫu nhiên đều
    // → mẹo "chọn hình giống nhất" hay "chọn hình khác nhất" đều chỉ đúng ở mức đoán mò.
    // Thứ hạng mục tiêu t: đáp án phải có thể đứng ở vị trí t khi xếp theo độ giống (tính cả trường hợp
    // bằng điểm: hi = số phương án giống hơn, lo = số phương án kém giống hơn → vị trí khả dĩ hi..n−1−lo).
    const target = int(r, 0, n - 1);
    let best = null, bestGap = Infinity;
    for (let t = 0; t < 80; t++) {
      const pickSet = perm(r, pool.slice(1)).slice(0, n - 1), opts = [answer, ...pickSet];
      const score = opts.map(a => opts.reduce((sum, b) => sum + (a === b ? 0 : similarity(a, b)), 0));
      const hi = score.filter(x => x > score[0]).length, lo = score.filter(x => x < score[0]).length;
      const gap = target < hi ? hi - target : target > n - 1 - lo ? target - (n - 1 - lo) : 0;
      // Ưu tiên tập không có nhiều phương án bằng điểm với đáp án (để mẹo không ăn may nhờ hoà điểm)
      const ties = n - 1 - hi - lo, cost = gap * 10 + ties;
      if (cost < bestGap) { best = pickSet; bestGap = cost; }
      if (cost === 0) break;
    }
    return best;
  }
  // Số thuộc tính giống nhau giữa hai ô
  function similarity(a, b) {
    if (a.lines) return LINE_KEYS.filter(k => a.lines.includes(k) === b.lines.includes(k)).length;
    const f = o => [o.shape, o.n || 1, o.fill, o.rot || 0, o.inner ? o.inner.shape : '-'];
    const fa = f(a), fb = f(b);
    return fa.filter((x, i) => x === fb[i]).length;
  }
  // Đổi một thuộc tính trong các miền giá trị cho trước
  const attrMutator = domains => (r, o) => {
    const a = pick(r, Object.keys(domains));
    const vals = domains[a].filter(v => JSON.stringify(v) !== JSON.stringify(o[a]));
    if (!vals.length) return null;
    const v = pick(r, vals), next = { ...o };
    if (v === undefined) delete next[a]; else next[a] = v;
    return next;
  };
  // Bật/tắt một nét vẽ
  const lineMutator = (r, o) => {
    const k = pick(r, LINE_KEYS), lines = o.lines.includes(k) ? o.lines.filter(x => x !== k) : [...o.lines, k];
    return lines.length ? { lines: lines.sort() } : null;
  };

  // ───────── Tên gọi hình, màu, hướng ─────────
  const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star'];
  const FILLS = ['none', 'gray', 'solid'];
  const ROTS = [0, 45, 90, 135, 180, 225, 270, 315];
  const SN = { circle: 'hình tròn', square: 'hình vuông', triangle: 'tam giác', diamond: 'hình thoi', star: 'ngôi sao' };
  const FN = { none: 'trắng', gray: 'xám', solid: 'đen' };
  const DIR = { 0: 'lên trên', 45: 'chéo lên bên phải', 90: 'sang phải', 135: 'chéo xuống bên phải', 180: 'xuống dưới', 225: 'chéo xuống bên trái', 270: 'sang trái', 315: 'chéo lên bên trái' };
  const ARROW = 'arrow';
  const LINE_KEYS = ['top', 'bottom', 'left', 'right', 'h', 'v', 'd1', 'd2'];
  const NAMES = ['An', 'Bình', 'Cường', 'Dũng', 'Hà', 'Lan', 'Minh', 'Nam', 'Phương', 'Quân', 'Thảo', 'Vy'];
  const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

  // 3 hàng (a, b, a + b) cho quy luật "cột 3 = cột 1 + cột 2"
  function sumRows(r) {
    for (;;) {
      const rows = [0, 1, 2].map(() => { const a = int(r, 1, 3), b = int(r, 1, 3); return [a, b, a + b]; });
      if (rows[2][2] >= 3 && rows[2][2] <= 5 && new Set(rows.map(x => x.join())).size === 3) return rows;
    }
  }

  // Ma trận nét vẽ: cột 3 = cột 1 XOR cột 2 (op 'xor') hoặc cột 1 AND cột 2 (op 'and')
  function lineMatrix(r, op) {
    const xor = (A, B) => [...A.filter(x => !B.includes(x)), ...B.filter(x => !A.includes(x))].sort();
    const and = (A, B) => A.filter(x => B.includes(x)).sort();
    for (;;) {
      const rows = [0, 1, 2].map(() => {
        const A = perm(r, LINE_KEYS).slice(0, int(r, 2, 4)).sort(), B = perm(r, LINE_KEYS).slice(0, int(r, 2, 4)).sort();
        return [A, B, op === 'xor' ? xor(A, B) : and(A, B)];
      });
      const ok = rows.every(([A, B, C]) => C.length >= 1 && C.length <= 4 && and(A, B).length >= 1 && xor(A, B).length >= 1);
      if (!ok || new Set(rows.map(x => x[2].join())).size < 3) continue;
      const answer = { lines: rows[2][2] };
      return { gen: (rr, cc) => ({ lines: rows[rr][cc] }), distractors: fairOptions(r, answer, lineMutator) };
    }
  }

  const pool = list => r => ({ ...pick(r, list) });

  root.QUESTIONS = [
    // ───────── Suy luận số ─────────
    { id: 'n1', domain: 'number', b: -2.5, a: 1.5, make: r => {
      const s = int(r, 1, 9), d = int(r, 2, 6), seq = [0, 1, 2, 3].map(i => s + i * d), ans = s + 4 * d;
      return seqQ(r, seq, ans, [ans + d, ans - 1], `Mỗi số cộng thêm ${d}: ${seq[3]} + ${d} = ${ans}.`);
    } },
    { id: 'n2', domain: 'number', b: -1.5, a: 1.5, make: r => {
      const m = pick(r, [2, 3]), s = m === 2 ? int(r, 2, 9) : int(r, 2, 5), seq = [0, 1, 2, 3].map(i => s * m ** i), ans = s * m ** 4;
      return seqQ(r, seq, ans, [2 * seq[3] - seq[2], seq[3] * (m + 1), seq[3] + seq[2]], `Mỗi số nhân ${m}: ${seq[3]} × ${m} = ${ans}.`);
    } },
    { id: 'n3', domain: 'number', b: -0.8, a: 1.5, make: r => {
      const k = int(r, 1, 9), seq = [0, 1, 2, 3, 4].map(i => (k + i) ** 2), ans = (k + 5) ** 2;
      return seqQ(r, seq, ans, [2 * seq[4] - seq[3], ans + k + 5, (k + 4) * (k + 6)], `Các số chính phương ${k}², ${k + 1}², …, ${k + 4}² → ${k + 5}² = ${ans}.`);
    } },
    { id: 'n4', domain: 'number', b: -0.3, a: 1.5, make: r => {
      const s = int(r, 1, 12), d0 = int(r, 1, 3), seq = [s];
      for (let i = 0; i < 5; i++) seq.push(seq[i] + d0 + i);
      const ans = seq[5] + d0 + 5;
      return seqQ(r, seq, ans, [seq[5] + d0 + 4, ans + 1, ans + d0 + 6], `Hiệu tăng dần ${d0}, ${d0 + 1}, …, ${d0 + 4} → ${seq[5]} + ${d0 + 5} = ${ans}.`);
    } },
    { id: 'n5', domain: 'number', b: 0.3, a: 1.5, make: r => {
      const s = int(r, 3, 12), p = int(r, 4, 8), q = int(r, 1, 3), seq = [s];
      for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + (i % 2 ? p : -q));
      const ans = seq[5] - q;
      return seqQ(r, seq, ans, [seq[5] + p, seq[5] + q, seq[5] + p - q], `Xen kẽ +${p} và −${q}: ${seq[5]} − ${q} = ${ans}.`);
    } },
    { id: 'n6', domain: 'number', b: 0.8, a: 1.6, make: r => {
      const m = pick(r, [2, 3]), s = m === 3 ? int(r, 2, 3) : int(r, 2, 6), c = pick(r, [1, -1]), seq = [s];
      for (let i = 1; i < 5; i++) seq.push(seq[i - 1] * m + c);
      const ans = seq[4] * m + c;
      return seqQ(r, seq, ans, [seq[4] * m, seq[4] * m - c, 2 * seq[4] - seq[3]], `Nhân ${m} rồi ${c > 0 ? 'cộng' : 'trừ'} 1: ${seq[4]} × ${m} ${c > 0 ? '+' : '−'} 1 = ${ans}.`);
    } },
    { id: 'n7', domain: 'number', b: 1.1, a: 1.6, make: r => {
      const seq = [int(r, 1, 6), int(r, 1, 7)];
      for (let i = 2; i < 6; i++) seq.push(seq[i - 1] + seq[i - 2]);
      const ans = seq[4] + seq[5];
      return seqQ(r, seq, ans, [2 * seq[5] - seq[4], ans - seq[3], ans + seq[3]], `Mỗi số bằng tổng hai số liền trước: ${seq[4]} + ${seq[5]} = ${ans}.`);
    } },
    { id: 'n8', domain: 'number', b: 1.6, a: 1.7, make: r => {
      const a0 = int(r, 2, 12), da = int(r, 2, 4), b0 = a0 + int(r, 2, 6), db = pick(r, [2, 3, 4, 5].filter(x => x !== da));
      const seq = [a0, b0, a0 + da, b0 + db, a0 + 2 * da, b0 + 2 * db], ans = a0 + 3 * da;
      return seqQ(r, seq, ans, [b0 + 3 * db, seq[5] + da, seq[5] - da],
        `Hai dãy xen kẽ: vị trí lẻ ${a0}, ${a0 + da}, ${a0 + 2 * da} (+${da}), vị trí chẵn ${b0}, ${b0 + db}, ${b0 + 2 * db} (+${db}). Số thứ 7 thuộc dãy lẻ → ${ans}.`);
    } },
    { id: 'n9', domain: 'number', b: 2.6, a: 1.8, make: r => {
      const f = pick(r, [
        { fn: n => n * n * (n + 1), t: 'n² × (n + 1)' },
        { fn: n => n * n * (n + 2), t: 'n² × (n + 2)' },
        { fn: n => n * (n + 1) * (n + 2), t: 'n × (n + 1) × (n + 2)' },
        { fn: n => n * n * n + n, t: 'n³ + n' },
      ]);
      const st = int(r, 1, 3), seq = [0, 1, 2, 3, 4].map(i => f.fn(st + i)), ans = f.fn(st + 5);
      return seqQ(r, seq, ans, [3 * seq[4] - 3 * seq[3] + seq[2], 2 * seq[4] - seq[3] + (seq[4] - seq[3])], `Các số là ${f.t} với n = ${st}, ${st + 1}, …, ${st + 4} → với n = ${st + 5} được ${ans}.`);
    } },
    { id: 'n10', domain: 'number', b: 2.2, a: 1.8, make: r => {
      const s = int(r, 1, 12), j = pick(r, [1, 2, 3]), seq = [s];
      for (let i = 0; i < 4; i++) seq.push(seq[i] + (j + i) ** 2);
      const ans = seq[4] + (j + 4) ** 2;
      return seqQ(r, seq, ans, [seq[4] + 2 * (j + 3) ** 2 - (j + 2) ** 2, seq[4] + (j + 3) ** 2],
        `Hiệu giữa các số là ${[0, 1, 2, 3].map(i => (j + i) ** 2).join(', ')} (số chính phương) → tiếp theo +${(j + 4) ** 2}: ${seq[4]} + ${(j + 4) ** 2} = ${ans}.`);
    } },
    { id: 'n11', domain: 'number', b: 2.6, a: 1.8, make: r => {
      const sg = pick(r, [1, -1]), s = sg > 0 ? int(r, 2, 7) : int(r, 3, 7), seq = [s];
      for (let i = 1; i < 5; i++) seq.push(2 * seq[i - 1] + sg * i);
      const ans = 2 * seq[4] + sg * 5;
      return seqQ(r, seq, ans, [2 * seq[4] + sg * 4, 2 * seq[4] + sg, 2 * seq[4] - sg * 5],
        `Nhân 2 rồi ${sg > 0 ? 'cộng' : 'trừ'} lần lượt 1, 2, 3, 4 → ${seq[4]} × 2 ${sg > 0 ? '+' : '−'} 5 = ${ans}.`);
    } },
    { id: 'n12', domain: 'number', b: 3.2, a: 1.9, make: r => {
      const c = int(r, 1, 3), oddPlus = r() < 0.5, base = int(r, 2, 4), sgn = n => ((n % 2 === 1) === oddPlus ? c : -c);
      const ns = [0, 1, 2, 3, 4, 5].map(i => base + i), seq = ns.map(n => n * n + sgn(n)), last = base + 6, ans = last * last + sgn(last);
      return seqQ(r, seq, ans, [last * last - sgn(last), last * last, 2 * seq[5] - seq[4]],
        `Các số là ${base}², ${base + 1}², …, ${base + 5}² lần lượt ${oddPlus ? 'trừ' : 'cộng'} ${c} (n chẵn) và ${oddPlus ? 'cộng' : 'trừ'} ${c} (n lẻ) → ${last}² ${sgn(last) > 0 ? '+' : '−'} ${c} = ${ans}.`);
    } },

    // ───────── Ngôn ngữ (ngân hàng viết tay, mỗi khuôn 8 phiên bản) ─────────
    { id: 'v1', domain: 'verbal', b: -2.3, a: 1.4, make: pool([
      { prompt: '“Chó” đi với “sủa” như “mèo” đi với…', options: ['Kêu meo meo', 'Gáy', 'Hí', 'Rống'], answer: 'Kêu meo meo', explain: 'Tiếng kêu: chó sủa, mèo kêu meo meo.' },
      { prompt: '“Gà trống” đi với “gáy” như “ngựa” đi với…', options: ['Hí', 'Sủa', 'Rống', 'Kêu meo meo'], answer: 'Hí', explain: 'Tiếng kêu: gà trống gáy, ngựa hí.' },
      { prompt: '“Chim” đi với “hót” như “chó” đi với…', options: ['Sủa', 'Gáy', 'Hí', 'Kêu meo meo'], answer: 'Sủa', explain: 'Tiếng kêu: chim hót, chó sủa.' },
      { prompt: '“Hổ” đi với “gầm” như “gà trống” đi với…', options: ['Gáy', 'Hí', 'Sủa', 'Hót'], answer: 'Gáy', explain: 'Tiếng kêu: hổ gầm, gà trống gáy.' },
      { prompt: '“Ngựa” đi với “hí” như “chim” đi với…', options: ['Hót', 'Sủa', 'Gáy', 'Gầm'], answer: 'Hót', explain: 'Tiếng kêu: ngựa hí, chim hót.' },
      { prompt: '“Mèo” đi với “kêu meo meo” như “hổ” đi với…', options: ['Gầm', 'Hót', 'Hí', 'Gáy'], answer: 'Gầm', explain: 'Tiếng kêu: mèo kêu meo meo, hổ gầm.' },
      { prompt: '“Ong” đi với “vo ve” như “chim” đi với…', options: ['Hót', 'Gầm', 'Sủa', 'Hí'], answer: 'Hót', explain: 'Âm thanh: ong vo ve, chim hót.' },
      { prompt: '“Bò” đi với “rống” như “ngựa” đi với…', options: ['Hí', 'Sủa', 'Gáy', 'Hót'], answer: 'Hí', explain: 'Tiếng kêu: bò rống, ngựa hí.' },
    ]) },
    { id: 'v2', domain: 'verbal', b: -1.4, a: 1.4, make: pool([
      { prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Cà rốt', 'Táo', 'Chuối', 'Xoài', 'Cam'], answer: 'Cà rốt', explain: 'Cà rốt là rau củ, còn lại là trái cây.' },
      { prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Ghế', 'Áo', 'Quần', 'Mũ', 'Giày'], answer: 'Ghế', explain: 'Ghế là đồ nội thất, còn lại là đồ mặc trên người.' },
      { prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Gỗ', 'Sắt', 'Đồng', 'Vàng', 'Bạc'], answer: 'Gỗ', explain: 'Gỗ không phải kim loại.' },
      { prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Bàn chải', 'Bút chì', 'Thước kẻ', 'Tẩy', 'Vở'], answer: 'Bàn chải', explain: 'Bàn chải không phải đồ dùng học tập.' },
      { prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Mưa', 'Xuân', 'Hạ', 'Thu', 'Đông'], answer: 'Mưa', explain: 'Mưa không phải tên một mùa.' },
      { prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Hà Nội', 'Pháp', 'Nhật Bản', 'Brazil', 'Ai Cập'], answer: 'Hà Nội', explain: 'Hà Nội là thành phố, còn lại là quốc gia.' },
      { prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Bóng đá', 'Đàn ghi-ta', 'Sáo', 'Trống', 'Đàn piano'], answer: 'Bóng đá', explain: 'Bóng đá không phải nhạc cụ.' },
      { prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Sư tử', 'Đại bàng', 'Chim sẻ', 'Bồ câu', 'Cú mèo'], answer: 'Sư tử', explain: 'Sư tử không phải loài chim.' },
    ]) },
    { id: 'v3', domain: 'verbal', b: -0.9, a: 1.4, make: pool([
      { prompt: '“Bác sĩ” : “bệnh viện” = “giáo viên” : ?', options: ['Trường học', 'Học sinh', 'Sách giáo khoa', 'Bảng đen', 'Bài giảng'], answer: 'Trường học', explain: 'Nơi làm việc.' },
      { prompt: '“Đầu bếp” : “nhà bếp” = “phi công” : ?', options: ['Buồng lái', 'Hành khách', 'Bầu trời', 'Vé máy bay', 'Đồng phục'], answer: 'Buồng lái', explain: 'Nơi làm việc.' },
      { prompt: '“Nông dân” : “cánh đồng” = “thợ mỏ” : ?', options: ['Hầm mỏ', 'Than đá', 'Cái cuốc', 'Kim cương', 'Mũ bảo hộ'], answer: 'Hầm mỏ', explain: 'Nơi làm việc.' },
      { prompt: '“Thợ may” : “kim chỉ” = “thợ mộc” : ?', options: ['Cái cưa', 'Tấm gỗ', 'Cái bàn', 'Xưởng mộc', 'Mùn cưa'], answer: 'Cái cưa', explain: 'Dụng cụ làm việc.' },
      { prompt: '“Họa sĩ” : “bức tranh” = “nhà văn” : ?', options: ['Cuốn tiểu thuyết', 'Cây bút', 'Thư viện', 'Độc giả', 'Chiếc máy đánh chữ'], answer: 'Cuốn tiểu thuyết', explain: 'Sản phẩm làm ra.' },
      { prompt: '“Bút” : “viết” = “kéo” : ?', options: ['Cắt', 'Giấy', 'Sắc', 'Thợ may', 'Kim loại'], answer: 'Cắt', explain: 'Công dụng của đồ vật.' },
      { prompt: '“Mắt” : “nhìn” = “tai” : ?', options: ['Nghe', 'Âm thanh', 'Đầu', 'Nói', 'Điếc'], answer: 'Nghe', explain: 'Chức năng của giác quan.' },
      { prompt: '“Thủ môn” : “khung thành” = “lính gác” : ?', options: ['Cổng doanh trại', 'Khẩu súng', 'Bộ quân phục', 'Mệnh lệnh cấp trên', 'Kẻ địch'], answer: 'Cổng doanh trại', explain: 'Nơi được canh giữ.' },
    ]) },
    { id: 'v4', domain: 'verbal', b: -0.4, a: 1.4, make: pool([
      { prompt: 'Từ nào TRÁI NGHĨA với “khiêm tốn”?', options: ['Kiêu ngạo', 'Nhút nhát', 'Giản dị', 'Lễ phép', 'Tự tin'], answer: 'Kiêu ngạo', explain: 'Trái nghĩa.' },
      { prompt: 'Từ nào TRÁI NGHĨA với “cần cù”?', options: ['Lười biếng', 'Chăm chỉ', 'Siêng năng', 'Mệt mỏi', 'Chậm chạp'], answer: 'Lười biếng', explain: 'Trái nghĩa.' },
      { prompt: 'Từ nào TRÁI NGHĨA với “hào phóng”?', options: ['Keo kiệt', 'Rộng rãi', 'Giàu có', 'Nghèo khó', 'Vui vẻ'], answer: 'Keo kiệt', explain: 'Trái nghĩa.' },
      { prompt: 'Từ nào TRÁI NGHĨA với “dũng cảm”?', options: ['Hèn nhát', 'Mạnh mẽ', 'Gan dạ', 'Liều lĩnh', 'Cứng rắn'], answer: 'Hèn nhát', explain: 'Trái nghĩa.' },
      { prompt: 'Từ nào TRÁI NGHĨA với “trung thực”?', options: ['Gian dối', 'Thật thà', 'Ngay thẳng', 'Nóng nảy', 'Lười nhác'], answer: 'Gian dối', explain: 'Trái nghĩa.' },
      { prompt: 'Từ nào TRÁI NGHĨA với “phức tạp”?', options: ['Đơn giản', 'Rắc rối', 'Khó khăn', 'Nhanh chóng', 'Rộng lớn'], answer: 'Đơn giản', explain: 'Trái nghĩa.' },
      { prompt: 'Từ nào TRÁI NGHĨA với “cẩn thận”?', options: ['Cẩu thả', 'Chu đáo', 'Kỹ lưỡng', 'Chậm chạp', 'Nhút nhát'], answer: 'Cẩu thả', explain: 'Trái nghĩa.' },
      { prompt: 'Từ nào TRÁI NGHĨA với “lạc quan”?', options: ['Bi quan', 'Vui vẻ', 'Hy vọng', 'Thờ ơ', 'Bình tĩnh'], answer: 'Bi quan', explain: 'Trái nghĩa.' },
    ]) },
    { id: 'v5', domain: 'verbal', b: 0.0, a: 1.4, make: pool([
      { prompt: '“Chương” : “sách” = “khổ thơ” : ?', options: ['Bài thơ', 'Câu thơ', 'Nhà thơ', 'Vần', 'Trang'], answer: 'Bài thơ', explain: 'Bộ phận – tổng thể.' },
      { prompt: '“Ngón tay” : “bàn tay” = “ngón chân” : ?', options: ['Bàn chân', 'Đôi giày', 'Đầu gối', 'Móng chân', 'Cẳng chân'], answer: 'Bàn chân', explain: 'Bộ phận – tổng thể.' },
      { prompt: '“Trang” : “quyển vở” = “toa” : ?', options: ['Đoàn tàu', 'Đường ray', 'Hành khách', 'Nhà ga', 'Vé tàu'], answer: 'Đoàn tàu', explain: 'Bộ phận – tổng thể.' },
      { prompt: '“Cầu thủ” : “đội bóng” = “nhạc công” : ?', options: ['Dàn nhạc', 'Bản nhạc', 'Nhạc cụ', 'Sân khấu', 'Khán giả'], answer: 'Dàn nhạc', explain: 'Thành viên – tập thể.' },
      { prompt: '“Viên gạch” : “bức tường” = “từ” : ?', options: ['Câu', 'Chữ cái', 'Ngôn ngữ', 'Lời nói', 'Dấu chấm'], answer: 'Câu', explain: 'Bộ phận – tổng thể.' },
      { prompt: '“Người lính” : “quân đội” = “cầu thủ” : ?', options: ['Đội bóng', 'Quả bóng', 'Sân cỏ', 'Trọng tài', 'Bàn thắng'], answer: 'Đội bóng', explain: 'Thành viên – tập thể.' },
      { prompt: '“Xã” : “huyện” = “phường” : ?', options: ['Quận', 'Tỉnh', 'Thôn', 'Làng', 'Đất nước'], answer: 'Quận', explain: 'Đơn vị hành chính cấp dưới – cấp trên trực tiếp.' },
      { prompt: '“Lòng đỏ” : “quả trứng” = “hạt” : ?', options: ['Quả', 'Cây', 'Đất', 'Hoa', 'Rễ'], answer: 'Quả', explain: 'Phần bên trong – vật chứa nó.' },
    ]) },
    { id: 'v6', domain: 'verbal', b: 0.5, a: 1.5, make: pool([
      { prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Tin tưởng', 'Hồ nghi', 'Ngờ vực', 'Hoài nghi', 'Nghi ngại'], answer: 'Tin tưởng', explain: 'Còn lại chỉ sự nghi ngờ.' },
      { prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Buồn bã', 'Vui vẻ', 'Hân hoan', 'Phấn khởi', 'Hớn hở'], answer: 'Buồn bã', explain: 'Còn lại chỉ niềm vui.' },
      { prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Siêng năng', 'Lười biếng', 'Biếng nhác', 'Chây lười', 'Uể oải'], answer: 'Siêng năng', explain: 'Còn lại chỉ sự lười.' },
      { prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Im lặng', 'Ồn ào', 'Huyên náo', 'Náo nhiệt', 'Ầm ĩ'], answer: 'Im lặng', explain: 'Còn lại chỉ sự ồn.' },
      { prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Nhỏ bé', 'Khổng lồ', 'To lớn', 'Đồ sộ', 'Kếch xù'], answer: 'Nhỏ bé', explain: 'Còn lại chỉ kích thước lớn.' },
      { prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Chậm chạp', 'Nhanh nhẹn', 'Mau lẹ', 'Nhanh nhảu', 'Lẹ làng'], answer: 'Chậm chạp', explain: 'Còn lại chỉ sự nhanh.' },
      { prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Sạch sẽ', 'Bẩn thỉu', 'Nhếch nhác', 'Lôi thôi', 'Dơ dáy'], answer: 'Sạch sẽ', explain: 'Còn lại chỉ sự bẩn.' },
      { prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Ấm áp', 'Lạnh lẽo', 'Giá buốt', 'Rét mướt', 'Lạnh giá'], answer: 'Ấm áp', explain: 'Còn lại chỉ cái lạnh.' },
    ]) },
    { id: 'v7', domain: 'verbal', b: 1.0, a: 1.5, make: pool([
      { prompt: 'Mẹ của bố tôi là gì đối với con trai tôi?', options: ['Cụ nội (bà cố)', 'Bà nội', 'Bà ngoại', 'Bác gái', 'Cô'], answer: 'Cụ nội (bà cố)', explain: 'Bà nội của tôi là cụ của con tôi.' },
      { prompt: 'Bố của mẹ tôi là gì đối với con gái tôi?', options: ['Cụ ngoại (ông cố)', 'Ông ngoại', 'Ông nội', 'Bác trai', 'Cậu'], answer: 'Cụ ngoại (ông cố)', explain: 'Ông ngoại của tôi là cụ của con tôi.' },
      { prompt: 'Con trai của anh trai bố tôi là gì của tôi?', options: ['Anh/em họ', 'Chú', 'Cháu', 'Anh/em ruột', 'Bác'], answer: 'Anh/em họ', explain: 'Con của bác là anh/em họ.' },
      { prompt: 'Em gái của mẹ tôi là gì của tôi?', options: ['Dì', 'Cô', 'Mợ', 'Thím', 'Bác gái'], answer: 'Dì', explain: 'Em gái của mẹ là dì.' },
      { prompt: 'Vợ của em trai bố tôi là gì của tôi?', options: ['Thím', 'Cô', 'Dì', 'Mợ', 'Bác gái'], answer: 'Thím', explain: 'Em trai bố là chú, vợ của chú là thím.' },
      { prompt: 'Vợ của em trai mẹ tôi là gì của tôi?', options: ['Mợ', 'Thím', 'Cô', 'Dì', 'Bác gái'], answer: 'Mợ', explain: 'Em trai mẹ là cậu, vợ của cậu là mợ.' },
      { prompt: 'Bố của chồng tôi là gì đối với con tôi?', options: ['Ông nội', 'Ông ngoại', 'Bác trai', 'Chú', 'Cụ nội'], answer: 'Ông nội', explain: 'Bố chồng tôi là bố của bố đứa trẻ → ông nội.' },
      { prompt: 'Con gái của em trai tôi là gì đối với con trai tôi?', options: ['Em họ', 'Cháu', 'Em ruột', 'Cô', 'Dì'], answer: 'Em họ', explain: 'Con của hai anh em ruột là anh/em họ của nhau; con em trai là vai em.' },
    ]) },
    { id: 'v8', domain: 'verbal', b: 1.8, a: 1.7, make: pool([
      { prompt: 'Một người đàn ông chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Bố của người trong ảnh là con trai của bố tôi.” Người trong ảnh là ai?', options: ['Con trai của ông ấy', 'Chính ông ấy', 'Bố của ông ấy', 'Cháu trai của ông ấy', 'Anh trai của ông ấy'], answer: 'Con trai của ông ấy', explain: '“Con trai của bố tôi” = chính ông ấy → người trong ảnh là con ông.' },
      { prompt: 'Một người phụ nữ chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Mẹ của người trong ảnh là con gái của mẹ tôi.” Người trong ảnh là ai?', options: ['Con của bà ấy', 'Chính bà ấy', 'Mẹ của bà ấy', 'Cháu của bà ấy', 'Chị gái của bà ấy'], answer: 'Con của bà ấy', explain: '“Con gái của mẹ tôi” = chính bà ấy → người trong ảnh là con bà.' },
      { prompt: 'Một người đàn ông chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Người trong ảnh là bố của con trai bố tôi.” Người trong ảnh là ai?', options: ['Bố của ông ấy', 'Chính ông ấy', 'Con trai của ông ấy', 'Ông nội của ông ấy', 'Anh trai của ông ấy'], answer: 'Bố của ông ấy', explain: '“Con trai bố tôi” = chính ông ấy → bố của ông ấy.' },
      { prompt: 'Một người phụ nữ chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Người trong ảnh là mẹ của con gái mẹ tôi.” Người trong ảnh là ai?', options: ['Mẹ của bà ấy', 'Chính bà ấy', 'Con gái của bà ấy', 'Bà ngoại của bà ấy', 'Chị gái của bà ấy'], answer: 'Mẹ của bà ấy', explain: '“Con gái mẹ tôi” = chính bà ấy → mẹ của bà ấy.' },
      { prompt: 'Một người đàn ông chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Con trai của người trong ảnh là bố của con trai tôi.” Người trong ảnh là ai?', options: ['Bố của ông ấy', 'Chính ông ấy', 'Con trai của ông ấy', 'Ông nội của ông ấy', 'Cháu trai của ông ấy'], answer: 'Bố của ông ấy', explain: '“Bố của con trai tôi” = chính ông ấy, nên người trong ảnh có con trai là ông ấy → bố của ông.' },
      { prompt: 'Một người đàn ông chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Bố của người trong ảnh là bố của tôi.” Người trong ảnh là ai?', options: ['Chính ông ấy', 'Bố của ông ấy', 'Con trai của ông ấy', 'Anh trai của ông ấy', 'Ông nội của ông ấy'], answer: 'Chính ông ấy', explain: 'Bố ông ấy chỉ có một người con là ông ấy → người trong ảnh là chính ông.' },
      { prompt: 'Một người phụ nữ chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Người trong ảnh là con gái của con gái mẹ tôi.” Người trong ảnh là ai?', options: ['Con gái của bà ấy', 'Chính bà ấy', 'Mẹ của bà ấy', 'Cháu gái của bà ấy', 'Em gái của bà ấy'], answer: 'Con gái của bà ấy', explain: '“Con gái mẹ tôi” = chính bà ấy → con gái của bà.' },
      { prompt: 'Một người đàn ông chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Bố của người trong ảnh là ông nội của con trai tôi.” Người trong ảnh là ai?', options: ['Chính ông ấy', 'Bố của ông ấy', 'Con trai của ông ấy', 'Anh trai của ông ấy', 'Cháu trai của ông ấy'], answer: 'Chính ông ấy', explain: 'Ông nội của con trai ông = bố của ông; bố ông chỉ có một con → chính ông.' },
    ]) },

    // ───────── Logic ─────────
    { id: 'l1', domain: 'logic', b: -2.0, a: 1.4, make: r => {
      const [x, y, z] = perm(r, NAMES);
      const [rel, lo, hi] = pick(r, [['cao hơn', 'thấp nhất', 'cao nhất'], ['nặng hơn', 'nhẹ nhất', 'nặng nhất'], ['nhiều tuổi hơn', 'ít tuổi nhất', 'nhiều tuổi nhất']]);
      const askMin = r() < 0.5, ask = askMin ? lo : hi, unknown = 'Không xác định được';
      // 1/3 số biến thể: hai so sánh cùng xuất phát từ một người → người "ngược lại" không xác định được
      if (r() < 1 / 3) {
        const prompt = askMin ? `${x} ${rel} ${y}. ${x} ${rel} ${z}. Ai ${ask}?` : `${y} ${rel} ${x}. ${z} ${rel} ${x}. Ai ${ask}?`;
        return { prompt, options: [x, y, z, unknown], answer: unknown, explain: `Chỉ biết ${x} so với ${y} và ${z}, chưa biết ${y} và ${z} ai hơn ai.` };
      }
      return { prompt: `${x} ${rel} ${y}. ${y} ${rel} ${z}. Ai ${ask}?`, options: [x, y, z, unknown], answer: askMin ? z : x, explain: `${x} > ${y} > ${z}.` };
    } },
    { id: 'l2', domain: 'logic', b: -1.1, a: 1.4, make: r => {
      const i = int(r, 0, 6), fwd = r() < 0.5, off = fwd ? 3 : -3, d = k => DAYS[(k % 7 + 7) % 7];
      const ans = d(i + off);
      return { prompt: fwd ? `Nếu hôm qua là ${d(i)} thì ngày kia là thứ mấy?` : `Nếu ngày mai là ${d(i)} thì hôm kia là thứ mấy?`,
        options: [ans, d(i + off - 1), d(i + off + 1), d(i + off + (r() < 0.5 ? 2 : -2))], answer: ans,
        explain: fwd ? `Hôm qua ${d(i)} → hôm nay ${d(i + 1)} → ngày kia ${ans}.` : `Ngày mai ${d(i)} → hôm nay ${d(i - 1)} → hôm kia ${ans}.` };
    } },
    { id: 'l3', domain: 'logic', b: 0.6, a: 1.5, make: r => {
      const n = pick(r, [3, 4, 5, 6, 8, 10, 12]), m = pick(r, [60, 80, 100, 120]);
      return { prompt: `${n} máy làm được ${n} sản phẩm trong ${n} phút. Hỏi ${m} máy làm ${m} sản phẩm mất bao lâu?`,
        options: numOptions(r, n, [m, 1, 2 * n, m / n, n * n].filter(Number.isInteger), { step: 1 }).map(x => `${x} phút`), answer: `${n} phút`,
        explain: `Mỗi máy làm 1 sản phẩm trong ${n} phút; làm song song nên vẫn ${n} phút.` };
    } },
    { id: 'l4', domain: 'logic', b: 0.7, a: 1.5, make: r => {
      const k = int(r, 2, 6), per = pick(r, [6, 8, 10, 12]), colors = perm(r, ['đen', 'trắng', 'xám', 'xanh', 'đỏ', 'vàng', 'nâu']).slice(0, k).join(', ');
      return { prompt: `Trong ngăn kéo có ${per * k} chiếc tất gồm ${k} màu (${colors}), mỗi màu ${per} chiếc, để lẫn lộn. Không nhìn, phải lấy ra ít nhất bao nhiêu chiếc để chắc chắn có 2 chiếc cùng màu?`,
        options: numOptions(r, k + 1, [k, 2 * k, per + 1, per * k + 1, 2], { step: 1 }).map(String), answer: String(k + 1),
        explain: `${k} màu → lấy ${k + 1} chiếc chắc chắn có 2 chiếc cùng màu (Dirichlet).` };
    } },
    { id: 'l5', domain: 'logic', b: 0.8, a: 1.5, make: r => {
      const { x, y, z } = pick(r, [
        { x: 'hoa hồng', y: 'hoa', z: 'tàn rất nhanh' },
        { x: 'thợ mộc trong làng', y: 'người khéo tay', z: 'biết đan len' },
        { x: 'xe màu đỏ trong bãi', y: 'xe đã đăng ký', z: 'sắp hết hạn bảo hiểm' },
        { x: 'học sinh lớp 7A', y: 'thành viên câu lạc bộ', z: 'biết bơi' },
      ]);
      // Ba dạng: (1) "Một số Y Z" → không kết luận được; (2) "Tất cả Y đều Z" → tất cả X đều Z;
      // (3) "Không có Y nào Z" → không có X nào Z. Phương án "không kết luận" có lúc ngắn, lúc dài.
      const unk = pick(r, ['Không kết luận được', `Chưa đủ thông tin để biết ${x} có ${z} hay không`]);
      const all = `Tất cả ${x} đều ${z}`, none = `Không có ${x} nào ${z}`, some = `Chỉ một số ${x} ${z}`;
      const form = pick(r, [
        { p: `Một số ${y} ${z}`, ans: unk, ex: `“Một số ${y} ${z}” có thể là những ${y} khác, không nhất thiết có ${x}.` },
        { p: `Tất cả ${y} đều ${z}`, ans: all, ex: `${x} thuộc nhóm ${y}, mà mọi ${y} đều ${z} → mọi ${x} đều ${z}.` },
        { p: `Không có ${y} nào ${z}`, ans: none, ex: `${x} thuộc nhóm ${y}, mà không ${y} nào ${z} → không ${x} nào ${z}.` },
      ]);
      return { prompt: `Giả sử: Tất cả ${x} đều là ${y}. ${form.p}. Kết luận nào chắc chắn đúng?`,
        options: [unk, all, none, some], answer: form.ans, explain: form.ex };
    } },
    { id: 'l6', domain: 'logic', b: 0.9, a: 1.6, make: r => {
      const x = 500 * int(r, 2, 12), d = pick(r, [10000, 15000, 20000]), t = 2 * x + d;
      return { prompt: `Một cây bút và một cuốn vở có tổng giá ${money(t)}. Cuốn vở đắt hơn cây bút đúng ${money(d)}. Cây bút giá bao nhiêu?`,
        options: numOptions(r, x, [t - d, x + d / 2, 3 * x, d / 10], { step: 500, min: 500 }).map(money), answer: money(x),
        explain: `2x + ${money(d)} = ${money(t)} → x = ${money(x)}.` };
    } },
    { id: 'l7', domain: 'logic', b: 1.4, a: 1.6, make: r => {
      const a = int(r, 1, 6), b = int(r, a + 2, 9), s = a + b, ans = 10 * a + b, same = [];
      for (let x = 1; x <= 9; x++) if (s - x >= 0 && s - x <= 9 && x !== a) same.push(10 * x + (s - x));
      return { prompt: `Một số có hai chữ số, tổng hai chữ số bằng ${s}. Nếu đảo ngược thứ tự hai chữ số, số mới lớn hơn số cũ ${9 * (b - a)} đơn vị. Số đó là?`,
        options: numOptions(r, ans, same, { step: 9, min: 10, max: 99 }).map(String), answer: String(ans),
        explain: `9(b − a) = ${9 * (b - a)} → b − a = ${b - a}, a + b = ${s} → ${ans}.` };
    } },
    { id: 'l8', domain: 'logic', b: 2.1, a: 1.7, make: r => {
      const options = ['A trung thực, B nói dối', 'A nói dối, B trung thực', 'Cả hai đều trung thực', 'Cả hai đều nói dối', 'Không xác định được'];
      const base = 'Trên đảo có người trung thực (luôn nói thật) và kẻ nói dối (luôn nói dối). ';
      return pick(r, [
        { prompt: base + 'A nói: “Ít nhất một trong hai chúng tôi là kẻ nói dối.” A và B là ai?', options, answer: options[0], explain: 'A nói dối thì câu lại đúng – mâu thuẫn; vậy A thật, B dối.' },
        { prompt: base + 'A nói: “Cả hai chúng tôi đều là kẻ nói dối.” A và B là ai?', options, answer: options[1], explain: 'A thật thì mâu thuẫn; A dối nên không phải cả hai dối → B thật.' },
        { prompt: base + 'A nói: “B trung thực, còn tôi là kẻ nói dối.” A và B là ai?', options, answer: options[3], explain: 'A thật thì mâu thuẫn; A dối, vế “tôi nói dối” đúng nên vế “B trung thực” sai → B dối.' },
        { prompt: base + 'A nói: “Tôi là người trung thực.” A và B là ai?', options, answer: options[4], explain: 'Ai cũng có thể nói câu này, và không có thông tin về B.' },
      ]);
    } },
    { id: 'l9', domain: 'logic', b: 2.5, a: 1.8, make: r => {
      const { a, b } = pick(r, [{ a: 'Táo', b: 'Cam' }, { a: 'Bút bi', b: 'Bút chì' }, { a: 'Kẹo', b: 'Bánh' }, { a: 'Bi đỏ', b: 'Bi xanh' }]);
      const ab = `${a} và ${b}`, lo = s => s.toLowerCase();
      return {
        prompt: `Có ba hộp: một hộp chỉ đựng ${lo(a)}, một hộp chỉ đựng ${lo(b)}, một hộp đựng cả ${lo(a)} và ${lo(b)}. Các hộp được dán nhãn “${a}”, “${b}”, “${ab}”, nhưng TẤT CẢ nhãn đều dán sai. Bạn chỉ được lấy ra 1 món từ 1 hộp (không nhìn vào trong). Lấy từ hộp nào để xác định đúng nội dung cả ba hộp?`,
        options: [`Hộp nhãn “${ab}”`, `Hộp nhãn “${a}”`, `Hộp nhãn “${b}”`, 'Không thể chỉ với 1 lần lấy'], answer: `Hộp nhãn “${ab}”`,
        explain: `Hộp nhãn “${ab}” chỉ chứa một loại → lấy 1 món là biết nó; hai hộp còn lại suy ra từ việc nhãn đều sai.`,
      };
    } },
    { id: 'l10', domain: 'logic', b: 2.5, a: 1.8, make: r => {
      let h, m, ang;
      do {
        h = int(r, 1, 11); m = pick(r, [10, 15, 20, 25, 35, 40, 45, 50]);
        ang = Math.abs(30 * h - 5.5 * m); if (ang > 180) ang = 360 - ang;
      } while (ang < 5);
      let naive = Math.abs(30 * h - 6 * m); if (naive > 180) naive = 360 - naive;
      return { prompt: `Đồng hồ chỉ ${h} giờ ${m} phút. Góc nhỏ hơn tạo bởi kim giờ và kim phút là bao nhiêu độ?`,
        options: numOptions(r, ang, [naive, 360 - ang].filter(x => x <= 180), { step: 2.5, min: 0.5, max: 180 }).map(deg), answer: deg(ang),
        explain: `Kim phút ${6 * m}°, kim giờ ${deg(30 * h + m / 2)} → ${deg(ang)}.` };
    } },
    { id: 'l11', domain: 'logic', b: 2.4, a: 1.8, make: r => {
      const [A, B, C] = perm(r, NAMES), [J0, J1, J2] = perm(r, ['bác sĩ', 'kỹ sư', 'giáo viên', 'luật sư', 'kiến trúc sư']);
      // Đáp án đa dạng: hỏi nghề J2 (→ B), nghề J0 (→ C), hoặc bỏ dữ kiện (2) rồi hỏi J2 (→ không xác định)
      const mode = pick(r, ['J2', 'J2', 'J0', 'unknown']);
      const facts = [`(1) Người ${J0} nhỏ tuổi nhất.`, ...(mode === 'unknown' ? [] : [`(2) ${B} lớn tuổi hơn người ${J1}.`]), `(${mode === 'unknown' ? 2 : 3}) ${A} không phải ${J0} và ${A} nhỏ tuổi hơn ${B}.`];
      return { prompt: `${A}, ${B}, ${C} làm ba nghề khác nhau: ${perm(r, [J0, J1, J2]).join(', ')}. Biết: ${facts.join(' ')} Ai là ${mode === 'J0' ? J0 : J2}?`,
        options: [B, A, C, 'Không xác định được'], answer: mode === 'J0' ? C : mode === 'J2' ? B : 'Không xác định được',
        explain: mode === 'unknown' ? `${C} là ${J0}, nhưng không có dữ kiện nào phân biệt nghề của ${A} và ${B}.` : `${C} là ${J0}, ${B} là ${J2}, ${A} là ${J1}.` };
    } },
    { id: 'l12', domain: 'logic', b: 2.7, a: 1.8, make: r => {
      const k = int(r, 2, 6), n = int(r, 3 ** (k - 1) + 1, 3 ** k);
      return { prompt: `Có ${n} đồng xu trông giống hệt nhau, trong đó đúng 1 đồng giả nhẹ hơn. Dùng cân hai đĩa (không có quả cân), cần ít nhất bao nhiêu lần cân để CHẮC CHẮN tìm ra đồng giả?`,
        options: numOptions(r, k, [Math.ceil(Math.log2(n)), Math.ceil(n / 3), k + 1, k - 1], { step: 1 }).map(String), answer: String(k),
        explain: `k lần cân phân biệt tối đa 3^k đồng: ${3 ** (k - 1)} < ${n} ≤ ${3 ** k} → ${k}.` };
    } },
    { id: 'l13', domain: 'logic', b: 3.1, a: 1.9, make: r => {
      const [A, B, C] = perm(r, NAMES), liar = `${C} là kẻ nói dối`, honest = `${C} là người trung thực`;
      // Tỷ lệ 35% / 35% / 20% / 10% để đáp án kiểu "không xác định / không thể" không quá thường xuyên
      const forms = [
        { s: `${A} và ${C} cùng một loại người`, ans: liar, w: 7 },
        { s: `${A} và ${C} là hai loại người khác nhau`, ans: honest, w: 7 },
        { s: `${C} là người trung thực và ${A} là kẻ nói dối`, ans: 'Không xác định được', w: 4 },
        { s: `${A} là người trung thực`, ans: 'Không thể có tình huống này', w: 2 },
      ];
      const form = pick(r, forms.flatMap(f => Array(f.w).fill(f)));
      return { prompt: `Trên đảo có người trung thực (luôn nói thật) và kẻ nói dối (luôn nói dối). ${A} nói: “${B} là kẻ nói dối.” ${B} nói: “${form.s}.” Có thể kết luận gì về ${C}?`,
        options: [liar, honest, 'Không xác định được', 'Không thể có tình huống này'], answer: form.ans,
        explain: `Xét hai trường hợp ${A} trung thực / nói dối rồi kiểm tra câu nói của ${B}.` };
    } },

    // ───────── Ma trận hình (kiểu Raven, phương án nhiễu RAVEN-FAIR) ─────────
    { id: 'm1', domain: 'spatial', type: 'matrix', b: -2.0, a: 1.5, make: r => {
      const S = perm(r, SHAPES), f = pick(r, ['solid', 'gray']), gen = (rr, c) => ({ shape: S[rr], n: c + 1, fill: f });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ shape: SHAPES, n: [1, 2, 3, 4, 5], fill: [f, 'none'] })),
        explain: `Mỗi hàng một loại hình; số hình theo cột 1, 2, 3 → 3 ${SN[S[2]]}.` };
    } },
    { id: 'm2', domain: 'spatial', type: 'matrix', b: -1.2, a: 1.5, make: r => {
      const S = perm(r, SHAPES), F = perm(r, FILLS), gen = (rr, c) => ({ shape: S[c], fill: F[rr] });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ shape: SHAPES, fill: FILLS })),
        explain: `Hình theo cột, màu theo hàng → ${SN[S[2]]} màu ${FN[F[2]]}.` };
    } },
    { id: 'm3', domain: 'spatial', type: 'matrix', b: -0.3, a: 1.6, make: r => {
      const o = pick(r, [0, 90, 180, 270]), s = pick(r, [1, -1]), f = pick(r, ['solid', 'gray']), gen = (rr, c) => ({ shape: ARROW, rot: mod360(o + 90 * rr + 45 * c * s), fill: f });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ rot: ROTS })),
        explain: `Xoay 45° mỗi cột, mỗi hàng lệch 90° → ${DIR[gen(2, 2).rot]}.` };
    } },
    { id: 'm4', domain: 'spatial', type: 'matrix', b: 0.4, a: 1.6, make: r => {
      const S = perm(r, SHAPES), f = pick(r, ['solid', 'gray']), gen = (rr, c) => ({ shape: S[(rr + c) % 3], n: (rr + 2 * c) % 3 + 1, fill: f });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ shape: SHAPES, n: [1, 2, 3, 4] })),
        explain: `Mỗi hàng đủ 3 hình và đủ số lượng 1, 2, 3 → 1 ${SN[S[1]]}.` };
    } },
    { id: 'm5', domain: 'spatial', type: 'matrix', b: 0.6, a: 1.6, make: r => {
      const S = perm(r, SHAPES), rows = sumRows(r), f = pick(r, ['solid', 'gray']), gen = (rr, c) => ({ shape: S[rr], n: rows[rr][c], fill: f });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ shape: SHAPES, n: [1, 2, 3, 4, 5, 6] })),
        explain: `Cột 3 = cột 1 + cột 2: ${rows[2][0]} + ${rows[2][1]} = ${rows[2][2]} ${SN[S[2]]}.` };
    } },
    { id: 'm6', domain: 'spatial', type: 'matrix', b: 1.0, a: 1.6, make: r => {
      const O = perm(r, ['circle', 'square', 'diamond']), I = perm(r, ['circle', 'square', 'triangle']);
      const gen = (rr, c) => ({ shape: O[(rr + c) % 3], fill: 'none', inner: { shape: I[(2 * rr + c) % 3], fill: 'solid' } });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ shape: O, inner: [...I.map(s => ({ shape: s, fill: 'solid' })), undefined] })),
        explain: `Mỗi hàng đủ 3 hình ngoài và 3 hình trong → ${SN[O[1]]} chứa ${SN[I[0]]}.` };
    } },
    { id: 'm7', domain: 'spatial', type: 'matrix', b: 1.7, a: 1.7, make: r => ({
      ...lineMatrix(r, 'xor'), prompt: 'Gợi ý: hãy so sánh ô thứ ba của mỗi hàng với hai ô đầu.',
      explain: 'Cột 3 giữ các nét chỉ có ở MỘT trong hai cột đầu.',
    }) },
    { id: 'm8', domain: 'spatial', type: 'matrix', b: 2.2, a: 1.7, make: r => {
      const S = perm(r, SHAPES), F = perm(r, FILLS), gen = (rr, c) => ({ shape: S[(rr + c) % 3], fill: F[(2 * rr + c) % 3], n: c + 1 });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ shape: SHAPES, fill: FILLS, n: [1, 2, 3, 4] })),
        explain: `Mỗi hàng đủ 3 hình và 3 màu; số hình theo cột → 3 ${SN[S[1]]} màu ${FN[F[0]]}.` };
    } },
    { id: 'm9', domain: 'spatial', type: 'matrix', b: 2.9, a: 1.8, make: r => {
      const o = pick(r, [0, 90, 180, 270]), p = int(r, 0, 1), s = pick(r, [1, -1]), fill = i => ((i + p) % 2 ? 'solid' : 'none');
      const gen = (rr, c) => { const i = 3 * rr + c; return { shape: ARROW, rot: mod360(o + 45 * i * s), fill: fill(i) }; };
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ rot: ROTS, fill: ['none', 'solid'] })),
        explain: `Theo thứ tự đọc: xoay 45° ${s > 0 ? 'theo' : 'ngược'} chiều kim đồng hồ mỗi ô, màu xen kẽ → ${DIR[o]}, màu ${FN[fill(8)]}.` };
    } },
    { id: 'm10', domain: 'spatial', type: 'matrix', b: 2.4, a: 1.8, make: r => ({
      ...lineMatrix(r, 'and'), explain: 'Cột 3 chỉ giữ các nét có ở CẢ hai cột đầu.',
    }) },
    { id: 'm11', domain: 'spatial', type: 'matrix', b: 2.8, a: 1.8, make: r => {
      const o = pick(r, [0, 90, 180, 270]), s = pick(r, [1, -1]), f = pick(r, ['solid', 'gray']), gen = (rr, c) => ({ shape: ARROW, rot: mod360(o + 45 * (rr + 1) * c * s), fill: f });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ rot: ROTS })),
        explain: `Hàng 1 xoay 45°, hàng 2 90°, hàng 3 135° mỗi ô → ${DIR[gen(2, 2).rot]}.` };
    } },
    { id: 'm12', domain: 'spatial', type: 'matrix', b: 3.3, a: 1.9, make: r => {
      const S = perm(r, SHAPES), F = perm(r, FILLS), rows = sumRows(r);
      const gen = (rr, c) => ({ shape: S[(rr + c) % 3], fill: F[(rr + 2 * c) % 3], n: rows[rr][c] });
      return { gen, distractors: fairOptions(r, gen(2, 2), attrMutator({ shape: SHAPES, fill: FILLS, n: [1, 2, 3, 4, 5, 6] })),
        explain: `Latin hình và màu; cột 3 = cột 1 + cột 2 → ${rows[2][2]} ${SN[S[1]]} màu ${FN[F[0]]}.` };
    } },
  ];

  // Số phương án của mỗi khuôn (mọi biến thể có cùng số phương án) – dùng cho tham số đoán mò c = 1/k
  root.QUESTIONS.forEach(q => {
    const v = q.make(rng(1));
    q.k = q.type === 'matrix' ? v.distractors.length + 1 : v.options.length;
  });
  root.IQ_RNG = rng;
  root.IQ_CANON = canon;
})(typeof window !== 'undefined' ? window : globalThis);
