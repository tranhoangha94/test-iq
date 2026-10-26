/*
 * Tạo một bộ đề từ ngân hàng khuôn (dùng chung cho app.js và tools/validate_items.js).
 *  - Mỗi khuôn chọn một seed → một biến thể; tránh các biến thể người dùng đã gặp (seen).
 *  - Vị trí đáp án đúng (A, B, C…) được phân bổ CÂN BẰNG trong cả bộ đề và không để
 *    cùng một chữ cái đúng 3 câu liên tiếp; các phương án nhiễu xếp ngẫu nhiên vào chỗ còn lại.
 */
(function (root) {
  'use strict';

  const SEEN_MAX = 40;

  // Khoá nhận diện nội dung một biến thể (để biết người dùng đã gặp chưa)
  function variantKey(q, v) {
    const body = q.type === 'matrix'
      ? [0, 1, 2, 3, 4, 5, 6, 7].map(i => root.IQ_CANON(v.gen(Math.floor(i / 3), i % 3))).join('|')
      : `${v.prompt}|${v.seq ? v.seq.join(',') : ''}|${v.answer}`;
    let h = 2166136261; // FNV-1a
    for (let i = 0; i < body.length; i++) { h ^= body.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function makeVariant(q, seed) {
    const v = q.make(root.IQ_RNG(seed));
    let opts, correct;
    if (q.type === 'matrix') {
      opts = [v.gen(2, 2), ...v.distractors].map((spec, j) => ({ key: 'o' + j, spec }));
      correct = 'o0';
    } else {
      opts = v.options.map(o => ({ key: String(o), label: String(o) }));
      correct = String(v.answer);
    }
    return { v, opts, correct };
  }

  /*
   * build({ rand, seen, saved })
   *  rand  : hàm ngẫu nhiên [0, 1)
   *  seen  : { [id]: [variantKey…] } các biến thể đã gặp
   *  saved : { seeds, orders } để khôi phục bộ đề đang làm dở
   * Trả về { items, seen } (seen đã cập nhật).
   */
  function build({ rand = Math.random, seen = {}, saved = null } = {}) {
    const qs = root.QUESTIONS.slice().sort((x, y) => x.b - y.b);
    const params = root.IQ_PARAMS && root.IQ_PARAMS.bank === root.QUESTION_BANK_VERSION ? root.IQ_PARAMS.items : {};
    const nextSeen = { ...seen };
    const answerCount = new Map(); // số lần mỗi đáp án (dạng chữ/số) đã xuất hiện trong bộ đề
    const made = qs.map((q, i) => {
      let seed, m, key;
      if (saved) {
        seed = saved.seeds[i];
        m = makeVariant(q, seed);
      } else {
        // Chọn biến thể chưa gặp, và có đáp án chưa xuất hiện quá 2 lần trong bộ đề này
        const old = new Set(seen[q.id] || []);
        for (let t = 0; t < 40; t++) {
          seed = Math.floor(rand() * 4294967296);
          m = makeVariant(q, seed);
          key = variantKey(q, m.v);
          const repeatedAnswer = q.type !== 'matrix' && (answerCount.get(m.correct) || 0) >= 2;
          if (!old.has(key) && !repeatedAnswer) break;
        }
        if (q.type !== 'matrix') answerCount.set(m.correct, (answerCount.get(m.correct) || 0) + 1);
        nextSeen[q.id] = [...(seen[q.id] || []), key].slice(-SEEN_MAX);
      }
      return { q, seed, ...m };
    });

    const positions = saved ? null : balancedPositions(made.map(x => x.opts.length), rand);
    const items = made.map((x, i) => {
      let order;
      if (saved) {
        order = saved.orders[i];
      } else {
        const pos = positions[i];
        const others = x.opts.filter(o => o.key !== x.correct).map(o => o.key);
        for (let j = others.length - 1; j > 0; j--) { const r = Math.floor(rand() * (j + 1)); [others[j], others[r]] = [others[r], others[j]]; }
        order = [...others.slice(0, pos), x.correct, ...others.slice(pos)];
      }
      const p = params[x.q.id] || {};
      return {
        id: x.q.id, domain: x.q.domain, type: x.q.type, k: x.opts.length,
        a: p.a || x.q.a, b: p.b !== undefined ? p.b : x.q.b,
        seed: x.seed, order, correct: x.correct,
        prompt: x.v.prompt, seq: x.v.seq, gen: x.v.gen, explain: x.v.explain,
        opts: order.map(key => x.opts.find(o => o.key === key)),
      };
    });
    return { items, seen: nextSeen };
  }

  /*
   * Vị trí đáp án cho cả bộ đề. Các câu có cùng số phương án k được chia vị trí 0..k−1 đều nhau
   * (xoay vòng từ một điểm ngẫu nhiên, gán cho các câu theo thứ tự ngẫu nhiên) → mỗi chữ cái
   * xuất hiện gần như bằng nhau. Sau đó tráo vị trí giữa các câu cùng k để không có 3 câu liền
   * cùng một chữ cái.
   */
  function balancedPositions(ks, rand) {
    const shuffle = a => { for (let j = a.length - 1; j > 0; j--) { const r = Math.floor(rand() * (j + 1)); [a[j], a[r]] = [a[r], a[j]]; } return a; };
    const pos = new Array(ks.length), groups = {};
    ks.forEach((k, i) => (groups[k] = groups[k] || []).push(i));
    for (const [k, idx] of Object.entries(groups)) {
      const start = Math.floor(rand() * k), bag = shuffle(idx.map((_, j) => (start + j) % Number(k)));
      shuffle(idx.slice()).forEach((i, j) => { pos[i] = bag[j]; });
    }
    const badAt = i => i >= 2 && pos[i] === pos[i - 1] && pos[i] === pos[i - 2];
    const anyBadNear = i => [i, i + 1, i + 2].some(j => j < pos.length && badAt(j));
    for (let pass = 0; pass < 50; pass++) {
      const bad = pos.findIndex((_, i) => badAt(i));
      if (bad < 0) break;
      const peers = shuffle(groups[ks[bad]].filter(j => pos[j] !== pos[bad]));
      for (const j of peers) {
        [pos[bad], pos[j]] = [pos[j], pos[bad]];
        if (!anyBadNear(bad) && !anyBadNear(j)) break;
        [pos[bad], pos[j]] = [pos[j], pos[bad]];
      }
    }
    return pos;
  }

  root.IQForm = { build, variantKey, makeVariant };
})(typeof window !== 'undefined' ? window : globalThis);
