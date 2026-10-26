(function () {
  'use strict';

  const TIME_LIMIT = 35 * 60; // giây
  const STORE_KEY = 'iqtest.progress.v1';
  const ATTEMPTS_KEY = 'iqtest.attempts';
  const BANK = window.QUESTION_BANK_VERSION;
  const PARAMS = window.IQ_PARAMS && window.IQ_PARAMS.bank === BANK ? window.IQ_PARAMS.items : {};
  const DOMAINS = { number: 'Suy luận số', verbal: 'Ngôn ngữ', logic: 'Logic', spatial: 'Ma trận hình' };
  const LETTERS = 'ABCDEF';
  const { BANDS } = window.IQScore;

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fmtPct = n => n.toLocaleString('vi-VN', { maximumFractionDigits: n < 1 || n > 99 ? 2 : 1 });

  // ───────── Vẽ ô hình (SVG) ─────────
  const SHAPES = {
    circle: s => `<circle r="${s}"/>`,
    square: s => { const h = s * 0.86; return `<rect x="${-h}" y="${-h}" width="${2 * h}" height="${2 * h}"/>`; },
    triangle: s => `<polygon points="0,${-s} ${s * 0.95},${s * 0.75} ${-s * 0.95},${s * 0.75}"/>`,
    diamond: s => `<polygon points="0,${-s} ${s},0 0,${s} ${-s},0"/>`,
    star: s => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.45 : s, ang = -Math.PI / 2 + i * Math.PI / 5;
        pts.push(`${(r * Math.cos(ang)).toFixed(1)},${(r * Math.sin(ang)).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}"/>`;
    },
    arrow: s => `<polygon points="0,${-s} ${s * 0.65},${-s * 0.1} ${s * 0.25},${-s * 0.1} ${s * 0.25},${s} ${-s * 0.25},${s} ${-s * 0.25},${-s * 0.1} ${-s * 0.65},${-s * 0.1}"/>`,
  };
  const POS = {
    1: [[50, 50]],
    2: [[30, 50], [70, 50]],
    3: [[50, 28], [28, 70], [72, 70]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
    6: [[22, 34], [50, 34], [78, 34], [22, 66], [50, 66], [78, 66]],
  };
  const SIZE = { 1: 30, 2: 16, 3: 15, 4: 14, 5: 11, 6: 11 };
  const LINES = {
    top: [20, 20, 80, 20], bottom: [20, 80, 80, 80], left: [20, 20, 20, 80], right: [80, 20, 80, 80],
    h: [20, 50, 80, 50], v: [50, 20, 50, 80], d1: [20, 20, 80, 80], d2: [80, 20, 20, 80],
  };

  function renderCell(spec) {
    let body = '';
    if (spec.lines) {
      body += spec.lines.map(k => { const [x1, y1, x2, y2] = LINES[k]; return `<line class="ln" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join('');
    }
    if (spec.shape) {
      const n = spec.n || 1, size = SIZE[n];
      for (const [x, y] of POS[n]) {
        body += `<g transform="translate(${x} ${y}) rotate(${spec.rot || 0})" class="f-${spec.fill || 'solid'}">${SHAPES[spec.shape](size)}</g>`;
        if (spec.inner) body += `<g transform="translate(${x} ${y})" class="f-${spec.inner.fill || 'solid'}">${SHAPES[spec.inner.shape](11)}</g>`;
      }
    }
    return `<svg viewBox="0 0 100 100" class="fig" aria-hidden="true">${body}</svg>`;
  }

  // ───────── Trạng thái bài làm ─────────
  let state = null, tick = null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Câu hỏi được sắp xếp từ dễ đến khó, thứ tự phương án được xáo trộn mỗi lần làm
  function prepareItems(orders) {
    return window.QUESTIONS.slice().sort((x, y) => x.b - y.b).map((q, i) => {
      let opts, correct;
      if (q.type === 'matrix') {
        opts = [q.gen(2, 2), ...q.distractors].map((s, j) => ({ key: 'o' + j, html: renderCell(s) }));
        correct = 'o0';
      } else {
        opts = q.options.map(o => ({ key: String(o), html: esc(o) }));
        correct = String(q.answer);
      }
      const order = orders ? orders[i] : shuffle(opts.map(o => o.key));
      // Tham số IRT đã chuẩn hoá từ dữ liệu thực (nếu có) thay cho ước lượng ban đầu
      const p = PARAMS[q.id] || {};
      return { ...q, a: p.a || q.a, b: p.b !== undefined ? p.b : q.b, k: opts.length, correct, order, opts: order.map(k => opts.find(o => o.key === k)) };
    });
  }

  function save() {
    if (!state) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ age: state.age, consent: state.consent, answers: state.answers, idx: state.idx, start: state.start, orders: state.items.map(q => q.order) }));
    } catch (e) { /* bộ nhớ trình duyệt không khả dụng */ }
  }
  function clearSaved() { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* bỏ qua */ } }
  function loadSaved() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY));
      if (d && d.age && Date.now() - d.start < TIME_LIMIT * 1000 && d.orders.length === window.QUESTIONS.length) return d;
    } catch (e) { /* bỏ qua */ }
    return null;
  }

  function askAge() {
    $('#age-err').hidden = true;
    $('#consent-row').hidden = !window.IQ_CONFIG.collectUrl;
    $('#age-dialog').showModal();
    $('#age-input').focus();
  }

  function startTest(saved, age, consent) {
    const items = prepareItems(saved && saved.orders);
    state = {
      items,
      age: saved ? saved.age : age,
      consent: saved ? !!saved.consent : consent,
      answers: saved ? saved.answers : new Array(items.length).fill(null),
      idx: saved ? saved.idx : 0,
      start: saved ? saved.start : Date.now(),
    };
    save();
    show('test');
    renderPalette();
    renderQuestion();
    clearInterval(tick);
    tick = setInterval(updateTimer, 500);
    updateTimer();
  }

  function remaining() { return Math.max(0, TIME_LIMIT - Math.floor((Date.now() - state.start) / 1000)); }

  function updateTimer() {
    const r = remaining();
    const el = $('#timer');
    el.textContent = `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
    el.classList.toggle('warn', r <= 120);
    if (r === 0) finish();
  }

  // ───────── Hiển thị câu hỏi ─────────
  function renderQuestion() {
    const q = state.items[state.idx], n = state.items.length;
    $('#q-count').textContent = `Câu ${state.idx + 1} / ${n}`;
    $('#q-domain').textContent = DOMAINS[q.domain];
    $('#progress-bar').style.width = `${(state.answers.filter(a => a !== null).length / n) * 100}%`;

    let stem = '';
    if (q.type === 'matrix') {
      let cells = '';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        cells += r === 2 && c === 2 ? '<div class="m-cell m-missing">?</div>' : `<div class="m-cell">${renderCell(q.gen(r, c))}</div>`;
      }
      stem = `<h2 class="q-title">Hình nào điền vào ô trống?</h2>${q.prompt ? `<p class="q-hint">${esc(q.prompt)}</p>` : ''}<div class="matrix">${cells}</div>`;
    } else if (q.seq) {
      stem = `<h2 class="q-title">${esc(q.prompt)}</h2><div class="seq">${q.seq.map(x => `<span>${x}</span>`).join('')}<span class="seq-q">?</span></div>`;
    } else {
      stem = `<h2 class="q-title">${esc(q.prompt)}</h2>`;
    }

    const chosen = state.answers[state.idx];
    const opts = q.opts.map((o, i) => `
      <button class="opt ${q.type === 'matrix' ? 'opt-fig' : ''} ${chosen === o.key ? 'is-on' : ''}" data-key="${esc(o.key)}">
        <span class="opt-l">${LETTERS[i]}</span><span class="opt-v">${o.html}</span>
      </button>`).join('');

    $('#q-card').innerHTML = `${stem}<div class="opts ${q.type === 'matrix' ? 'opts-fig' : ''}">${opts}</div>`;
    $('#btn-prev').disabled = state.idx === 0;
    $('#btn-next').textContent = state.idx === n - 1 ? 'Xem lại ↺' : 'Câu tiếp →';
    updatePalette();
  }

  function renderPalette() {
    $('#palette').innerHTML = state.items.map((_, i) => `<button class="pal" data-i="${i}" aria-label="Câu ${i + 1}">${i + 1}</button>`).join('');
  }
  function updatePalette() {
    document.querySelectorAll('.pal').forEach((b, i) => {
      b.classList.toggle('done', state.answers[i] !== null);
      b.classList.toggle('cur', i === state.idx);
    });
  }

  function choose(key) {
    state.answers[state.idx] = key;
    save();
    renderQuestion();
    // Tự chuyển sang câu tiếp theo sau khi chọn
    setTimeout(() => { if (state && state.idx < state.items.length - 1 && $('#screen-test').hidden === false) go(state.idx + 1); }, 260);
  }

  function go(i) {
    if (!state) return;
    state.idx = (i + state.items.length) % state.items.length;
    save();
    renderQuestion();
    if ($('#q-card').getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function askSubmit() {
    const left = state.answers.filter(a => a === null).length;
    $('#confirm-text').textContent = left
      ? `Bạn còn ${left} câu chưa trả lời. Câu bỏ trống được tính là sai.`
      : 'Bạn đã trả lời tất cả câu hỏi. Xem kết quả ngay?';
    const dlg = $('#confirm');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else if (confirm($('#confirm-text').textContent)) finish();
  }

  // ───────── Chấm điểm & kết quả ─────────
  function finish() {
    if (!state) return;
    clearInterval(tick);
    const { items, answers } = state;
    const resp = items.map((q, i) => (answers[i] === q.correct ? 1 : 0));
    const res = window.IQScore.score(items, resp, state.age);
    res.correct = resp.reduce((s, x) => s + x, 0);
    res.total = items.length;
    res.elapsed = Math.min(TIME_LIMIT, Math.floor((Date.now() - state.start) / 1000));
    res.domains = Object.keys(DOMAINS).map(d => {
      const idx = items.map((q, i) => i).filter(i => items[i].domain === d);
      return { name: DOMAINS[d], total: idx.length, right: idx.filter(i => resp[i]).length };
    });
    clearSaved();
    submitAnonymous(items, answers, res.elapsed);
    $('#nav-cta').textContent = 'Làm lại';
    renderResult(res, items, resp);
    state = null;
    show('result');
    window.scrollTo(0, 0);
  }

  /*
   * Gửi kết quả ẩn danh để chuẩn hoá lại tham số IRT (tools/calibrate.py).
   * Chỉ gồm: tuổi, đúng/sai/bỏ trống từng câu, phương án đã chọn, thời gian, lần làm thứ mấy.
   */
  function submitAnonymous(items, answers, elapsed) {
    let attempt = 1;
    try {
      attempt = (parseInt(localStorage.getItem(ATTEMPTS_KEY), 10) || 0) + 1;
      localStorage.setItem(ATTEMPTS_KEY, String(attempt));
    } catch (e) { /* bỏ qua */ }

    const url = window.IQ_CONFIG.collectUrl;
    if (!url || !state.consent) return;
    const responses = {}, choices = {};
    items.forEach((q, i) => {
      responses[q.id] = answers[i] === null ? null : answers[i] === q.correct ? 1 : 0;
      if (answers[i] !== null) choices[q.id] = answers[i];
    });
    const body = JSON.stringify({ bank: BANK, age: state.age, attempt, elapsed, timeLimit: TIME_LIMIT, responses, choices });
    try {
      // text/plain để không phát sinh preflight CORS khi gửi tới endpoint khác domain (VD Google Apps Script)
      fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' } }).catch(() => {});
    } catch (e) { /* không ảnh hưởng tới việc xem kết quả */ }
  }

  function bellCurve(iq, band) {
    const W = 720, H = 240, top = 24, base = H - 36;
    const X = v => ((v - 40) / 120) * W;
    const pdf = v => Math.exp(-((v - 100) ** 2) / (2 * 225));
    const Y = v => base - pdf(v) * (base - top);
    const area = (a, b) => {
      let d = `M${X(a).toFixed(1)},${base}`;
      for (let v = a; v <= b + 0.001; v += 0.5) d += ` L${X(v).toFixed(1)},${Y(v).toFixed(1)}`;
      return d + ` L${X(b).toFixed(1)},${base} Z`;
    };
    const areas = BANDS.map(b => {
      const a = Math.max(40, b.min), e = Math.min(160, b.max);
      return `<path d="${area(a, e)}" fill="${b.color}" opacity="${b === band ? 1 : 0.35}"/>`;
    }).join('');
    let outline = '';
    for (let v = 40; v <= 160; v += 0.5) outline += `${v === 40 ? 'M' : 'L'}${X(v).toFixed(1)},${Y(v).toFixed(1)} `;
    const ticks = [55, 70, 85, 100, 115, 130, 145].map(v =>
      `<line x1="${X(v)}" x2="${X(v)}" y1="${base}" y2="${base + 6}" class="tick"/><text x="${X(v)}" y="${base + 22}" class="tick-t">${v}</text>`).join('');
    const mx = X(iq);
    const lblX = Math.min(Math.max(mx, 40), W - 40);
    return `<svg viewBox="0 0 ${W} ${H}" class="bell" role="img" aria-label="Vị trí IQ ${iq} trên phân phối chuẩn">
      ${areas}<path d="${outline}" class="bell-line"/>
      <line x1="0" x2="${W}" y1="${base}" y2="${base}" class="axis"/>${ticks}
      <line x1="${mx}" x2="${mx}" y1="${top - 4}" y2="${base}" class="marker"/>
      <circle cx="${mx}" cy="${Y(iq)}" r="6" class="marker-dot"/>
      <text x="${lblX}" y="${top - 8}" class="marker-t">Bạn · ${iq}</text>
    </svg>`;
  }

  function renderResult(res, items, resp) {
    const b = res.band;
    const better = res.percentile;
    const rarity = Math.abs(res.z) >= 1 ? `Cứ khoảng <strong>${Math.round(res.rarity).toLocaleString('vi-VN')}</strong> người mới có 1 người đạt mức ${res.z > 0 ? 'này trở lên' : 'này trở xuống'}.` : 'Bạn thuộc nhóm phổ biến nhất của dân số.';
    const mm = Math.floor(res.elapsed / 60), ss = res.elapsed % 60;

    const scale = BANDS.map(x => `
      <li class="${x === b ? 'is-you' : ''}" style="--c:${x.color}">
        <span class="sc-range">${rangeText(x)}</span>
        <span class="sc-label">${x.label}</span>
        <span class="sc-pct">${fmtPct(window.IQScore.bandShare(x))}%</span>
        ${x === b ? '<span class="sc-you">Bạn ở đây</span>' : ''}
      </li>`).join('');

    const domains = res.domains.map(d => `
      <div class="dom">
        <div class="dom-h"><span>${d.name}</span><span>${d.right}/${d.total}</span></div>
        <div class="dom-bar"><div style="width:${(d.right / d.total) * 100}%"></div></div>
      </div>`).join('');

    const review = items.map((q, i) => {
      const right = q.opts.find(o => o.key === q.correct);
      const title = q.type === 'matrix' ? 'Ma trận hình' : q.seq ? q.seq.join(', ') + ', ?' : q.prompt;
      return `<li class="${resp[i] ? 'ok' : 'no'}">
        <span class="rv-mark">${resp[i] ? '✓' : '✕'}</span>
        <span class="rv-q"><b>Câu ${i + 1}.</b> ${esc(title)}</span>
        <span class="rv-a ${q.type === 'matrix' ? 'rv-fig' : ''}">${right.html}</span>
      </li>`;
    }).join('');

    $('#result').innerHTML = `
      <section class="r-hero" style="--c:${b.color}">
        <p class="eyebrow">Kết quả của bạn</p>
        <div class="r-score">${res.iq}</div>
        <div class="r-band"><span class="r-dot"></span>${b.label}<small>${b.sub}</small></div>
        <p class="r-desc">${b.desc}</p>
        <div class="r-stats">
          <div><strong>${fmtPct(better)}%</strong><span>Cao hơn ${fmtPct(better)}% người ${res.ageGroup}</span></div>
          <div><strong>${res.ci[0]}–${res.ci[1]}</strong><span>Khoảng tin cậy 95%</span></div>
          <div><strong>${res.correct}/${res.total}</strong><span>Câu đúng · ${mm} phút ${ss} giây</span></div>
        </div>
        <p class="r-rarity">${rarity}</p>
        <p class="r-age">Chuẩn so sánh: nhóm <strong>${res.ageGroup}</strong>${res.adultIq !== res.iq ? ` · Nếu so với người trưởng thành 20–34 tuổi: <strong>${res.adultIq}</strong>` : ''}</p>
      </section>

      <section class="r-card">
        <h3>Vị trí của bạn trên phân phối chuẩn</h3>
        ${bellCurve(res.iq, b)}
      </section>

      <div class="r-two">
        <section class="r-card">
          <h3>Thang phân loại IQ</h3>
          <ul class="scale">${scale}</ul>
        </section>
        <section class="r-card">
          <h3>Điểm theo lĩnh vực</h3>
          ${domains}
          <h3 class="mt">Quy đổi sang các thang khác</h3>
          <table class="conv">
            <tr><td>Wechsler / Stanford-Binet 5 (SD 15)</td><td>${res.iq}</td></tr>
            <tr><td>Stanford-Binet cũ / Otis (SD 16)</td><td>${res.sd16}</td></tr>
            <tr><td>Cattell III B (SD 24)</td><td>${res.sd24}</td></tr>
            <tr><td>Điểm z</td><td>${res.z >= 0 ? '+' : ''}${res.z.toFixed(2)}</td></tr>
          </table>
        </section>
      </div>

      <details class="r-card review">
        <summary>Xem đáp án từng câu</summary>
        <ul>${review}</ul>
      </details>

      <div class="r-actions">
        <button class="btn btn-yellow btn-lg" data-action="restart">Làm lại bài test</button>
        <button class="btn btn-ghost btn-lg" data-go="intro">Về trang chủ</button>
      </div>
      <p class="disclaimer">Kết quả mang tính tham khảo. Điểm có thể dao động ±${Math.round((res.ci[1] - res.ci[0]) / 2)} điểm giữa các lần làm. Muốn có kết quả chẩn đoán, hãy làm bài test chuẩn hoá với chuyên gia tâm lý.</p>`;
  }

  function rangeText(b) {
    if (b.min === -Infinity) return `≤ ${b.max - 1}`;
    if (b.max === Infinity) return `≥ ${b.min}`;
    return `${b.min}–${b.max - 1}`;
  }

  function renderBandGrid() {
    $('#band-grid').innerHTML = BANDS.map(b => `
      <article class="band-card" style="--c:${b.color}">
        <span class="band-range">${rangeText(b)}</span>
        <h3>${b.label}</h3>
        <p class="band-sub">${b.sub}</p>
        <p class="band-desc">${b.desc}</p>
        <span class="band-pct">${fmtPct(window.IQScore.bandShare(b))}% dân số</span>
      </article>`).join('');
  }

  // ───────── Điều hướng màn hình ─────────
  function show(name) {
    ['intro', 'test', 'result'].forEach(s => { $('#screen-' + s).hidden = s !== name; });
    $('#nav-status').hidden = name !== 'test';
    $('#nav-cta').hidden = name === 'test';
    document.body.dataset.screen = name;
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.action === 'start' || t.dataset.action === 'restart') {
      e.preventDefault();
      const saved = t.dataset.action === 'start' ? loadSaved() : null;
      if (saved) { startTest(saved); window.scrollTo(0, 0); }
      else askAge();
    } else if (t.id === 'age-cancel') {
      $('#age-dialog').close();
    } else if (t.dataset.go === 'intro') {
      if (state) return e.preventDefault(); // đang làm bài thì không rời trang
      show('intro');
      if (!t.getAttribute('href') || t.getAttribute('href') === '#') { e.preventDefault(); window.scrollTo(0, 0); }
    } else if (t.classList.contains('opt')) {
      choose(t.dataset.key);
    } else if (t.classList.contains('pal')) {
      go(+t.dataset.i);
    } else if (t.id === 'btn-prev') {
      go(state.idx - 1);
    } else if (t.id === 'btn-next') {
      go(state.idx + 1);
    } else if (t.id === 'btn-submit') {
      askSubmit();
    } else if (t.id === 'confirm-ok') {
      $('#confirm').close();
      finish();
    } else if (t.id === 'confirm-cancel') {
      $('#confirm').close();
    }
  });

  $('#age-form').addEventListener('submit', e => {
    e.preventDefault();
    const { AGE_MIN, AGE_MAX } = window.IQScore;
    const age = Math.round(Number($('#age-input').value));
    if (!(age >= AGE_MIN && age <= AGE_MAX)) { $('#age-err').hidden = false; return; }
    $('#age-dialog').close();
    startTest(null, age, !!window.IQ_CONFIG.collectUrl && $('#consent-input').checked);
    window.scrollTo(0, 0);
  });

  document.addEventListener('keydown', e => {
    if (!state || $('#confirm').open || $('#age-dialog').open) return;
    const q = state.items[state.idx];
    const n = parseInt(e.key, 10);
    const li = LETTERS.indexOf(e.key.toUpperCase());
    if (n >= 1 && n <= q.opts.length) choose(q.opts[n - 1].key);
    else if (li >= 0 && li < q.opts.length && e.key.length === 1) choose(q.opts[li].key);
    else if (e.key === 'ArrowRight') go(state.idx + 1);
    else if (e.key === 'ArrowLeft') go(state.idx - 1);
  });

  window.addEventListener('beforeunload', save);

  renderBandGrid();
  show('intro');
  if (loadSaved()) $('#nav-cta').textContent = 'Tiếp tục làm bài';
})();
