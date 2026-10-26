/*
 * Ngân hàng khuôn câu hỏi THUẬT TOÁN cho lập trình viên.
 * Mỗi khuôn make(rng) sinh một biến thể: { prompt, code?: { js, py }, options, answer, explain, kind }
 *   kind = 'output'     → code in ra kết quả; đáp án = đúng chuỗi được in
 *          'complexity' → code định nghĩa f(n) trả về số thao tác; đáp án = lớp độ phức tạp
 *          'text'       → câu hỏi bằng lời (cấu trúc dữ liệu, đồ thị, khái niệm)
 * Mọi khuôn được kiểm tra bằng tools/validate_dev.js: CHẠY THẬT code JS và Python để đối chiếu đáp án,
 * đo độ phức tạp thực nghiệm, và đo các sai lệch (vị trí đáp án, giá trị lặp, mẹo đoán).
 */
(function (root) {
  'use strict';

  root.DEV_BANK_VERSION = 'dev-v1';

  // ───────── Tiện ích ngẫu nhiên có seed ─────────
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
  const L = (...lines) => lines.join('\n');
  const list = a => `[${a.join(', ')}]`;
  const sp = a => a.join(' ');
  const distinct = (r, k, lo, hi) => perm(r, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, k);

  // Phương án số: thứ hạng của đáp án (khi xếp tăng dần) được chọn ngẫu nhiên đều
  function numOptions(r, ans, plausible, { n = 5, min = 0, max = Infinity, step = Math.max(1, Math.round(ans * 0.08)) } = {}) {
    const ok = x => Number.isInteger(x) && x >= min && x <= max && x !== ans;
    const near = perm(r, [1, 2, 3, 4, 5, 6, 7, 8]).map(k => k * step);
    const below = dedupe([...perm(r, plausible.filter(x => x < ans)), ...near.map(d => ans - d)].filter(ok));
    const above = dedupe([...perm(r, plausible.filter(x => x > ans)), ...near.map(d => ans + d)].filter(ok));
    const lo = Math.max(0, n - 1 - above.length), hi = Math.min(n - 1, below.length);
    const t = int(r, lo, hi);
    return [ans, ...below.slice(0, t), ...above.slice(0, n - 1 - t)].map(String);
  }
  // Phương án chuỗi: đáp án + các phương án nhiễu "hợp lý" + bổ sung bằng hàm fill cho đủ n
  function strOptions(r, ans, cands, fill, n = 5) {
    const out = [ans];
    for (const c of perm(r, cands)) if (out.length < n && c && !out.includes(c)) out.push(c);
    for (let g = 0; out.length < n && g < 300; g++) { const c = fill(r); if (c && !out.includes(c)) out.push(c); }
    return out;
  }
  // Đổi chỗ hai phần tử kề nhau – tạo phương án nhiễu "gần đúng"
  const swapAdj = (r, arr) => { const a = arr.slice(), i = int(r, 0, a.length - 2); [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; };
  const swapAny = (r, arr) => { const a = arr.slice(), i = int(r, 0, a.length - 1); let j = int(r, 0, a.length - 2); if (j >= i) j++; [a[i], a[j]] = [a[j], a[i]]; return a; };
  // Thay một phần tử bằng giá trị trong các giá trị đã xuất hiện, hoặc đổi chỗ 2 phần tử
  const mutateArr = (r, arr, pool) => {
    const a = arr.slice();
    if (a.length > 1 && r() < 0.5) return swapAny(r, a);
    a[int(r, 0, a.length - 1)] = pick(r, pool);
    return a;
  };

  // ───────── Độ phức tạp ─────────
  const CLASSES = ['O(1)', 'O(log n)', 'O(√n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'];
  // Mỗi dạng: code JS/Python của f(n) trả về số thao tác cơ bản, và lớp độ phức tạp đúng
  const SHAPES = {
    const: r => { const K = int(r, 5, 100); return { cls: 'O(1)', ex: `Vòng lặp chạy đúng ${K} lần, không phụ thuộc n.`,
      js: L('function f(n) {', '  let count = 0;', `  for (let i = 0; i < ${K}; i++) {`, '    count++;', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', `    for i in range(${K}):`, '        count += 1', '    return count') }; },
    lin: r => { const s = int(r, 1, 3); return { cls: 'O(n)', ex: `Vòng lặp chạy khoảng n/${s} lần → O(n).`,
      js: L('function f(n) {', '  let count = 0;', `  for (let i = 0; i < n; i += ${s}) {`, '    count++;', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', `    for i in range(0, n, ${s}):`, '        count += 1', '    return count') }; },
    lin2: () => ({ cls: 'O(n)', ex: 'Hai vòng lặp nối tiếp, mỗi vòng n lần → 2n → O(n).',
      js: L('function f(n) {', '  let count = 0;', '  for (let i = 0; i < n; i++) {', '    count++;', '  }', '  for (let j = 0; j < n; j++) {', '    count++;', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', '    for i in range(n):', '        count += 1', '    for j in range(n):', '        count += 1', '    return count') }),
    quad: () => ({ cls: 'O(n²)', ex: 'Hai vòng lặp lồng nhau, mỗi vòng n lần → n² → O(n²).',
      js: L('function f(n) {', '  let count = 0;', '  for (let i = 0; i < n; i++) {', '    for (let j = 0; j < n; j++) {', '      count++;', '    }', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', '    for i in range(n):', '        for j in range(n):', '            count += 1', '    return count') }),
    tri: () => ({ cls: 'O(n²)', ex: 'Vòng trong chạy 0 + 1 + … + (n − 1) = n(n − 1)/2 lần → O(n²).',
      js: L('function f(n) {', '  let count = 0;', '  for (let i = 0; i < n; i++) {', '    for (let j = 0; j < i; j++) {', '      count++;', '    }', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', '    for i in range(n):', '        for j in range(i):', '            count += 1', '    return count') }),
    log: r => { const m = pick(r, [2, 3]); return { cls: 'O(log n)', ex: `i nhân ${m} mỗi lần → số lần lặp là log${m === 2 ? '₂' : '₃'} n → O(log n).`,
      js: L('function f(n) {', '  let count = 0;', `  for (let i = 1; i < n; i *= ${m}) {`, '    count++;', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', '    i = 1', '    while i < n:', '        count += 1', `        i *= ${m}`, '    return count') }; },
    log2: () => ({ cls: 'O(log n)', ex: 'i giảm một nửa mỗi lần → log₂ n lần → O(log n).',
      js: L('function f(n) {', '  let count = 0;', '  let i = n;', '  while (i > 1) {', '    i = Math.floor(i / 2);', '    count++;', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', '    i = n', '    while i > 1:', '        i //= 2', '        count += 1', '    return count') }),
    sqrt: () => ({ cls: 'O(√n)', ex: 'Vòng lặp dừng khi i² > n, tức chạy khoảng √n lần.',
      js: L('function f(n) {', '  let count = 0;', '  for (let i = 1; i * i <= n; i++) {', '    count++;', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', '    i = 1', '    while i * i <= n:', '        count += 1', '        i += 1', '    return count') }),
    nlog: () => ({ cls: 'O(n log n)', ex: 'Vòng ngoài n lần, vòng trong nhân đôi j → log n lần → O(n log n).',
      js: L('function f(n) {', '  let count = 0;', '  for (let i = 0; i < n; i++) {', '    for (let j = 1; j < n; j *= 2) {', '      count++;', '    }', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', '    for i in range(n):', '        j = 1', '        while j < n:', '            count += 1', '            j *= 2', '    return count') }),
    harmonic: () => ({ cls: 'O(n log n)', ex: 'Với mỗi i, vòng trong chạy n/i lần → n(1 + 1/2 + … + 1/n) ≈ n ln n → O(n log n).',
      js: L('function f(n) {', '  let count = 0;', '  for (let i = 1; i <= n; i++) {', '    for (let j = i; j <= n; j += i) {', '      count++;', '    }', '  }', '  return count;', '}'),
      py: L('def f(n):', '    count = 0', '    for i in range(1, n + 1):', '        for j in range(i, n + 1, i):', '            count += 1', '    return count') }),
    exp: () => ({ cls: 'O(2ⁿ)', ex: 'Mỗi lời gọi sinh ra 2 lời gọi với n − 1 → cây đệ quy có khoảng 2ⁿ nút.',
      js: L('function f(n) {', '  if (n <= 1) return 1;', '  return f(n - 1) + f(n - 1);', '}'),
      py: L('def f(n):', '    if n <= 1:', '        return 1', '    return f(n - 1) + f(n - 1)') }),
    recLog: () => ({ cls: 'O(log n)', ex: 'Mỗi lời gọi chỉ gọi 1 lần với n/2 → log₂ n tầng → O(log n).',
      js: L('function f(n) {', '  if (n <= 1) return 1;', '  return f(Math.floor(n / 2)) + 1;', '}'),
      py: L('def f(n):', '    if n <= 1:', '        return 1', '    return f(n // 2) + 1') }),
    recLin: () => ({ cls: 'O(n)', ex: 'T(n) = 2T(n/2) + O(1). Cây đệ quy có khoảng 2n nút, mỗi nút O(1) → O(n) (không phải O(log n) hay O(n log n)).',
      js: L('function f(n) {', '  if (n <= 1) return 1;', '  return f(Math.floor(n / 2)) + f(Math.floor(n / 2)) + 1;', '}'),
      py: L('def f(n):', '    if n <= 1:', '        return 1', '    return f(n // 2) + f(n // 2) + 1') }),
    recNlog: () => ({ cls: 'O(n log n)', ex: 'T(n) = 2T(n/2) + O(n) (giống merge sort) → O(n log n).',
      js: L('function f(n) {', '  if (n <= 1) return 1;', '  let count = 0;', '  for (let i = 0; i < n; i++) {', '    count++;', '  }', '  return count + f(Math.floor(n / 2)) + f(Math.floor(n / 2));', '}'),
      py: L('def f(n):', '    if n <= 1:', '        return 1', '    count = 0', '    for i in range(n):', '        count += 1', '    return count + f(n // 2) + f(n // 2)') }),
  };
  const complexity = shapes => r => {
    const s = SHAPES[pick(r, shapes)](r);
    return { kind: 'complexity', prompt: 'Độ phức tạp thời gian của hàm f(n) dưới đây là?', code: { js: s.js, py: s.py },
      options: [s.cls, ...perm(r, CLASSES.filter(c => c !== s.cls)).slice(0, 4)], answer: s.cls, explain: s.ex };
  };

  // ───────── Đồ thị ngẫu nhiên ─────────
  function randomGraph(r, n, extra, weighted = false) {
    const order = perm(r, Array.from({ length: n }, (_, i) => i)), edges = new Map();
    const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    for (let i = 1; i < n; i++) { const a = order[i], b = order[int(r, 0, i - 1)]; edges.set(key(a, b), [Math.min(a, b), Math.max(a, b), int(r, 1, 9)]); }
    for (let t = 0; edges.size < n - 1 + extra && t < 200; t++) {
      const a = int(r, 0, n - 1), b = int(r, 0, n - 1);
      if (a !== b && !edges.has(key(a, b))) edges.set(key(a, b), [Math.min(a, b), Math.max(a, b), int(r, 1, 9)]);
    }
    const E = [...edges.values()].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const adj = Array.from({ length: n }, () => []);
    E.forEach(([a, b, w]) => { adj[a].push([b, w]); adj[b].push([a, w]); });
    adj.forEach(l => l.sort((x, y) => x[0] - y[0]));
    const text = E.map(([a, b, w]) => (weighted ? `${a}–${b} (${w})` : `${a}–${b}`)).join(', ');
    return { n, E, adj, text };
  }
  const bfsOrder = (g, s, rev = false) => {
    const seen = new Set([s]), q = [s], out = [];
    while (q.length) { const u = q.shift(); out.push(u); const nb = g.adj[u].map(x => x[0]); for (const v of rev ? nb.reverse() : nb) if (!seen.has(v)) { seen.add(v); q.push(v); } }
    return out;
  };
  const dfsOrder = (g, s, rev = false) => {
    const seen = new Set(), out = [];
    const go = u => { seen.add(u); out.push(u); const nb = g.adj[u].map(x => x[0]); for (const v of rev ? nb.reverse() : nb) if (!seen.has(v)) go(v); };
    go(s); return out;
  };
  const bfsDist = (g, s) => { const d = Array(g.n).fill(-1); d[s] = 0; const q = [s]; while (q.length) { const u = q.shift(); for (const [v] of g.adj[u]) if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); } } return d; };

  root.DEV_QUESTIONS = [
    // ═════════ Độ phức tạp ═════════
    // Mỗi khuôn gồm các dạng có lớp độ phức tạp KHÁC nhau → đáp án không lặp một lớp cố định
    { id: 'c1', domain: 'complexity', b: -1.5, a: 1.5, make: complexity(['const', 'lin', 'quad', 'log2']) },
    { id: 'c2', domain: 'complexity', b: -0.6, a: 1.5, make: complexity(['log', 'sqrt', 'tri', 'lin2']) },
    { id: 'c3', domain: 'complexity', b: 0.3, a: 1.6, make: complexity(['nlog', 'tri', 'sqrt', 'log']) },
    { id: 'c4', domain: 'complexity', b: 1.2, a: 1.7, make: complexity(['exp', 'recLog', 'harmonic', 'sqrt']) },
    { id: 'c5', domain: 'complexity', b: 2.2, a: 1.8, make: complexity(['recNlog', 'recLin', 'exp', 'recLog']) },

    // ═════════ Cấu trúc dữ liệu ═════════
    { id: 'd1', domain: 'ds', b: -1.2, a: 1.5, make: r => {
      // Ngăn xếp: chuỗi thao tác push/pop ngẫu nhiên
      const ops = [], st = [], q = [], all = [];
      const vals = distinct(r, 7, 1, 30);
      let vi = 0;
      for (let t = 0; t < 8; t++) {
        if (vi < vals.length && (st.length < 2 || r() < 0.6)) { const v = vals[vi++]; ops.push(['push', v]); st.push(v); q.push(v); all.push(v); }
        else { ops.push(['pop']); st.pop(); q.shift(); }
      }
      if (!st.length) { const v = vals[vi]; ops.push(['push', v]); st.push(v); q.push(v); all.push(v); }
      const js = L('const st = [];', ...ops.map(o => (o[0] === 'push' ? `st.push(${o[1]});` : 'st.pop();')), "console.log(st.join(' '));");
      const py = L('st = []', ...ops.map(o => (o[0] === 'push' ? `st.append(${o[1]})` : 'st.pop()')), "print(' '.join(map(str, st)))");
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: sp(st),
        options: strOptions(r, sp(st), [sp(q), sp(st.slice().reverse()), sp(all)], rr => sp(mutateArr(rr, st, all))),
        explain: 'Ngăn xếp (stack) là LIFO: pop() luôn lấy phần tử được push gần nhất.' };
    } },
    { id: 'd2', domain: 'ds', b: -0.8, a: 1.5, make: r => {
      // Hàng đợi
      const ops = [], st = [], q = [];
      const vals = distinct(r, 7, 1, 30);
      let vi = 0;
      for (let t = 0; t < 8; t++) {
        if (vi < vals.length && (q.length < 2 || r() < 0.6)) { const v = vals[vi++]; ops.push(['push', v]); st.push(v); q.push(v); }
        else { ops.push(['pop']); st.pop(); q.shift(); }
      }
      if (!q.length) { const v = vals[vi]; ops.push(['push', v]); st.push(v); q.push(v); }
      const js = L('const q = [];', ...ops.map(o => (o[0] === 'push' ? `q.push(${o[1]});` : 'q.shift();')), "console.log(q.join(' '));");
      const py = L('from collections import deque', 'q = deque()', ...ops.map(o => (o[0] === 'push' ? `q.append(${o[1]})` : 'q.popleft()')), "print(' '.join(map(str, q)))");
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: sp(q),
        options: strOptions(r, sp(q), [sp(st), sp(q.slice().reverse())], rr => sp(mutateArr(rr, q, vals.slice(0, vi)))),
        explain: 'Hàng đợi (queue) là FIFO: shift()/popleft() lấy phần tử được thêm vào sớm nhất.' };
    } },
    { id: 'd3', domain: 'ds', b: -0.2, a: 1.5, make: r => {
      // Đếm tần suất bằng bảng băm
      const k = int(r, 3, 5), a = Array.from({ length: int(r, 7, 10) }, () => int(r, 1, k));
      const cnt = {}; a.forEach(x => (cnt[x] = (cnt[x] || 0) + 1));
      const size = Object.keys(cnt).length, best = Math.max(...Object.values(cnt)), ans = `${size} ${best}`;
      const js = L(`const a = ${list(a)};`, 'const cnt = new Map();', 'for (const x of a) cnt.set(x, (cnt.get(x) || 0) + 1);', 'let best = 0;', 'for (const [k, v] of cnt) if (v > best) best = v;', "console.log(cnt.size + ' ' + best);");
      const py = L(`a = ${list(a)}`, 'cnt = {}', 'for x in a:', '    cnt[x] = cnt.get(x, 0) + 1', 'best = max(cnt.values())', 'print(len(cnt), best)');
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: ans,
        options: strOptions(r, ans, [`${a.length} ${best}`, `${size} ${a.length}`, `${best} ${size}`, `${size} ${best - 1}`, `${size + 1} ${best}`], rr => `${int(rr, 1, 6)} ${int(rr, 1, 6)}`),
        explain: `Có ${size} giá trị khác nhau; giá trị xuất hiện nhiều nhất lặp ${best} lần.` };
    } },
    { id: 'd4', domain: 'ds', b: 0.3, a: 1.6, make: r => {
      // Heap: lấy ra k phần tử
      const a = distinct(r, 7, 1, 40), k = 3, isMin = r() < 0.5;
      const sorted = a.slice().sort((x, y) => (isMin ? x - y : y - x)), ans = sp(sorted.slice(0, k));
      const firstK = a.slice(0, k).slice().sort((x, y) => (isMin ? x - y : y - x));
      return { kind: 'text', prompt: `Chèn lần lượt các số ${a.join(', ')} vào một ${isMin ? 'min-heap' : 'max-heap'}, rồi lấy ra (${isMin ? 'extract-min' : 'extract-max'}) 3 lần. Ba số lấy ra theo thứ tự là?`,
        answer: ans,
        options: strOptions(r, ans, [sp(a.slice(0, k)), sp(sorted.slice(-k).reverse()), sp(firstK), sp(a.slice(-k)), sp(sorted.slice(0, k).reverse())], rr => sp(mutateArr(rr, sorted.slice(0, k), a))),
        explain: `${isMin ? 'Min' : 'Max'}-heap luôn trả về phần tử ${isMin ? 'nhỏ' : 'lớn'} nhất còn lại, bất kể thứ tự chèn → ${ans}.` };
    } },
    { id: 'd5', domain: 'ds', b: 1.0, a: 1.6, make: r => {
      // Cây nhị phân tìm kiếm: duyệt trước / sau
      const a = distinct(r, 7, 1, 50), root = { v: a[0] };
      const ins = (node, v) => { const s = v < node.v ? 'l' : 'r'; if (node[s]) ins(node[s], v); else node[s] = { v }; };
      a.slice(1).forEach(v => ins(root, v));
      const pre = [], post = [], inord = [], level = [];
      (function walk(n) { if (!n) return; pre.push(n.v); walk(n.l); inord.push(n.v); walk(n.r); post.push(n.v); })(root);
      const q = [root]; while (q.length) { const n = q.shift(); level.push(n.v); if (n.l) q.push(n.l); if (n.r) q.push(n.r); }
      const askPre = r() < 0.5, ans = sp(askPre ? pre : post);
      return { kind: 'text', prompt: `Chèn lần lượt ${a.join(', ')} vào một cây nhị phân tìm kiếm (BST) rỗng, không cân bằng lại. Duyệt cây theo thứ tự ${askPre ? 'TRƯỚC (preorder: gốc → trái → phải)' : 'SAU (postorder: trái → phải → gốc)'} cho kết quả?`,
        answer: ans,
        options: strOptions(r, ans, [sp(askPre ? post : pre), sp(inord), sp(level), sp(a)], rr => sp(swapAny(rr, askPre ? pre : post))),
        explain: `Dựng cây theo quy tắc nhỏ hơn sang trái, lớn hơn sang phải, rồi duyệt ${askPre ? 'gốc → trái → phải' : 'trái → phải → gốc'}.` };
    } },

    // ═════════ Đọc code ═════════
    { id: 'r1', domain: 'read', b: -0.8, a: 1.5, make: r => {
      const n = int(r, 12, 40), k = int(r, 2, 6);
      let s = 0, sLt = 0, cnt = 0; for (let i = 1; i <= n; i++) if (i % k === 0) { s += i; cnt++; if (i < n) sLt += i; }
      const js = L('let s = 0;', `for (let i = 1; i <= ${n}; i++) {`, `  if (i % ${k} === 0) s += i;`, '}', 'console.log(s);');
      const py = L('s = 0', `for i in range(1, ${n} + 1):`, `    if i % ${k} == 0:`, '        s += i', 'print(s)');
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: String(s),
        options: numOptions(r, s, [sLt, cnt, s + k, s - k, (n * (n + 1)) / 2]), explain: `Tổng các bội của ${k} từ 1 đến ${n}.` };
    } },
    { id: 'r2', domain: 'read', b: 0.0, a: 1.5, make: r => {
      const n = int(r, 6, 40);
      let x = n, steps = 0; while (x !== 1) { x = x % 2 === 0 ? x / 2 : 3 * x + 1; steps++; }
      const js = L(`let x = ${n}, steps = 0;`, 'while (x !== 1) {', '  x = x % 2 === 0 ? x / 2 : 3 * x + 1;', '  steps++;', '}', 'console.log(steps);');
      const py = L(`x, steps = ${n}, 0`, 'while x != 1:', '    x = x // 2 if x % 2 == 0 else 3 * x + 1', '    steps += 1', 'print(steps)');
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: String(steps),
        options: numOptions(r, steps, [steps + 1, steps - 1], { step: 1, min: 1 }), explain: `Mô phỏng dãy Collatz từ ${n} đến khi gặp 1: ${steps} bước.` };
    } },
    { id: 'r3', domain: 'read', b: 0.6, a: 1.6, make: r => {
      const a = Array.from({ length: 7 }, () => int(r, 1, 9)), t = int(r, 7, 14);
      let c = 0, ordered = 0, withSelf = 0, strict = 0;
      for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length; j++) {
        if (a[i] + a[j] <= t) { withSelf++; if (i !== j) ordered++; if (i < j) c++; }
        if (i < j && a[i] + a[j] < t) strict++;
      }
      const js = L(`const a = ${list(a)};`, 'let c = 0;', 'for (let i = 0; i < a.length; i++) {', '  for (let j = i + 1; j < a.length; j++) {', `    if (a[i] + a[j] <= ${t}) c++;`, '  }', '}', 'console.log(c);');
      const py = L(`a = ${list(a)}`, 'c = 0', 'for i in range(len(a)):', '    for j in range(i + 1, len(a)):', `        if a[i] + a[j] <= ${t}:`, '            c += 1', 'print(c)');
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: String(c),
        options: numOptions(r, c, [ordered, withSelf, strict, c + 1], { step: 1 }), explain: `Đếm các cặp chỉ số i < j có tổng ≤ ${t}: ${c} cặp.` };
    } },
    { id: 'r4', domain: 'read', b: -0.3, a: 1.5, make: r => {
      const s = Array.from({ length: int(r, 8, 12) }, () => pick(r, ['a', 'b', 'c'])).join('');
      let c = 0, distinctNeighbors = 0; for (let i = 0; i + 1 < s.length; i++) { if (s[i] === s[i + 1]) c++; else distinctNeighbors++; }
      const js = L(`const s = "${s}";`, 'let c = 0;', 'for (let i = 0; i + 1 < s.length; i++) {', '  if (s[i] === s[i + 1]) c++;', '}', 'console.log(c);');
      const py = L(`s = "${s}"`, 'c = 0', 'for i in range(len(s) - 1):', '    if s[i] == s[i + 1]:', '        c += 1', 'print(c)');
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: String(c),
        options: numOptions(r, c, [distinctNeighbors, c + 1, c - 1, s.length - 1 - c], { step: 1 }), explain: `Đếm số vị trí có ký tự giống ký tự ngay sau: ${c}.` };
    } },
    { id: 'r5', domain: 'read', b: 1.0, a: 1.6, make: r => {
      const n = int(r, 4, 12), useGe = r() < 0.5;
      // Biến thể: dừng khi j > i (tam giác có đường chéo) hoặc j >= i (không có đường chéo)
      const c = useGe ? (n * (n - 1)) / 2 : (n * (n + 1)) / 2;
      const cond = useGe ? 'j >= i' : 'j > i';
      const js = L('let c = 0;', `for (let i = 0; i < ${n}; i++) {`, `  for (let j = 0; j < ${n}; j++) {`, `    if (${cond}) break;`, '    c++;', '  }', '}', 'console.log(c);');
      const py = L('c = 0', `for i in range(${n}):`, `    for j in range(${n}):`, `        if ${cond}:`, '            break', '        c += 1', 'print(c)');
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: String(c),
        options: numOptions(r, c, [n * n, useGe ? (n * (n + 1)) / 2 : (n * (n - 1)) / 2, n], { step: 1 }),
        explain: `break chỉ thoát vòng trong. Với mỗi i, vòng trong chạy ${useGe ? 'i' : 'i + 1'} lần → tổng ${c}.` };
    } },

    // ═════════ Sắp xếp & tìm kiếm ═════════
    { id: 's1', domain: 'sort', b: 0.4, a: 1.6, make: r => {
      const len = int(r, 9, 15), a = distinct(r, len, 1, 60).sort((x, y) => x - y), x = r() < 0.75 ? pick(r, a) : int(r, 1, 60);
      let lo = 0, hi = a.length - 1, steps = 0, mid = -1;
      while (lo <= hi) { mid = Math.floor((lo + hi) / 2); steps++; if (a[mid] === x) break; if (a[mid] < x) lo = mid + 1; else hi = mid - 1; }
      const ans = `${steps} ${mid}`;
      const js = L(`const a = ${list(a)};`, `const x = ${x};`, 'let lo = 0, hi = a.length - 1, steps = 0, mid = -1;', 'while (lo <= hi) {', '  mid = Math.floor((lo + hi) / 2);', '  steps++;', '  if (a[mid] === x) break;', '  if (a[mid] < x) lo = mid + 1;', '  else hi = mid - 1;', '}', "console.log(steps + ' ' + mid);");
      const py = L(`a = ${list(a)}`, `x = ${x}`, 'lo, hi, steps, mid = 0, len(a) - 1, 0, -1', 'while lo <= hi:', '    mid = (lo + hi) // 2', '    steps += 1', '    if a[mid] == x:', '        break', '    if a[mid] < x:', '        lo = mid + 1', '    else:', '        hi = mid - 1', 'print(steps, mid)');
      const idx = a.indexOf(x);
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: ans,
        options: strOptions(r, ans, [`${steps + 1} ${mid}`, `${steps - 1} ${mid}`, `${steps} ${idx}`, `${steps} ${mid + 1}`, `${idx + 1} ${idx}`], rr => `${int(rr, 1, 5)} ${int(rr, 0, len - 1)}`),
        explain: `Mô phỏng tìm kiếm nhị phân: sau ${steps} lần chia đôi, mid = ${mid}.` };
    } },
    { id: 's2', domain: 'sort', b: 0.5, a: 1.6, make: r => {
      const a = distinct(r, 6, 1, 50), k = int(r, 1, 3);
      const bubble = p => { const b = a.slice(); for (let t = 0; t < p; t++) for (let j = 0; j + 1 < b.length - t; j++) if (b[j] > b[j + 1]) [b[j], b[j + 1]] = [b[j + 1], b[j]]; return b; };
      const selection = p => { const b = a.slice(); for (let i = 0; i < p; i++) { let m = i; for (let j = i + 1; j < b.length; j++) if (b[j] < b[m]) m = j; [b[i], b[m]] = [b[m], b[i]]; } return b; };
      const ans = sp(bubble(k));
      const js = L(`const a = ${list(a)};`, `for (let p = 0; p < ${k}; p++) {`, '  for (let j = 0; j + 1 < a.length - p; j++) {', '    if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]];', '  }', '}', "console.log(a.join(' '));");
      const py = L(`a = ${list(a)}`, `for p in range(${k}):`, '    for j in range(len(a) - 1 - p):', '        if a[j] > a[j + 1]:', '            a[j], a[j + 1] = a[j + 1], a[j]', "print(' '.join(map(str, a)))");
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: ans,
        options: strOptions(r, ans, [sp(bubble(k + 1)), sp(bubble(k - 1)), sp(selection(k)), sp(bubble(6)), sp(a)], rr => sp(swapAny(rr, bubble(k)))),
        explain: `Sau mỗi lượt bubble sort, phần tử lớn nhất còn lại "nổi" về cuối. Sau ${k} lượt: ${ans}.` };
    } },
    { id: 's3', domain: 'sort', b: 0.8, a: 1.6, make: r => {
      const a = distinct(r, 6, 1, 50), k = int(r, 2, 4);
      const insertion = p => { const b = a.slice(); for (let i = 1; i <= p; i++) { const v = b[i]; let j = i - 1; while (j >= 0 && b[j] > v) { b[j + 1] = b[j]; j--; } b[j + 1] = v; } return b; };
      const ans = sp(insertion(k));
      const js = L(`const a = ${list(a)};`, `for (let i = 1; i <= ${k}; i++) {`, '  const v = a[i];', '  let j = i - 1;', '  while (j >= 0 && a[j] > v) {', '    a[j + 1] = a[j];', '    j--;', '  }', '  a[j + 1] = v;', '}', "console.log(a.join(' '));");
      const py = L(`a = ${list(a)}`, `for i in range(1, ${k} + 1):`, '    v = a[i]', '    j = i - 1', '    while j >= 0 and a[j] > v:', '        a[j + 1] = a[j]', '        j -= 1', '    a[j + 1] = v', "print(' '.join(map(str, a)))");
      const sortedPrefix = p => sp([...a.slice(0, p).sort((x, y) => x - y), ...a.slice(p)]);
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: ans,
        options: strOptions(r, ans, [sp(insertion(k - 1)), sp(insertion(k + 1)), sortedPrefix(k), sp(a.slice().sort((x, y) => x - y))], rr => sp(swapAny(rr, insertion(k)))),
        explain: `Insertion sort: sau bước i, đoạn a[0..i] đã được sắp xếp; phần còn lại giữ nguyên → ${ans}.` };
    } },
    { id: 's4', domain: 'sort', b: -0.5, a: 1.5, make: r => {
      const q = pick(r, [
        { p: 'Thuật toán sắp xếp nào sau đây ỔN ĐỊNH (giữ nguyên thứ tự của các phần tử bằng nhau)?', o: ['Merge sort', 'Quick sort', 'Heap sort', 'Selection sort'], ex: 'Merge sort ổn định; ba thuật toán còn lại (bản chuẩn) có thể đảo thứ tự phần tử bằng nhau.' },
        { p: 'Độ phức tạp TRƯỜNG HỢP XẤU NHẤT của Quick sort (chọn pivot cố định) là?', o: ['O(n²)', 'O(n log n)', 'O(n)', 'O(log n)'], ex: 'Khi pivot luôn là phần tử nhỏ/lớn nhất (VD mảng đã sắp xếp), mỗi lần chỉ bớt 1 phần tử → O(n²).' },
        { p: 'BFS (duyệt theo chiều rộng) dùng cấu trúc dữ liệu nào để lưu các đỉnh chờ duyệt?', o: ['Hàng đợi (queue)', 'Ngăn xếp (stack)', 'Hàng đợi ưu tiên (heap)', 'Bảng băm (hash table)'], ex: 'BFS duyệt theo từng lớp khoảng cách nên cần FIFO → hàng đợi.' },
        { p: 'Tìm kiếm nhị phân trên mảng đòi hỏi điều kiện gì?', o: ['Mảng đã được sắp xếp', 'Mảng không có phần tử trùng', 'Mảng có độ dài là lũy thừa của 2', 'Mảng chỉ chứa số dương'], ex: 'Mỗi bước loại một nửa dựa trên so sánh với phần tử giữa → cần mảng đã sắp xếp.' },
        { p: 'Thời gian TRUNG BÌNH để tra cứu một khoá trong bảng băm (hash table) tốt là?', o: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], ex: 'Với hàm băm tốt và hệ số tải hợp lý, tra cứu trung bình O(1).' },
        { p: 'Thuật toán Dijkstra có thể cho kết quả SAI khi đồ thị có…', o: ['Cạnh trọng số âm', 'Chu trình', 'Nhiều hơn 1000 đỉnh', 'Cạnh có trọng số bằng nhau'], ex: 'Dijkstra giả định khoảng cách đã chốt không thể giảm nữa – sai khi có cạnh âm (dùng Bellman-Ford).' },
        { p: 'Chiều cao của một cây nhị phân tìm kiếm CÂN BẰNG có n nút là?', o: ['O(log n)', 'O(n)', 'O(√n)', 'O(1)'], ex: 'Cây cân bằng (AVL, đỏ-đen) giữ chiều cao O(log n).' },
        { p: 'Cấu trúc nào phù hợp nhất để luôn lấy được phần tử NHỎ NHẤT trong O(log n) khi liên tục thêm/xoá?', o: ['Min-heap', 'Mảng chưa sắp xếp', 'Danh sách liên kết', 'Ngăn xếp (stack)'], ex: 'Min-heap: thêm và lấy phần tử nhỏ nhất đều O(log n).' },
      ]);
      return { kind: 'text', prompt: q.p, options: q.o, answer: q.o[0], explain: q.ex };
    } },
    { id: 's5', domain: 'sort', b: 1.5, a: 1.7, make: r => {
      const a = distinct(r, 7, 1, 50);
      const lomuto = arr => { const b = arr.slice(), p = b[b.length - 1]; let i = 0; for (let j = 0; j < b.length - 1; j++) if (b[j] < p) { [b[i], b[j]] = [b[j], b[i]]; i++; } [b[i], b[b.length - 1]] = [b[b.length - 1], b[i]]; return b; };
      const ans = sp(lomuto(a)), p = a[a.length - 1];
      const stable = [...a.filter(x => x < p), p, ...a.filter(x => x > p)];
      const firstPivot = (() => { const b = a.slice(); const pv = b[0]; let i = 1; for (let j = 1; j < b.length; j++) if (b[j] < pv) { [b[i], b[j]] = [b[j], b[i]]; i++; } [b[0], b[i - 1]] = [b[i - 1], b[0]]; return b; })();
      const js = L(`const a = ${list(a)};`, 'const p = a[a.length - 1];', 'let i = 0;', 'for (let j = 0; j < a.length - 1; j++) {', '  if (a[j] < p) {', '    [a[i], a[j]] = [a[j], a[i]];', '    i++;', '  }', '}', '[a[i], a[a.length - 1]] = [a[a.length - 1], a[i]];', "console.log(a.join(' '));");
      const py = L(`a = ${list(a)}`, 'p = a[-1]', 'i = 0', 'for j in range(len(a) - 1):', '    if a[j] < p:', '        a[i], a[j] = a[j], a[i]', '        i += 1', 'a[i], a[-1] = a[-1], a[i]', "print(' '.join(map(str, a)))");
      return { kind: 'output', prompt: 'Đoạn code dưới đây (bước phân hoạch Lomuto của Quick sort) in ra gì?', code: { js, py }, answer: ans,
        options: strOptions(r, ans, [sp(stable), sp(firstPivot), sp(a.slice().sort((x, y) => x - y)), sp([p, ...a.slice(0, -1)])], rr => sp(swapAny(rr, lomuto(a)))),
        explain: `Pivot ${p}: các phần tử nhỏ hơn được hoán đổi dần lên đầu, cuối cùng đặt pivot vào giữa → ${ans}.` };
    } },

    // ═════════ Đệ quy & quy hoạch động ═════════
    { id: 'p1', domain: 'dp', b: 0.2, a: 1.6, make: r => {
      const n = int(r, 5, 12), steps = pick(r, [[1, 2], [1, 2, 3], [1, 3]]);
      const ways = m => { const dp = Array(m + 1).fill(0); dp[0] = 1; for (let i = 1; i <= m; i++) for (const s of steps) if (i - s >= 0) dp[i] += dp[i - s]; return dp[m]; };
      const ans = ways(n);
      const js = L(`const n = ${n}, steps = ${list(steps)};`, 'const dp = new Array(n + 1).fill(0);', 'dp[0] = 1;', 'for (let i = 1; i <= n; i++) {', '  for (const s of steps) {', '    if (i - s >= 0) dp[i] += dp[i - s];', '  }', '}', 'console.log(dp[n]);');
      const py = L(`n, steps = ${n}, ${list(steps)}`, 'dp = [0] * (n + 1)', 'dp[0] = 1', 'for i in range(1, n + 1):', '    for s in steps:', '        if i - s >= 0:', '            dp[i] += dp[i - s]', 'print(dp[n])');
      return { kind: 'output', prompt: 'Đoạn code dưới đây (đếm số cách leo cầu thang) in ra gì?', code: { js, py }, answer: String(ans),
        options: numOptions(r, ans, [ways(n - 1), ways(n + 1), 2 ** (n - 1)]), explain: `dp[i] = tổng dp[i − s] với s thuộc ${list(steps)} → dp[${n}] = ${ans}.` };
    } },
    { id: 'p2', domain: 'dp', b: 1.2, a: 1.7, make: r => {
      // Đổi tiền ít đồng nhất – chọn bộ mệnh giá mà thuật toán tham lam cho kết quả sai
      for (;;) {
        const coins = pick(r, [[1, 3, 4], [1, 4, 5], [1, 5, 6], [1, 6, 9], [1, 7, 10], [1, 5, 11], [1, 8, 13]]), amt = int(r, 8, 45);
        const dp = Array(amt + 1).fill(Infinity); dp[0] = 0;
        for (let i = 1; i <= amt; i++) for (const c of coins) if (c <= i) dp[i] = Math.min(dp[i], dp[i - c] + 1);
        let g = 0, x = amt; for (const c of coins.slice().reverse()) while (x >= c) { x -= c; g++; }
        if (g === dp[amt]) continue;
        const ans = dp[amt];
        const js = L(`const coins = ${list(coins)}, amount = ${amt};`, 'const dp = new Array(amount + 1).fill(Infinity);', 'dp[0] = 0;', 'for (let i = 1; i <= amount; i++) {', '  for (const c of coins) {', '    if (c <= i) dp[i] = Math.min(dp[i], dp[i - c] + 1);', '  }', '}', 'console.log(dp[amount]);');
        const py = L(`coins, amount = ${list(coins)}, ${amt}`, "dp = [float('inf')] * (amount + 1)", 'dp[0] = 0', 'for i in range(1, amount + 1):', '    for c in coins:', '        if c <= i:', '            dp[i] = min(dp[i], dp[i - c] + 1)', 'print(dp[amount])');
        return { kind: 'output', prompt: 'Đoạn code dưới đây (số đồng xu ít nhất để đổi tiền) in ra gì?', code: { js, py }, answer: String(ans),
          options: numOptions(r, ans, [g, ans + 1, ans - 1].filter(v => v > 0), { step: 1, min: 1 }),
          explain: `Quy hoạch động cho ${ans} đồng. Chú ý: cách tham lam (lấy đồng lớn nhất trước) cho ${g} đồng – không tối ưu với bộ ${list(coins)}.` };
      }
    } },
    { id: 'p3', domain: 'dp', b: 1.6, a: 1.7, make: r => {
      const lcs = (x, y) => { const d = Array.from({ length: x.length + 1 }, () => Array(y.length + 1).fill(0)); for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = x[i - 1] === y[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]); return d[x.length][y.length]; };
      // Chọn trước độ dài LCS mục tiêu (2..6, ngẫu nhiên đều) rồi sinh chuỗi cho khớp → đáp án không dồn vào một giá trị
      const target = int(r, 2, 6);
      let A, B;
      for (let t = 0; t < 500; t++) {
        const abc = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, int(r, 3, 6)), word = () => Array.from({ length: int(r, Math.max(5, target), 9) }, () => pick(r, abc)).join('');
        A = word(); B = word();
        if (lcs(A, B) === target) break;
      }
      const ans = lcs(A, B), common = [...new Set(A)].filter(c => B.includes(c)).length;
      let same = 0; for (let i = 0; i < Math.min(A.length, B.length); i++) same += A[i] === B[i];
      const js = L(`const a = "${A}", b = "${B}";`, 'const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));', 'for (let i = 1; i <= a.length; i++) {', '  for (let j = 1; j <= b.length; j++) {', '    d[i][j] = a[i - 1] === b[j - 1]', '      ? d[i - 1][j - 1] + 1', '      : Math.max(d[i - 1][j], d[i][j - 1]);', '  }', '}', 'console.log(d[a.length][b.length]);');
      const py = L(`a, b = "${A}", "${B}"`, 'd = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]', 'for i in range(1, len(a) + 1):', '    for j in range(1, len(b) + 1):', '        if a[i - 1] == b[j - 1]:', '            d[i][j] = d[i - 1][j - 1] + 1', '        else:', '            d[i][j] = max(d[i - 1][j], d[i][j - 1])', 'print(d[len(a)][len(b)])');
      return { kind: 'output', prompt: 'Đoạn code dưới đây (độ dài dãy con chung dài nhất – LCS) in ra gì?', code: { js, py }, answer: String(ans),
        options: numOptions(r, ans, [common, same, ans + 1, ans - 1].filter(v => v > 0), { step: 1, min: 1 }), explain: `LCS của "${A}" và "${B}" có độ dài ${ans}.` };
    } },
    { id: 'p4', domain: 'dp', b: 0.9, a: 1.6, make: r => {
      const n = int(r, 3, 5), mode = pick(r, ['pre', 'post', 'both']);
      const run = md => { const out = []; const f = k => { if (k === 0) return; if (md !== 'post') out.push(k); f(k - 1); if (md !== 'pre') out.push(k); }; f(n); return sp(out); };
      const body = {
        pre: [['  out.push(k);', '  f(k - 1);'], ['    out.append(k)', '    f(k - 1)']],
        post: [['  f(k - 1);', '  out.push(k);'], ['    f(k - 1)', '    out.append(k)']],
        both: [['  out.push(k);', '  f(k - 1);', '  out.push(k);'], ['    out.append(k)', '    f(k - 1)', '    out.append(k)']],
      }[mode];
      const js = L('const out = [];', 'function f(k) {', '  if (k === 0) return;', ...body[0], '}', `f(${n});`, "console.log(out.join(' '));");
      const py = L('out = []', 'def f(k):', '    if k == 0:', '        return', ...body[1], `f(${n})`, "print(' '.join(map(str, out)))");
      const ans = run(mode);
      return { kind: 'output', prompt: 'Đoạn code đệ quy dưới đây in ra gì?', code: { js, py }, answer: ans,
        options: strOptions(r, ans, ['pre', 'post', 'both'].filter(m => m !== mode).map(run).concat([sp(Array.from({ length: n }, (_, i) => i))]), rr => sp(swapAny(rr, ans.split(' ')))),
        explain: mode === 'pre' ? 'Ghi k TRƯỚC lời gọi đệ quy → giảm dần.' : mode === 'post' ? 'Ghi k SAU khi lời gọi đệ quy trả về → tăng dần.' : 'Ghi trước và sau lời gọi đệ quy → giảm dần rồi tăng dần.' };
    } },
    { id: 'p5', domain: 'dp', b: 1.8, a: 1.8, make: r => {
      const N = int(r, 5, 12), fib = k => (k < 2 ? k : fib(k - 1) + fib(k - 2)), calls = k => 2 * fib(k + 1) - 1;
      const ans = calls(N);
      const js = L('let calls = 0;', 'function fib(n) {', '  calls++;', '  if (n < 2) return n;', '  return fib(n - 1) + fib(n - 2);', '}', `fib(${N});`, 'console.log(calls);');
      const py = L('calls = 0', 'def fib(n):', '    global calls', '    calls += 1', '    if n < 2:', '        return n', '    return fib(n - 1) + fib(n - 2)', `fib(${N})`, 'print(calls)');
      return { kind: 'output', prompt: 'Đoạn code dưới đây in ra gì?', code: { js, py }, answer: String(ans),
        options: numOptions(r, ans, [fib(N), calls(N - 1), 2 ** N, N + 1, fib(N + 1)]), explain: `Số lời gọi C(n) = C(n − 1) + C(n − 2) + 1, C(0) = C(1) = 1 → C(${N}) = ${ans}.` };
    } },

    // ═════════ Đồ thị ═════════
    { id: 'g1', domain: 'graph', b: 0.0, a: 1.5, make: r => {
      for (;;) {
        const g = randomGraph(r, 7, int(r, 1, 3)), bfs = bfsOrder(g, 0), dfs = dfsOrder(g, 0);
        if (sp(bfs) === sp(dfs)) continue;
        const ans = sp(bfs);
        return { kind: 'text', prompt: `Đồ thị vô hướng có các cạnh: ${g.text}. Duyệt BFS từ đỉnh 0 (xét các đỉnh kề theo thứ tự tăng dần). Thứ tự thăm các đỉnh là?`, answer: ans,
          options: strOptions(r, ans, [sp(dfs), sp(bfsOrder(g, 0, true)), sp(Array.from({ length: g.n }, (_, i) => i))], rr => sp([0, ...swapAny(rr, bfs.slice(1))])),
          explain: 'BFS thăm hết các đỉnh kề của đỉnh hiện tại trước (dùng hàng đợi), rồi mới đi sâu hơn.' };
      }
    } },
    { id: 'g2', domain: 'graph', b: 0.6, a: 1.6, make: r => {
      for (;;) {
        const g = randomGraph(r, 7, int(r, 1, 3)), bfs = bfsOrder(g, 0), dfs = dfsOrder(g, 0);
        if (sp(bfs) === sp(dfs)) continue;
        const ans = sp(dfs);
        return { kind: 'text', prompt: `Đồ thị vô hướng có các cạnh: ${g.text}. Duyệt DFS đệ quy từ đỉnh 0 (xét các đỉnh kề theo thứ tự tăng dần). Thứ tự thăm các đỉnh là?`, answer: ans,
          options: strOptions(r, ans, [sp(bfs), sp(dfsOrder(g, 0, true)), sp(Array.from({ length: g.n }, (_, i) => i))], rr => sp([0, ...swapAny(rr, dfs.slice(1))])),
          explain: 'DFS đi sâu theo đỉnh kề nhỏ nhất chưa thăm, chỉ quay lui khi hết đường.' };
      }
    } },
    { id: 'g3', domain: 'graph', b: 1.1, a: 1.6, make: r => {
      const g = randomGraph(r, 8, int(r, 1, 3)), d = bfsDist(g, 0), ans = d.reduce((s, x) => s + x, 0);
      return { kind: 'text', prompt: `Đồ thị vô hướng, không trọng số, có các cạnh: ${g.text}. Gọi d(v) là số cạnh trên đường đi ngắn nhất từ đỉnh 0 đến đỉnh v. Tổng d(0) + d(1) + … + d(7) bằng?`, answer: String(ans),
        options: numOptions(r, ans, [g.E.length, ans + 1, ans - 1, Math.max(...d) * 7], { step: 1, min: 1 }), explain: `BFS từ 0 cho d = [${d.join(', ')}] → tổng ${ans}.` };
    } },
    { id: 'g4', domain: 'graph', b: 0.7, a: 1.6, make: r => {
      const n = 9, edges = new Set(), E = [];
      while (E.length < int(r, 4, 6)) { const a = int(r, 0, n - 1), b = int(r, 0, n - 1); const k = `${Math.min(a, b)}-${Math.max(a, b)}`; if (a !== b && !edges.has(k)) { edges.add(k); E.push([Math.min(a, b), Math.max(a, b)]); } }
      E.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      const par = Array.from({ length: n }, (_, i) => i), find = x => (par[x] === x ? x : (par[x] = find(par[x])));
      E.forEach(([a, b]) => { par[find(a)] = find(b); });
      const sizes = {}; for (let i = 0; i < n; i++) sizes[find(i)] = (sizes[find(i)] || 0) + 1;
      const comps = Object.keys(sizes).length, big = Math.max(...Object.values(sizes)), fmt = (c, m) => `${c} thành phần, lớn nhất ${m} đỉnh`;
      const ans = fmt(comps, big);
      return { kind: 'text', prompt: `Đồ thị vô hướng có 9 đỉnh (0 đến 8) và các cạnh: ${E.map(([a, b]) => `${a}–${b}`).join(', ')}. Đồ thị có bao nhiêu thành phần liên thông, và thành phần lớn nhất có bao nhiêu đỉnh?`, answer: ans,
        options: strOptions(r, ans, [fmt(comps + 1, big), fmt(comps - 1, big), fmt(comps, big + 1), fmt(n - E.length, big), fmt(comps, big - 1)].filter(o => !/ 0 |-/.test(o)), rr => fmt(int(rr, 2, 7), int(rr, 2, 6))),
        explain: `Gộp các đỉnh nối với nhau: ${comps} thành phần (tính cả đỉnh đứng riêng), lớn nhất ${big} đỉnh.` };
    } },
    { id: 'g5', domain: 'graph', b: 1.6, a: 1.7, make: r => {
      for (;;) {
        const g = randomGraph(r, 6, int(r, 3, 5), true), t = int(r, 3, 5);
        const dist = Array(6).fill(Infinity); dist[0] = 0; const done = new Set();
        for (let it = 0; it < 6; it++) { let u = -1; for (let v = 0; v < 6; v++) if (!done.has(v) && (u < 0 || dist[v] < dist[u])) u = v; done.add(u); for (const [v, w] of g.adj[u]) dist[v] = Math.min(dist[v], dist[u] + w); }
        // Sai lầm thường gặp: đường ít cạnh nhất, hoặc đi tham lam theo cạnh nhỏ nhất
        const hop = bfsDist(g, 0);
        let fewest = Infinity; (function walk(u, w, seen) { if (seen.size - 1 > hop[t]) return; if (u === t) { if (seen.size - 1 === hop[t]) fewest = Math.min(fewest, w); return; } for (const [v, ww] of g.adj[u]) if (!seen.has(v)) walk(v, w + ww, new Set([...seen, v])); })(0, 0, new Set([0]));
        if (fewest === dist[t]) continue;
        const ans = dist[t];
        return { kind: 'text', prompt: `Đồ thị vô hướng có trọng số (số trong ngoặc): ${g.text}. Độ dài đường đi ngắn nhất từ đỉnh 0 đến đỉnh ${t} là?`, answer: String(ans),
          options: numOptions(r, ans, [fewest, ans + 1, ans - 1, ans + 2], { step: 1, min: 1 }),
          explain: `Dijkstra từ 0: dist[${t}] = ${ans}. Đường ít cạnh nhất lại dài ${fewest} – ít cạnh chưa chắc ngắn nhất.` };
      }
    } },
  ];

  root.DEV_QUESTIONS.forEach(q => { q.k = q.make(rng(1)).options.length; });
  root.DEV_RNG = rng;
})(typeof window !== 'undefined' ? window : globalThis);
