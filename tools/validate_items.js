/*
 * Kiểm tra tự động ngân hàng câu hỏi: ĐỘ CHÍNH XÁC và SAI LỆCH.
 *
 *    node tools/validate_items.js            # mặc định 3000 biến thể / khuôn, 3000 bộ đề
 *    node tools/validate_items.js --n 10000 --forms 5000
 *
 * 1. Độ chính xác – với mỗi biến thể, một bộ giải ĐỘC LẬP chỉ đọc nội dung hiển thị cho người làm
 *    (dãy số, câu chữ, các ô ma trận) rồi tự tìm đáp án; không dùng tham số lúc sinh câu.
 *    Câu logic được giải bằng vét cạn (bảng chân trị, hoán vị, mọi số 2 chữ số…).
 *    Dãy số còn được thử với nhiều quy luật phổ biến khác: nếu một quy luật khác cũng khớp dãy
 *    và cho ra một phương án nhiễu → đề MƠ HỒ.
 * 2. Sai lệch – đo các "mẹo đoán" mà người làm có thể khai thác:
 *    vị trí đáp án (A/B/C…), giá trị đáp án lặp lại, thứ hạng đáp án số, đáp án dài nhất,
 *    phương án "không xác định" luôn sai, ma trận "phương án giống nhiều phương án khác nhất".
 * Thoát với mã 1 nếu có lỗi.
 */
'use strict';
const path = require('path');
global.window = globalThis;
require(path.join(__dirname, '..', 'js', 'questions.js'));
require(path.join(__dirname, '..', 'js', 'form.js'));

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : def; };
const N = arg('--n', 3000), FORMS = arg('--forms', 3000);
const Q = QUESTIONS, canon = IQ_CANON;
const errors = [], warnings = [];
const err = (id, msg) => { if (errors.filter(e => e.startsWith(id + ':')).length < 5) errors.push(`${id}: ${msg}`); };
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

// ═════════ 1. Bộ giải độc lập ═════════

// ── Dãy số: các quy luật phổ biến. Mỗi hàm trả về số tiếp theo, hoặc null nếu quy luật không khớp. ──
const diffs = s => s.slice(1).map((x, i) => x - s[i]);
const allEq = a => a.length > 0 && a.every(x => x === a[0]);
const RULES = {
  arith: s => (allEq(diffs(s)) ? s[s.length - 1] + diffs(s)[0] : null),
  geom: s => { if (s.some(x => x === 0)) return null; const r = s[1] / s[0]; return Number.isInteger(r) && r > 1 && s.every((x, i) => i === 0 || x === s[i - 1] * r) ? s[s.length - 1] * r : null; },
  poly2: s => { const d = diffs(s), dd = diffs(d); return s.length >= 4 && allEq(dd) ? s[s.length - 1] + d[d.length - 1] + dd[0] : null; },
  poly3: s => { const d = diffs(s), dd = diffs(d), ddd = diffs(dd); return s.length >= 5 && allEq(ddd) ? s[s.length - 1] + d[d.length - 1] + dd[dd.length - 1] + ddd[0] : null; },
  fib: s => (s.length >= 4 && s.every((x, i) => i < 2 || x === s[i - 1] + s[i - 2]) ? s[s.length - 1] + s[s.length - 2] : null),
  altdiff: s => { const d = diffs(s); return d.length >= 4 && !allEq(d) && d.every((x, i) => i < 2 || x === d[i - 2]) ? s[s.length - 1] + d[d.length - 2] : null; },
  interleave: s => {
    if (s.length < 6) return null;
    const odd = s.filter((_, i) => i % 2 === 0), even = s.filter((_, i) => i % 2 === 1);
    if (!allEq(diffs(odd)) || !allEq(diffs(even)) || allEq(diffs(s))) return null;
    return s.length % 2 === 0 ? odd[odd.length - 1] + diffs(odd)[0] : even[even.length - 1] + diffs(even)[0];
  },
  linrec: s => {
    for (const m of [2, 3]) { const c = s[1] - m * s[0]; if (s.length >= 4 && s.every((x, i) => i === 0 || x === m * s[i - 1] + c)) return m * s[s.length - 1] + c; }
    return null;
  },
  linrecN: s => {
    for (const m of [2, 3]) { const rr = s.slice(1).map((x, i) => x - m * s[i]); if (s.length >= 5 && allEq(diffs(rr)) && !allEq(rr)) return m * s[s.length - 1] + rr[rr.length - 1] + diffs(rr)[0]; }
    return null;
  },
  squares: s => { const k = Math.sqrt(s[0]); return Number.isInteger(k) && s.every((x, i) => x === (k + i) ** 2) ? (k + s.length) ** 2 : null; },
  sqdiff: s => { const d = diffs(s), k = Math.sqrt(d[0]); return Number.isInteger(k) && d.every((x, i) => x === (k + i) ** 2) ? s[s.length - 1] + (k + d.length) ** 2 : null; },
  sqpar: s => {
    for (let k = 1; k <= 12; k++) {
      const e = s.map((x, i) => x - (k + i) ** 2);
      if (e[0] !== 0 && e[0] === -e[1] && e.every((x, i) => i < 2 || x === e[i - 2])) return (k + s.length) ** 2 + e[s.length - 2];
    }
    return null;
  },
};
const INTENDED = { n1: 'arith', n2: 'geom', n3: 'squares', n4: 'poly2', n5: 'altdiff', n6: 'linrec', n7: 'fib', n8: 'interleave', n9: 'poly3', n10: 'sqdiff', n11: 'linrecN', n12: 'sqpar' };

function checkSeries(q, v) {
  const preds = {};
  for (const [name, fn] of Object.entries(RULES)) { const p = fn(v.seq); if (p !== null) preds[name] = p; }
  const rule = INTENDED[q.id];
  if (!(rule in preds)) return err(q.id, `quy luật ${rule} không khớp dãy ${v.seq}`);
  if (preds[rule] !== v.answer) return err(q.id, `dãy ${v.seq}: bộ giải ra ${preds[rule]}, đáp án ghi ${v.answer}`);
  for (const [name, p] of Object.entries(preds)) {
    if (p !== v.answer && v.options.includes(p)) err(q.id, `MƠ HỒ: dãy ${v.seq} theo quy luật ${name} ra ${p}, cũng là một phương án`);
  }
}

// ── Logic: giải từ câu chữ ──
const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
const UNKNOWN = 'Không xác định được';
const num = s => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
const permutations = a => (a.length <= 1 ? [a] : a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));

const LOGIC = {
  l1: v => {
    const m = v.prompt.match(/^(\S+) (.+?) (\S+)\. (\S+) (.+?) (\S+)\. Ai (.+)\?$/);
    const gt = new Set([`${m[1]}>${m[3]}`, `${m[4]}>${m[6]}`]);
    const people = [...new Set([m[1], m[3], m[4], m[6]])];
    for (const a of people) for (const b of people) for (const c of people) if (gt.has(`${a}>${b}`) && gt.has(`${b}>${c}`)) gt.add(`${a}>${c}`);
    const isMin = /thấp nhất|nhẹ nhất|ít tuổi nhất/.test(m[7]);
    const winners = people.filter(x => people.every(y => y === x || gt.has(isMin ? `${y}>${x}` : `${x}>${y}`)));
    return winners.length === 1 ? winners[0] : UNKNOWN;
  },
  l2: v => {
    const m = v.prompt.match(/Nếu (hôm qua|ngày mai) là (.+?) thì (ngày kia|hôm kia)/);
    const i = DAYS.indexOf(m[2]), today = m[1] === 'hôm qua' ? i + 1 : i - 1, t = m[3] === 'ngày kia' ? today + 2 : today - 2;
    return DAYS[(t % 7 + 7) % 7];
  },
  l3: v => `${v.prompt.match(/^(\d+) máy/)[1]} phút`,
  l4: v => String(Number(v.prompt.match(/gồm (\d+) màu/)[1]) + 1),
  l5: v => {
    const [, x, y, p2] = v.prompt.match(/^Giả sử: Tất cả (.+?) đều là (.+?)\. (.+?)\. Kết luận/);
    let m;
    if ((m = p2.match(new RegExp(`^Tất cả ${y} đều (.+)$`)))) return `Tất cả ${x} đều ${m[1]}`;
    if ((m = p2.match(new RegExp(`^Không có ${y} nào (.+)$`)))) return `Không có ${x} nào ${m[1]}`;
    if (p2.startsWith(`Một số ${y} `)) return v.options.find(o => /^(Không kết luận được|Chưa đủ thông tin)/.test(o));
    return 'không đọc được tiền đề';
  },
  l6: v => {
    const [t, d] = [...v.prompt.matchAll(/([\d.]+)đ/g)].map(x => num(x[1]));
    return String((t - d) / 2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  },
  l7: v => {
    const s = Number(v.prompt.match(/bằng (\d+)/)[1]), D = Number(v.prompt.match(/hơn số cũ (\d+)/)[1]), sol = [];
    for (let x = 10; x <= 99; x++) { const a = Math.floor(x / 10), b = x % 10; if (a + b === s && 10 * b + a - x === D) sol.push(String(x)); }
    return sol.length === 1 ? sol[0] : `${sol.length} nghiệm`;
  },
  l8: v => {
    const stmt = v.prompt.match(/A nói: “(.+?)”/)[1];
    const P = {
      'Ít nhất một trong hai chúng tôi là kẻ nói dối.': (A, B) => !A || !B,
      'Cả hai chúng tôi đều là kẻ nói dối.': (A, B) => !A && !B,
      'B trung thực, còn tôi là kẻ nói dối.': (A, B) => B && !A,
      'Tôi là người trung thực.': A => A,
    }[stmt];
    const worlds = [];
    for (const A of [true, false]) for (const B of [true, false]) if (P(A, B) === A) worlds.push([A, B]);
    if (worlds.length !== 1) return UNKNOWN;
    const [A, B] = worlds[0];
    return A && B ? 'Cả hai đều trung thực' : !A && !B ? 'Cả hai đều nói dối' : A ? 'A trung thực, B nói dối' : 'A nói dối, B trung thực';
  },
  l9: v => {
    // Vét cạn: mọi cách xếp nội dung sao cho nhãn nào cũng sai; hộp nào lấy 1 món là đủ xác định?
    const labels = [...v.prompt.matchAll(/“([^”]+)”/g)].map(x => x[1]).slice(0, 3);
    const [a, b, ab] = labels, perms = permutations([a, b, ab]).filter(p => p.every((c, i) => c !== labels[i]));
    const draws = c => (c === ab ? [a, b] : [c]);
    const ok = labels.filter((_, i) => [a, b].every(d => perms.filter(p => draws(p[i]).includes(d)).length <= 1));
    return ok.length === 1 ? `Hộp nhãn “${ok[0]}”` : 'Không thể chỉ với 1 lần lấy';
  },
  l10: v => {
    const [, h, m] = v.prompt.match(/chỉ (\d+) giờ (\d+) phút/).map(Number);
    let x = Math.abs((30 * h + m / 2) - 6 * m) % 360; if (x > 180) x = 360 - x;
    return String(x).replace('.', ',') + '°';
  },
  l11: v => {
    const [, names, jobs] = v.prompt.match(/^(.+?) làm ba nghề khác nhau: (.+?)\. Biết/);
    const P = names.split(', '), J = jobs.split(', ');
    const c1 = v.prompt.match(/\(1\) Người (.+?) nhỏ tuổi nhất/)[1];
    const c2 = v.prompt.match(/\(\d\) (\S+) lớn tuổi hơn người (.+?)\./);
    const [, c3p, c3j, , c3q] = v.prompt.match(/\(\d\) (\S+) không phải (.+?) và (\S+) nhỏ tuổi hơn (\S+)\./);
    const ask = v.prompt.match(/Ai là (.+)\?$/)[1], holders = new Set();
    for (const jp of permutations(J)) for (const ages of permutations([0, 1, 2])) {
      const job = Object.fromEntries(P.map((p, i) => [p, jp[i]])), age = Object.fromEntries(P.map((p, i) => [p, ages[i]]));
      const who = j => P.find(p => job[p] === j);
      if (Math.min(...P.map(p => age[p])) !== age[who(c1)]) continue;
      if (c2 && !(age[c2[1]] > age[who(c2[2])])) continue;
      if (job[c3p] === c3j || !(age[c3p] < age[c3q])) continue;
      holders.add(who(ask));
    }
    return holders.size === 1 ? [...holders][0] : UNKNOWN;
  },
  l12: v => { const n = Number(v.prompt.match(/^Có (\d+) đồng/)[1]); let k = 0; while (3 ** k < n) k++; return String(k); },
  l13: v => {
    const [, A, B] = v.prompt.match(/\)\. (\S+) nói: “(\S+) là kẻ nói dối\.”/);
    const C = v.prompt.match(/kết luận gì về (\S+)\?/)[1];
    const sB = v.prompt.match(new RegExp(`${B} nói: “(.+?)\\.”`))[1];
    const P = {
      [`${A} và ${C} cùng một loại người`]: (a, c) => a === c,
      [`${A} và ${C} là hai loại người khác nhau`]: (a, c) => a !== c,
      [`${C} là người trung thực và ${A} là kẻ nói dối`]: (a, c) => c && !a,
      [`${A} là người trung thực`]: a => a,
    }[sB];
    const cs = new Set();
    for (const a of [true, false]) for (const bb of [true, false]) for (const c of [true, false]) {
      if (a !== !bb) continue;
      if (bb !== P(a, c)) continue;
      cs.add(c);
    }
    if (cs.size === 0) return 'Không thể có tình huống này';
    if (cs.size > 1) return UNKNOWN;
    return [...cs][0] ? `${C} là người trung thực` : `${C} là kẻ nói dối`;
  },
};

// ── Ma trận: suy ra ô thiếu từ 8 ô hiển thị ──
const missing = (all, have) => all.filter(x => !have.includes(x));
const sortL = a => a.slice().sort();
const xorL = (A, B) => sortL([...A.filter(x => !B.includes(x)), ...B.filter(x => !A.includes(x))]);
const andL = (A, B) => sortL(A.filter(x => B.includes(x)));
const unionL = (A, B) => sortL([...new Set([...A, ...B])]);
const eqL = (A, B) => sortL(A).join() === sortL(B).join();
const m360 = x => ((x % 360) + 360) % 360;
function lineRule(c, op, id) {
  const f = op === 'xor' ? xorL : andL;
  for (const r of [0, 1]) {
    if (!eqL(c(r, 2).lines, f(c(r, 0).lines, c(r, 1).lines))) err(id, `hàng ${r + 1} không theo quy luật ${op}`);
    if (op === 'xor' && eqL(c(r, 2).lines, andL(c(r, 0).lines, c(r, 1).lines))) err(id, 'MƠ HỒ: hàng mẫu cũng khớp quy luật AND');
    if (op === 'and' && eqL(c(r, 2).lines, xorL(c(r, 0).lines, c(r, 1).lines))) err(id, 'MƠ HỒ: hàng mẫu cũng khớp quy luật XOR');
  }
  const unionOk = [0, 1].every(r => eqL(c(r, 2).lines, unionL(c(r, 0).lines, c(r, 1).lines)));
  if (unionOk) err(id, 'MƠ HỒ: hàng mẫu cũng khớp quy luật hợp (OR)');
  return { lines: f(c(2, 0).lines, c(2, 1).lines) };
}
const MATRIX = {
  m1: c => ({ shape: c(2, 0).shape, n: c(0, 2).n, fill: c(0, 0).fill }),
  m2: c => ({ shape: c(0, 2).shape, fill: c(2, 0).fill }),
  m3: c => ({ shape: 'arrow', rot: m360(c(2, 1).rot + (c(0, 1).rot - c(0, 0).rot)), fill: c(0, 0).fill }),
  m4: c => ({ shape: missing([0, 1, 2].map(i => c(0, i).shape), [c(2, 0).shape, c(2, 1).shape])[0], n: missing([1, 2, 3], [c(2, 0).n, c(2, 1).n])[0], fill: c(0, 0).fill }),
  m5: c => ({ shape: c(2, 0).shape, n: c(2, 0).n + c(2, 1).n, fill: c(0, 0).fill }),
  m6: c => ({ shape: missing([0, 1, 2].map(i => c(0, i).shape), [c(2, 0).shape, c(2, 1).shape])[0], fill: 'none',
    inner: { shape: missing([0, 1, 2].map(i => c(0, i).inner.shape), [c(2, 0).inner.shape, c(2, 1).inner.shape])[0], fill: 'solid' } }),
  m7: (c, id) => lineRule(c, 'xor', id),
  m8: c => ({ shape: missing([0, 1, 2].map(i => c(0, i).shape), [c(2, 0).shape, c(2, 1).shape])[0],
    fill: missing([0, 1, 2].map(i => c(0, i).fill), [c(2, 0).fill, c(2, 1).fill])[0], n: c(0, 2).n }),
  m9: c => ({ shape: 'arrow', rot: m360(2 * c(2, 1).rot - c(2, 0).rot), fill: c(2, 0).fill }),
  m10: (c, id) => lineRule(c, 'and', id),
  m11: c => ({ shape: 'arrow', rot: m360(c(2, 1).rot + (c(2, 1).rot - c(2, 0).rot)), fill: c(0, 0).fill }),
  m12: c => ({ shape: missing([0, 1, 2].map(i => c(0, i).shape), [c(2, 0).shape, c(2, 1).shape])[0],
    fill: missing([0, 1, 2].map(i => c(0, i).fill), [c(2, 0).fill, c(2, 1).fill])[0], n: c(2, 0).n + c(2, 1).n }),
};
// Kiểm tra quy luật trên các hàng mẫu (không chỉ ô cần tìm)
const MATRIX_ROWS = {
  m1: c => [0, 1, 2].every(r => c(r, 0).shape === c(r, 1).shape) && [0, 1].every(r => [0, 1, 2].every(k => c(r, k).n === k + 1)),
  m3: c => { const s = m360(c(0, 1).rot - c(0, 0).rot); return [0, 1].every(r => m360(c(r, 1).rot - c(r, 0).rot) === s && m360(c(r, 2).rot - c(r, 1).rot) === s); },
  m4: c => [0, 1].every(r => new Set([0, 1, 2].map(k => c(r, k).shape)).size === 3 && new Set([0, 1, 2].map(k => c(r, k).n)).size === 3),
  m5: c => [0, 1].every(r => c(r, 2).n === c(r, 0).n + c(r, 1).n),
  m8: c => [0, 1].every(r => new Set([0, 1, 2].map(k => c(r, k).shape)).size === 3 && new Set([0, 1, 2].map(k => c(r, k).fill)).size === 3),
  m9: c => { const s = m360(c(0, 1).rot - c(0, 0).rot); return (s === 45 || s === 315) && [1, 2, 3, 4, 5, 6, 7].every(i => m360(c(Math.floor(i / 3), i % 3).rot - c(Math.floor((i - 1) / 3), (i - 1) % 3).rot) === s); },
  m11: c => [0, 1].every(r => m360(c(r, 1).rot - c(r, 0).rot) === m360(c(r, 2).rot - c(r, 1).rot)),
  m12: c => [0, 1].every(r => c(r, 2).n === c(r, 0).n + c(r, 1).n && new Set([0, 1, 2].map(k => c(r, k).fill)).size === 3),
};

// ═════════ 2. Thống kê sai lệch ═════════
const isUnknownOpt = o => /không xác định|không kết luận|chưa đủ thông tin|không thể/i.test(o);
function attrsOf(o) { return o.lines ? Object.fromEntries(['top', 'bottom', 'left', 'right', 'h', 'v', 'd1', 'd2'].map(k => [k, o.lines.includes(k)])) : { shape: o.shape, n: o.n || 1, fill: o.fill, rot: o.rot || 0, inner: o.inner ? o.inner.shape : '-' }; }
// Chiến lược "chọn phương án có nhiều thuộc tính trùng với các phương án khác nhất" (least = chọn phương án KHÁC nhất)
function modeStrategyHit(opts, least = false) {
  const A = opts.map(attrsOf), score = A.map((a, i) => A.reduce((s, b, j) => s + (i === j ? 0 : Object.keys(a).filter(k => a[k] === b[k]).length), 0));
  const best = least ? Math.min(...score) : Math.max(...score), tied = score.map((s, i) => (s === best ? i : -1)).filter(i => i >= 0);
  return tied.includes(0) ? 1 / tied.length : 0;
}
// Chiến lược với đáp án số: chọn số "ở giữa" (tổng khoảng cách nhỏ nhất)
function medoidHit(nums) {
  const score = nums.map(x => nums.reduce((s, y) => s + Math.abs(x - y), 0)), best = Math.min(...score);
  const tied = score.map((s, i) => (s === best ? i : -1)).filter(i => i >= 0);
  return tied.includes(0) ? 1 / tied.length : 0;
}

const report = [];
for (const q of Q) {
  const st = { variants: new Set(), answers: new Map(), rank: [], longest: 0, textN: 0, unknownShown: 0, unknownRight: 0, mode: 0, antiMode: 0, medoid: 0, numN: 0 };
  for (let seed = 1; seed <= N; seed++) {
    let v;
    try { v = q.make(IQ_RNG(seed * 2654435761 >>> 0)); } catch (e) { err(q.id, `lỗi khi sinh (seed ${seed}): ${e.message}`); continue; }

    if (q.type === 'matrix') {
      const ans = v.gen(2, 2), opts = [ans, ...v.distractors];
      const cell = (r, c) => v.gen(r, c);
      st.variants.add([0, 1, 2, 3, 4, 5, 6, 7].map(i => canon(cell(Math.floor(i / 3), i % 3))).join('|'));
      if (opts.length !== q.k) err(q.id, `số phương án ${opts.length} ≠ ${q.k}`);
      if (new Set(opts.map(canon)).size !== opts.length) err(q.id, 'có phương án trùng nhau');
      for (const o of opts) {
        if (o.lines ? !o.lines.length : !['circle', 'square', 'triangle', 'diamond', 'star', 'arrow'].includes(o.shape)) err(q.id, `phương án không hợp lệ ${canon(o)}`);
        if (o.n && (o.n < 1 || o.n > 6)) err(q.id, `số hình ${o.n} ngoài 1..6`);
      }
      try {
        const expected = MATRIX[q.id](cell, q.id);
        if (canon(expected) !== canon(ans)) err(q.id, `bộ giải ra ${canon(expected)}, đáp án ghi ${canon(ans)}`);
        if (MATRIX_ROWS[q.id] && !MATRIX_ROWS[q.id](cell)) err(q.id, 'hàng mẫu không theo quy luật');
      } catch (e) { err(q.id, `bộ giải lỗi: ${e.message}`); }
      st.mode += modeStrategyHit(opts);
      st.antiMode += modeStrategyHit(opts, true);
      st.answers.set(canon(ans), (st.answers.get(canon(ans)) || 0) + 1);
      continue;
    }

    const opts = v.options.map(String), ans = String(v.answer);
    st.variants.add(`${v.prompt}|${v.seq || ''}|${ans}`);
    if (opts.length !== q.k) err(q.id, `số phương án ${opts.length} ≠ ${q.k}`);
    if (new Set(opts).size !== opts.length) err(q.id, `phương án trùng: ${opts}`);
    if (!opts.includes(ans)) err(q.id, `đáp án ${ans} không nằm trong phương án`);
    if (opts.some(o => !o.trim())) err(q.id, 'có phương án rỗng');

    try {
      if (v.seq) checkSeries(q, v);
      else if (LOGIC[q.id]) { const exp = LOGIC[q.id](v); if (exp !== ans) err(q.id, `bộ giải ra “${exp}”, đáp án ghi “${ans}” — ${v.prompt}`); }
    } catch (e) { err(q.id, `bộ giải không đọc được đề: ${e.message} — ${v.prompt}`); }

    st.answers.set(ans, (st.answers.get(ans) || 0) + 1);
    const nums = opts.map(num);
    if (opts.every(o => /^[\d.,]+(đ|°| phút)?$/.test(o))) {
      st.numN++;
      st.rank.push(nums.filter(x => x < num(ans)).length);
      st.medoid += medoidHit([num(ans), ...nums.filter((_, i) => opts[i] !== ans)]);
    } else {
      st.textN++;
      const len = opts.map(o => o.length), maxLen = Math.max(...len);
      if (ans.length === maxLen && len.filter(l => l === maxLen).length === 1) st.longest++;
    }
    const unk = opts.find(isUnknownOpt);
    if (unk) { st.unknownShown++; if (unk === ans) st.unknownRight++; }
  }

  // ── Đánh giá sai lệch của khuôn ──
  const k = q.k, row = { id: q.id, variants: st.variants.size };
  const topShare = Math.max(0, ...[...st.answers.entries()].filter(([a]) => !isUnknownOpt(a)).map(([, c]) => c)) / N;
  const unkShare = [...st.answers.entries()].filter(([a]) => isUnknownOpt(a)).reduce((sum, [, c]) => sum + c, 0) / N;
  if (unkShare > 0.4) err(q.id, `đáp án "không xác định" chiếm ${(unkShare * 100).toFixed(0)}% – quá thường xuyên`);
  row.topAnswer = topShare;
  const poolLike = st.variants.size <= 12;
  const topLimit = poolLike ? 2.5 / st.variants.size : 0.25;
  if (topShare > topLimit) err(q.id, `một giá trị đáp án chiếm ${(topShare * 100).toFixed(1)}% số biến thể`);
  if (st.numN) {
    const hist = Array(k).fill(0); st.rank.forEach(x => hist[x]++);
    const maxRank = Math.max(...hist) / st.numN; row.rank = hist.map(x => Math.round((x / st.numN) * 100)).join('/');
    if (maxRank > 0.45) err(q.id, `đáp án số thường đứng ở cùng một thứ hạng (${row.rank}%)`); else if (maxRank > 0.35) warn(q.id, `thứ hạng đáp án hơi lệch (${row.rank}%)`);
    row.medoid = st.medoid / st.numN;
    if (row.medoid > 1 / k + 0.2) err(q.id, `mẹo "chọn số ở giữa" đúng ${(row.medoid * 100).toFixed(0)}%`); else if (row.medoid > 1 / k + 0.1) warn(q.id, `mẹo "chọn số ở giữa" đúng ${(row.medoid * 100).toFixed(0)}%`);
  }
  if (st.textN) {
    row.longest = st.longest / st.textN;
    if (row.longest > 1 / k + 0.25) err(q.id, `đáp án là phương án dài nhất ${(row.longest * 100).toFixed(0)}%`); else if (row.longest > 1 / k + 0.15) warn(q.id, `đáp án là phương án dài nhất ${(row.longest * 100).toFixed(0)}%`);
  }
  if (q.type === 'matrix') {
    row.mode = st.mode / N;
    if (row.mode > 1 / k + 0.2) err(q.id, `mẹo "chọn hình giống các hình khác nhất" đúng ${(row.mode * 100).toFixed(0)}%`); else if (row.mode > 1 / k + 0.1) warn(q.id, `mẹo "chọn hình giống nhất" đúng ${(row.mode * 100).toFixed(0)}%`);
    row.antiMode = st.antiMode / N;
    if (row.antiMode > 1 / k + 0.2) err(q.id, `mẹo "chọn hình khác các hình còn lại nhất" đúng ${(row.antiMode * 100).toFixed(0)}%`); else if (row.antiMode > 1 / k + 0.1) warn(q.id, `mẹo "chọn hình khác nhất" đúng ${(row.antiMode * 100).toFixed(0)}%`);
  }
  if (st.unknownShown) row.unknown = st.unknownRight / st.unknownShown;
  report.push(row);
}

// Phương án kiểu "không xác định" trên toàn bộ ngân hàng: không được luôn sai (hoặc luôn đúng)
const unkRows = report.filter(r => r.unknown !== undefined);
const unkRate = unkRows.reduce((s, r) => s + r.unknown, 0) / unkRows.length;
if (unkRate < 0.1) err('ALL', `phương án "không xác định/không kết luận" gần như luôn sai (${(unkRate * 100).toFixed(0)}%) – người làm sẽ học được mẹo loại nó`);

// ═════════ 3. Kiểm tra bộ đề hoàn chỉnh (vị trí A/B/C…, lặp giá trị, lặp biến thể) ═════════
const LET = 'ABCDEF';
const posCount = {}, posExp = {}, valueCount = new Map();
let worstSpread = 0, worstRun = 0, formsRepeatValue = 0, itemsTotal = 0;
for (let f = 0; f < FORMS; f++) {
  const { items } = IQForm.build({ rand: IQ_RNG(1e6 + f) });
  const counts = [0, 0, 0, 0];
  let run = 1, prev = -1;
  const values = new Map();
  items.forEach(it => {
    const pos = it.order.indexOf(it.correct);
    posCount[`${it.k}:${pos}`] = (posCount[`${it.k}:${pos}`] || 0) + 1;
    posExp[it.k] = (posExp[it.k] || 0) + 1;
    if (pos < 4) counts[pos]++;
    run = pos === prev ? run + 1 : 1; prev = pos; worstRun = Math.max(worstRun, run);
    if (it.type !== 'matrix') {
      const label = it.opts.find(o => o.key === it.correct).label;
      if (/\d/.test(label)) { values.set(label, (values.get(label) || 0) + 1); valueCount.set(label, (valueCount.get(label) || 0) + 1); }
    }
    itemsTotal++;
  });
  worstSpread = Math.max(worstSpread, Math.max(...counts) - Math.min(...counts));
  if ([...values.values()].some(x => x >= 3)) formsRepeatValue++;
}
for (const [kk, total] of Object.entries(posExp)) {
  for (let p = 0; p < Number(kk); p++) {
    const share = (posCount[`${kk}:${p}`] || 0) / total;
    if (Math.abs(share - 1 / kk) > 0.03) err('FORM', `câu ${kk} phương án: đáp án ở vị trí ${LET[p]} chiếm ${(share * 100).toFixed(1)}% (kỳ vọng ${(100 / kk).toFixed(1)}%)`);
  }
}
if (worstSpread > 4) err('FORM', `trong một bộ đề, số đáp án A/B/C/D chênh nhau tới ${worstSpread}`);
if (worstRun > 2) err('FORM', `có bộ đề với ${worstRun} câu liên tiếp cùng vị trí đáp án`);
if (formsRepeatValue / FORMS > 0.01) err('FORM', `${(formsRepeatValue / FORMS * 100).toFixed(1)}% bộ đề có một đáp án số lặp lại ≥ 3 lần`);
const topValues = [...valueCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

// Người dùng làm lại 3 lần liên tiếp: có gặp lại đúng biến thể cũ không?
let repeats = 0, repeatChecks = 0;
for (let u = 0; u < 300; u++) {
  let seen = {}; const met = {};
  for (let t = 0; t < 3; t++) {
    const out = IQForm.build({ rand: IQ_RNG(5e6 + u * 7 + t), seen });
    seen = out.seen;
    out.items.forEach(it => {
      const key = IQForm.variantKey(it, { ...it, answer: it.type === 'matrix' ? '' : it.opts.find(o => o.key === it.correct).label });
      met[it.id] = met[it.id] || new Set();
      if (t > 0) { repeatChecks++; if (met[it.id].has(key)) repeats++; }
      met[it.id].add(key);
    });
  }
}
if (repeats > 0) err('FORM', `làm lại 3 lần vẫn gặp lại ${repeats}/${repeatChecks} câu y hệt`);

// ═════════ In kết quả ═════════
const pct = x => (x === undefined ? '' : `${(x * 100).toFixed(0)}%`);
console.log(`Ngân hàng ${QUESTION_BANK_VERSION}: ${Q.length} khuôn × ${N} biến thể, ${FORMS} bộ đề\n`);
console.log('Khuôn  Biến thể  Đáp án phổ biến nhất  Thứ hạng đáp án số (%)  Mẹo số giữa  Dài nhất  Mẹo hình giống/khác nhất  "Không xác định" đúng');
for (const r of report) {
  console.log(`${r.id.padEnd(6)} ${String(r.variants).padStart(8)}  ${pct(r.topAnswer).padStart(19)}  ${(r.rank || '').padStart(22)}  ${pct(r.medoid).padStart(11)}  ${pct(r.longest).padStart(8)}  ${(r.mode === undefined ? '' : `${pct(r.mode)} / ${pct(r.antiMode)}`).padStart(24)}  ${pct(r.unknown).padStart(20)}`);
}
console.log(`\nVị trí đáp án (toàn bộ bộ đề): ${Object.entries(posExp).map(([kk, t]) => `${kk} phương án: ${[...Array(Number(kk)).keys()].map(p => `${LET[p]} ${(((posCount[`${kk}:${p}`] || 0) / t) * 100).toFixed(1)}%`).join(' ')}`).join(' | ')}`);
console.log(`Trong 1 bộ đề: chênh lệch A/B/C/D lớn nhất ${worstSpread}, chuỗi cùng vị trí dài nhất ${worstRun}, bộ đề có đáp án số lặp ≥3 lần: ${formsRepeatValue}/${FORMS}`);
console.log(`Đáp án số xuất hiện nhiều nhất (trên ${itemsTotal} câu): ${topValues.map(([v, c]) => `${v} (${(c / itemsTotal * 100).toFixed(2)}%)`).join(', ')}`);
console.log(`Làm lại 3 lần: gặp lại câu y hệt ${repeats}/${repeatChecks}`);
console.log(`Phương án "không xác định/không kết luận" là đáp án đúng: ${(unkRate * 100).toFixed(0)}% số lần xuất hiện`);
if (warnings.length) console.log(`\nCẢNH BÁO (${warnings.length}):\n  ` + warnings.join('\n  '));
if (errors.length) { console.log(`\nLỖI (${errors.length}):\n  ` + errors.join('\n  ')); process.exit(1); }
console.log('\nKHÔNG CÓ LỖI.');
