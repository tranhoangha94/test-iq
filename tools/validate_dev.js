/*
 * Kiểm tra tự động ngân hàng câu hỏi THUẬT TOÁN (js/dev/questions.js).
 *
 *    node tools/validate_dev.js                 # 2000 biến thể / khuôn, 2000 bộ đề, đối chiếu Python 60 mẫu / khuôn
 *    node tools/validate_dev.js --n 5000 --forms 5000 --py 150
 *
 * 1. Độ chính xác
 *    - Câu "đoạn code in ra gì": CHẠY THẬT code JavaScript, so kết quả in ra với đáp án.
 *    - Câu độ phức tạp: chạy f(n) với nhiều n, đo số thao tác và tìm lớp độ phức tạp khớp nhất.
 *    - Câu bằng lời (heap, BST, đồ thị): bộ giải độc lập đọc đề và tự tính.
 *    - Đối chiếu Python: chạy bản Python của cùng đoạn code (python3/python) – phải in ra y hệt bản JS.
 * 2. Sai lệch: vị trí đáp án, giá trị đáp án lặp lại, thứ hạng đáp án số, đáp án dài nhất.
 * Thoát với mã 1 nếu có lỗi.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
global.window = globalThis;
require(path.join(__dirname, '..', 'js', 'dev', 'questions.js'));
require(path.join(__dirname, '..', 'js', 'questions.js')); // cung cấp IQ_CANON cho form.js
require(path.join(__dirname, '..', 'js', 'form.js'));

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : def; };
const N = arg('--n', 2000), FORMS = arg('--forms', 2000), PY = arg('--py', 60);
const Q = DEV_QUESTIONS;
const errors = [], warnings = [];
const err = (id, msg) => { if (errors.filter(e => e.startsWith(id + ':')).length < 5) errors.push(`${id}: ${msg}`); };
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

// ═════════ Chạy code JS ═════════
function runJs(code) {
  const out = [];
  new Function('console', code)({ log: (...a) => out.push(a.join(' ')) });
  return out.join('\n');
}
function jsFn(code) { return new Function(`${code}\nreturn f;`)(); }

// Lớp độ phức tạp thực nghiệm của f(n) (f trả về số thao tác)
const CANDS = {
  'O(1)': () => 1, 'O(log n)': n => Math.log2(n), 'O(√n)': n => Math.sqrt(n), 'O(n)': n => n,
  'O(n log n)': n => n * Math.log2(n), 'O(n²)': n => n * n,
};
function measureClass(f) {
  if (f(18) / f(12) > 40) return 'O(2ⁿ)'; // tăng gấp ~64 khi n + 6 → hàm mũ
  const ns = [256, 512, 1024, 2048, 4096], counts = ns.map(n => f(n));
  let best = null, bestCv = Infinity;
  for (const [name, g] of Object.entries(CANDS)) {
    const ratio = ns.map((n, i) => counts[i] / g(n)), mean = ratio.reduce((s, x) => s + x, 0) / ratio.length;
    const cv = Math.sqrt(ratio.reduce((s, x) => s + (x - mean) ** 2, 0) / ratio.length) / mean;
    if (cv < bestCv) { bestCv = cv; best = name; }
  }
  return best;
}

// ═════════ Bộ giải độc lập cho câu bằng lời ═════════
const nums = s => (s.match(/\d+/g) || []).map(Number);
const edgesOf = text => [...text.matchAll(/(\d+)–(\d+)(?: \((\d+)\))?/g)].map(m => [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 1]);
function adjOf(n, E) { const adj = Array.from({ length: n }, () => []); E.forEach(([a, b, w]) => { adj[a].push([b, w]); adj[b].push([a, w]); }); adj.forEach(l => l.sort((x, y) => x[0] - y[0])); return adj; }
const SOLVE = {
  d4: v => {
    const a = nums(v.prompt.match(/các số (.+?) vào/)[1]), isMin = v.prompt.includes('min-heap');
    // Mô phỏng heap nhị phân thật (không dùng sort) để kiểm tra độc lập
    const h = [], less = (x, y) => (isMin ? x < y : x > y);
    const push = x => { h.push(x); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!less(h[i], h[p])) break; [h[i], h[p]] = [h[p], h[i]]; i = p; } };
    const pop = () => { const top = h[0], last = h.pop(); if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && less(h[l], h[m])) m = l; if (r < h.length && less(h[r], h[m])) m = r; if (m === i) break; [h[i], h[m]] = [h[m], h[i]]; i = m; } } return top; };
    a.forEach(push);
    return [pop(), pop(), pop()].join(' ');
  },
  d5: v => {
    const a = nums(v.prompt.match(/lần lượt (.+?) vào/)[1]), pre = v.prompt.includes('preorder');
    const nodes = {}; let rootV = a[0]; nodes[rootV] = {};
    a.slice(1).forEach(x => { let cur = rootV; for (;;) { const side = x < cur ? 'l' : 'r'; if (nodes[cur][side] === undefined) { nodes[cur][side] = x; nodes[x] = {}; break; } cur = nodes[cur][side]; } });
    const out = []; (function walk(x) { if (x === undefined) return; if (pre) out.push(x); walk(nodes[x].l); walk(nodes[x].r); if (!pre) out.push(x); })(rootV);
    return out.join(' ');
  },
  g1: v => {
    const adj = adjOf(7, edgesOf(v.prompt)), seen = [0], q = [0], out = [];
    while (q.length) { const u = q.shift(); out.push(u); adj[u].forEach(([x]) => { if (!seen.includes(x)) { seen.push(x); q.push(x); } }); }
    return out.join(' ');
  },
  g2: v => {
    // DFS bằng ngăn xếp tường minh (khác cách cài đặt đệ quy trong khuôn)
    const adj = adjOf(7, edgesOf(v.prompt)), seen = new Set(), out = [], st = [0];
    while (st.length) { const u = st.pop(); if (seen.has(u)) continue; seen.add(u); out.push(u); adj[u].map(x => x[0]).reverse().forEach(x => { if (!seen.has(x)) st.push(x); }); }
    return out.join(' ');
  },
  g3: v => {
    const adj = adjOf(8, edgesOf(v.prompt.split('các cạnh:')[1].split('. Gọi')[0]));
    const d = Array(8).fill(-1); d[0] = 0; const q = [0];
    while (q.length) { const u = q.shift(); adj[u].forEach(([x]) => { if (d[x] < 0) { d[x] = d[u] + 1; q.push(x); } }); }
    return String(d.reduce((s, x) => s + x, 0));
  },
  g4: v => {
    const E = edgesOf(v.prompt.split('các cạnh:')[1]), adj = adjOf(9, E), seen = new Set(), sizes = [];
    for (let s = 0; s < 9; s++) if (!seen.has(s)) { let c = 0; const st = [s]; seen.add(s); while (st.length) { const u = st.pop(); c++; adj[u].forEach(([x]) => { if (!seen.has(x)) { seen.add(x); st.push(x); } }); } sizes.push(c); }
    return `${sizes.length} thành phần, lớn nhất ${Math.max(...sizes)} đỉnh`;
  },
  g5: v => {
    // Bellman-Ford (khác Dijkstra trong khuôn)
    const E = edgesOf(v.prompt.split('):')[1].split('. Độ dài')[0]), t = Number(v.prompt.match(/đến đỉnh (\d+)/)[1]);
    const d = Array(6).fill(Infinity); d[0] = 0;
    for (let i = 0; i < 6; i++) E.forEach(([a, b, w]) => { if (d[a] + w < d[b]) d[b] = d[a] + w; if (d[b] + w < d[a]) d[a] = d[b] + w; });
    return String(d[t]);
  },
};

// ═════════ Sinh và kiểm tra từng khuôn ═════════
const pySamples = [];
const report = [];
for (const q of Q) {
  const st = { answers: new Map(), rank: [], numN: 0, longest: 0, textN: 0, variants: new Set() };
  for (let seed = 1; seed <= N; seed++) {
    let v;
    try { v = q.make(DEV_RNG((seed * 2654435761) >>> 0)); } catch (e) { err(q.id, `lỗi khi sinh: ${e.message}`); continue; }
    const opts = v.options.map(String), ans = String(v.answer);
    st.variants.add(`${v.prompt}|${v.code ? v.code.js : ''}`);
    if (opts.length !== q.k) err(q.id, `số phương án ${opts.length} ≠ ${q.k}`);
    if (new Set(opts).size !== opts.length) err(q.id, `phương án trùng: ${opts.join(' | ')}`);
    if (!opts.includes(ans)) err(q.id, `đáp án không nằm trong phương án`);
    if (opts.some(o => !o.trim() || /undefined|NaN|Infinity/.test(o))) err(q.id, `phương án lỗi: ${opts.join(' | ')}`);

    try {
      if (v.kind === 'output') {
        const got = runJs(v.code.js);
        if (got !== ans) err(q.id, `code JS in ra “${got}”, đáp án ghi “${ans}”`);
        if (seed <= PY) pySamples.push({ id: q.id, js: got, py: v.code.py });
      } else if (v.kind === 'complexity') {
        const cls = measureClass(jsFn(v.code.js));
        if (cls !== ans) err(q.id, `đo thực nghiệm ra ${cls}, đáp án ghi ${ans}\n${v.code.js}`);
        if (seed <= PY) pySamples.push({ id: q.id, js: String(jsFn(v.code.js)(12)), py: `${v.code.py}\nprint(f(12))` });
      } else if (SOLVE[q.id]) {
        const got = SOLVE[q.id](v);
        if (got !== ans) err(q.id, `bộ giải độc lập ra “${got}”, đáp án ghi “${ans}” — ${v.prompt}`);
      }
    } catch (e) { err(q.id, `lỗi khi kiểm tra: ${e.message}`); }

    st.answers.set(ans, (st.answers.get(ans) || 0) + 1);
    if (opts.every(o => /^\d+$/.test(o))) {
      st.numN++; st.rank.push(opts.filter(o => Number(o) < Number(ans)).length);
    } else {
      st.textN++;
      const len = opts.map(o => o.length), mx = Math.max(...len);
      if (ans.length === mx && len.filter(l => l === mx).length === 1) st.longest++;
    }
  }
  const row = { id: q.id, variants: st.variants.size };
  row.top = Math.max(...st.answers.values()) / N;
  const limit = st.variants.size <= 12 ? 2.5 / st.variants.size : 0.3;
  if (row.top > limit) err(q.id, `một giá trị đáp án chiếm ${(row.top * 100).toFixed(1)}%`);
  if (st.numN) {
    const hist = Array(q.k).fill(0); st.rank.forEach(x => hist[x]++);
    row.rank = hist.map(x => Math.round((x / st.numN) * 100)).join('/');
    const mx = Math.max(...hist) / st.numN;
    if (mx > 0.45) err(q.id, `đáp án số thường đứng cùng một thứ hạng (${row.rank}%)`); else if (mx > 0.35) warn(q.id, `thứ hạng đáp án hơi lệch (${row.rank}%)`);
  }
  if (st.textN) {
    row.longest = st.longest / st.textN;
    if (row.longest > 1 / q.k + 0.25) err(q.id, `đáp án là phương án dài nhất ${(row.longest * 100).toFixed(0)}%`); else if (row.longest > 1 / q.k + 0.15) warn(q.id, `đáp án là phương án dài nhất ${(row.longest * 100).toFixed(0)}%`);
  }
  report.push(row);
}

// ═════════ Đối chiếu với Python thật ═════════
let pyChecked = 0, pyNote = '';
const pyBin = ['python3', 'python'].find(b => { try { return spawnSync(b, ['--version']).status === 0; } catch (e) { return false; } });
if (!pyBin) {
  pyNote = 'KHÔNG tìm thấy Python – bỏ qua đối chiếu Python';
  warn('PY', pyNote);
} else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devq-'));
  const dataFile = path.join(tmp, 'snippets.json'), runner = path.join(tmp, 'run.py');
  fs.writeFileSync(dataFile, JSON.stringify(pySamples.map(s => s.py)));
  fs.writeFileSync(runner, [
    'import io, json, sys, contextlib',
    'sys.setrecursionlimit(10000)',
    'out = []',
    'for code in json.load(open(sys.argv[1], encoding="utf-8")):',
    '    buf = io.StringIO()',
    '    try:',
    '        with contextlib.redirect_stdout(buf):',
    '            exec(code, {"__name__": "__main__"})',
    '        out.append(buf.getvalue().rstrip("\\n"))',
    '    except Exception as e:',
    '        out.append("PYERROR " + repr(e))',
    'sys.stdout.write(json.dumps(out))',
  ].join('\n'));
  const res = spawnSync(pyBin, ['-I', runner, dataFile], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (res.status !== 0) err('PY', `Python lỗi: ${res.stderr.slice(0, 300)}`);
  else {
    const outs = JSON.parse(res.stdout);
    pySamples.forEach((s, i) => { pyChecked++; if (outs[i] !== s.js) err(s.id, `Python in ra “${outs[i]}”, JS in ra “${s.js}”\n${s.py}`); });
    pyNote = `${pyChecked} đoạn code Python chạy thật, khớp với JS`;
  }
}

// ═════════ Bộ đề hoàn chỉnh: vị trí đáp án ═════════
const LET = 'ABCDEF', posCount = {}, posTotal = {};
let worstSpread = 0, worstRun = 0;
for (let f = 0; f < FORMS; f++) {
  const { items } = IQForm.build({ rand: DEV_RNG(9e6 + f), questions: Q, rngFn: DEV_RNG, bank: DEV_BANK_VERSION, params: null });
  const counts = [0, 0, 0, 0]; let run = 1, prev = -1;
  items.forEach(it => {
    const pos = it.order.indexOf(it.correct);
    posCount[`${it.k}:${pos}`] = (posCount[`${it.k}:${pos}`] || 0) + 1; posTotal[it.k] = (posTotal[it.k] || 0) + 1;
    if (pos < 4) counts[pos]++;
    run = pos === prev ? run + 1 : 1; prev = pos; worstRun = Math.max(worstRun, run);
  });
  worstSpread = Math.max(worstSpread, Math.max(...counts) - Math.min(...counts));
}
for (const [k, t] of Object.entries(posTotal)) for (let p = 0; p < Number(k); p++) {
  const share = (posCount[`${k}:${p}`] || 0) / t;
  if (Math.abs(share - 1 / k) > 0.03) err('FORM', `câu ${k} phương án: vị trí ${LET[p]} chiếm ${(share * 100).toFixed(1)}%`);
}
if (worstSpread > 4) err('FORM', `trong một bộ đề, số đáp án A/B/C/D chênh nhau ${worstSpread}`);
if (worstRun > 2) err('FORM', `có ${worstRun} câu liên tiếp cùng vị trí đáp án`);

// ═════════ In kết quả ═════════
const pct = x => (x === undefined ? '' : `${(x * 100).toFixed(0)}%`);
console.log(`Ngân hàng ${DEV_BANK_VERSION}: ${Q.length} khuôn × ${N} biến thể, ${FORMS} bộ đề\n`);
console.log('Khuôn  Biến thể  Đáp án phổ biến nhất  Thứ hạng đáp án số (%)  Dài nhất');
report.forEach(r => console.log(`${r.id.padEnd(6)} ${String(r.variants).padStart(8)}  ${pct(r.top).padStart(19)}  ${(r.rank || '').padStart(22)}  ${pct(r.longest).padStart(8)}`));
console.log(`\nVị trí đáp án: ${Object.entries(posTotal).map(([k, t]) => `${k} phương án: ${[...Array(Number(k)).keys()].map(p => `${LET[p]} ${(((posCount[`${k}:${p}`] || 0) / t) * 100).toFixed(1)}%`).join(' ')}`).join(' | ')}`);
console.log(`Trong 1 bộ đề: chênh lệch A/B/C/D lớn nhất ${worstSpread}, chuỗi cùng vị trí dài nhất ${worstRun}`);
console.log(`Python: ${pyNote}`);
if (warnings.length) console.log(`\nCẢNH BÁO (${warnings.length}):\n  ` + warnings.join('\n  '));
if (errors.length) { console.log(`\nLỖI (${errors.length}):\n  ` + errors.join('\n  ')); process.exit(1); }
console.log('\nKHÔNG CÓ LỖI.');
