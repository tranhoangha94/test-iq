(function () {
  'use strict';

  const TIME_LIMIT = 40 * 60; // giây
  const STORE_KEY = 'devtest.progress.v1';
  const SEEN_KEY = 'devtest.seen';
  const LANG_KEY = 'devtest.lang';
  const LETTERS = 'ABCDEF';
  const TOPICS = { complexity: 'Độ phức tạp', ds: 'Cấu trúc dữ liệu', read: 'Đọc code', sort: 'Sắp xếp & tìm kiếm', dp: 'Đệ quy & QHĐ', graph: 'Đồ thị' };

  // Cấp độ theo năng lực θ (thang IRT, trung bình 0, độ lệch chuẩn 1)
  const LEVELS = [
    { min: -Infinity, max: -1, name: 'Intern', color: '#FF8A3D', desc: 'Đang làm quen với tư duy thuật toán. Hãy luyện đọc code và phân tích vòng lặp.' },
    { min: -1, max: 0, name: 'Junior', color: '#FFEF0A', desc: 'Nắm được các cấu trúc dữ liệu cơ bản và đọc được code đơn giản.' },
    { min: 0, max: 1, name: 'Mid-level', color: '#B8F03C', desc: 'Vững sắp xếp, tìm kiếm, đệ quy; phân tích độ phức tạp tốt.' },
    { min: 1, max: 2, name: 'Senior', color: '#3CD6A0', desc: 'Thành thạo quy hoạch động và đồ thị; nhận ra bẫy độ phức tạp.' },
    { min: 2, max: Infinity, name: 'Expert', color: '#3C7BFF', desc: 'Tư duy thuật toán xuất sắc, xử lý tốt cả những câu khó nhất.' },
  ];
  const levelOf = t => LEVELS.find(l => t >= l.min && t < l.max);

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } };
  let lang = readJSON(LANG_KEY, 'js');

  // Tô màu cú pháp đơn giản: chuỗi, số, từ khoá
  const KW = /^(for|while|if|else|return|function|const|let|new|def|in|and|or|not|global|from|import|break|of|range|len|print|max|min|map|str|float)$/;
  function highlight(code) {
    return code.replace(/("[^"]*"|'[^']*')|(\b\d+\b)|([A-Za-z_]\w*)|([^"'\w]+)/g, (m, s, n, w, rest) => {
      if (s) return `<span class="tk-s">${esc(s)}</span>`;
      if (n) return `<span class="tk-n">${n}</span>`;
      if (w) return KW.test(w) ? `<span class="tk-k">${w}</span>` : w;
      return esc(rest);
    });
  }

  // ───────── Trạng thái ─────────
  let state = null, tick = null;

  function prepareItems(saved) {
    const { items, seen } = window.IQForm.build({
      questions: window.DEV_QUESTIONS, rngFn: window.DEV_RNG, bank: window.DEV_BANK_VERSION, params: null,
      seen: readJSON(SEEN_KEY, {}), saved: saved && { seeds: saved.seeds, orders: saved.orders },
    });
    if (!saved) writeJSON(SEEN_KEY, seen);
    return items;
  }
  function save() {
    if (state) writeJSON(STORE_KEY, { answers: state.answers, idx: state.idx, start: state.start, seeds: state.items.map(q => q.seed), orders: state.items.map(q => q.order) });
  }
  function loadSaved() {
    const d = readJSON(STORE_KEY, null);
    return d && d.seeds && d.seeds.length === window.DEV_QUESTIONS.length && Date.now() - d.start < TIME_LIMIT * 1000 ? d : null;
  }
  function clearSaved() { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* bỏ qua */ } }

  function startTest(saved) {
    const items = prepareItems(saved);
    state = { items, answers: saved ? saved.answers : new Array(items.length).fill(null), idx: saved ? saved.idx : 0, start: saved ? saved.start : Date.now() };
    save();
    show('test');
    $('#palette').innerHTML = items.map((_, i) => `<button class="pal" data-i="${i}" aria-label="Câu ${i + 1}">${i + 1}</button>`).join('');
    renderQuestion();
    clearInterval(tick);
    tick = setInterval(updateTimer, 500);
    updateTimer();
    window.scrollTo(0, 0);
  }

  function updateTimer() {
    const r = Math.max(0, TIME_LIMIT - Math.floor((Date.now() - state.start) / 1000));
    $('#timer').textContent = `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
    $('#timer').classList.toggle('warn', r <= 120);
    if (r === 0) finish();
  }

  function codeBlock(code) {
    if (!code) return '';
    return `<div class="code-wrap">
      <div class="lang-tabs" role="tablist">
        <button class="lang-tab ${lang === 'js' ? 'is-on' : ''}" data-lang="js">JavaScript</button>
        <button class="lang-tab ${lang === 'py' ? 'is-on' : ''}" data-lang="py">Python</button>
      </div>
      <pre class="code"><code>${highlight(code[lang])}</code></pre>
    </div>`;
  }

  function renderQuestion() {
    const q = state.items[state.idx], n = state.items.length;
    $('#q-count').textContent = `Câu ${state.idx + 1} / ${n}`;
    $('#q-domain').textContent = TOPICS[q.domain];
    $('#progress-bar').style.width = `${(state.answers.filter(a => a !== null).length / n) * 100}%`;
    const chosen = state.answers[state.idx];
    const opts = q.opts.map((o, i) => `
      <button class="opt ${chosen === o.key ? 'is-on' : ''}" data-key="${esc(o.key)}">
        <span class="opt-l">${LETTERS[i]}</span><span class="opt-v opt-mono">${esc(o.label)}</span>
      </button>`).join('');
    $('#q-card').innerHTML = `<h2 class="q-title q-title-sm">${esc(q.prompt)}</h2>${codeBlock(q.code)}<div class="opts">${opts}</div>`;
    $('#btn-prev').disabled = state.idx === 0;
    $('#btn-next').textContent = state.idx === n - 1 ? 'Xem lại ↺' : 'Câu tiếp →';
    document.querySelectorAll('.pal').forEach((b, i) => { b.classList.toggle('done', state.answers[i] !== null); b.classList.toggle('cur', i === state.idx); });
  }

  function choose(key) {
    state.answers[state.idx] = key;
    save();
    renderQuestion();
    setTimeout(() => { if (state && state.idx < state.items.length - 1) go(state.idx + 1); }, 260);
  }
  function go(i) {
    if (!state) return;
    state.idx = (i + state.items.length) % state.items.length;
    save();
    renderQuestion();
    if ($('#q-card').getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ───────── Kết quả ─────────
  function finish() {
    if (!state) return;
    clearInterval(tick);
    const { items, answers } = state;
    const resp = items.map((q, i) => (answers[i] === q.correct ? 1 : 0));
    const { theta, se } = window.IQScore.estimateTheta(items, resp, 0);
    const elapsed = Math.min(TIME_LIMIT, Math.floor((Date.now() - state.start) / 1000));
    clearSaved();
    renderResult({ theta, se, items, answers, resp, elapsed });
    state = null;
    $('#nav-cta').textContent = 'Làm lại';
    show('result');
    window.scrollTo(0, 0);
  }

  function levelBar(theta) {
    const lo = -3, hi = 3, x = t => ((Math.min(hi, Math.max(lo, t)) - lo) / (hi - lo)) * 100;
    const segs = LEVELS.map(l => `<div class="lv-seg" style="left:${x(l.min)}%;width:${x(l.max) - x(l.min)}%;--c:${l.color}"><span>${l.name}</span></div>`).join('');
    return `<div class="lv-bar">${segs}<div class="lv-mark" style="left:${x(theta)}%"></div></div>`;
  }

  function renderResult({ theta, se, items, answers, resp, elapsed }) {
    const lv = levelOf(theta), correct = resp.reduce((s, x) => s + x, 0);
    const range = [levelOf(theta - 1.96 * se).name, levelOf(theta + 1.96 * se).name];
    const topics = Object.keys(TOPICS).map(d => {
      const idx = items.map((q, i) => i).filter(i => items[i].domain === d), right = idx.filter(i => resp[i]).length;
      return `<div class="dom"><div class="dom-h"><span>${TOPICS[d]}</span><span>${right}/${idx.length}</span></div><div class="dom-bar"><div style="width:${(right / idx.length) * 100}%"></div></div></div>`;
    }).join('');
    const review = items.map((q, i) => {
      const right = q.opts.find(o => o.key === q.correct).label, mine = answers[i];
      return `<li class="${resp[i] ? 'ok' : 'no'}">
        <div class="rv-head"><span class="rv-mark">${resp[i] ? '✓' : '✕'}</span><b>Câu ${i + 1}.</b> <span class="rv-topic">${TOPICS[q.domain]}</span></div>
        <p class="rv-q">${esc(q.prompt)}</p>
        ${q.code ? `<pre class="code code-sm"><code>${highlight(q.code[lang])}</code></pre>` : ''}
        <p class="rv-a">Đáp án: <b class="opt-mono">${esc(right)}</b>${!resp[i] ? ` · Bạn chọn: <span class="opt-mono">${mine === null ? 'bỏ trống' : esc(mine)}</span>` : ''}</p>
        <p class="rv-ex">${esc(q.explain)}</p>
      </li>`;
    }).join('');
    const mm = Math.floor(elapsed / 60), ss = elapsed % 60;

    $('#result').innerHTML = `
      <section class="r-hero" style="--c:${lv.color}">
        <p class="eyebrow">Cấp độ của bạn</p>
        <div class="r-score r-score-word">${lv.name}</div>
        <p class="r-desc">${lv.desc}</p>
        <div class="r-stats">
          <div><strong>${correct}/${items.length}</strong><span>Câu đúng</span></div>
          <div><strong>${range[0] === range[1] ? range[0] : `${range[0]} – ${range[1]}`}</strong><span>Khoảng tin cậy 95%</span></div>
          <div><strong>${mm}:${String(ss).padStart(2, '0')}</strong><span>Thời gian làm bài</span></div>
        </div>
      </section>
      <section class="r-card"><h3>Vị trí trên thang cấp độ</h3>${levelBar(theta)}</section>
      <section class="r-card"><h3>Điểm theo chủ đề</h3>${topics}</section>
      <details class="r-card review" open>
        <summary>Đáp án và lời giải</summary>
        <ul>${review}</ul>
      </details>
      <div class="r-actions">
        <button class="btn btn-yellow btn-lg" data-action="restart">Làm bộ đề mới</button>
        <a class="btn btn-ghost btn-lg" href="index.html">Sang IQ Test</a>
      </div>
      <p class="disclaimer">Cấp độ là ước lượng tham khảo dựa trên độ khó dự kiến của từng câu, chưa chuẩn hoá trên dữ liệu lập trình viên thực tế.</p>`;
  }

  function renderLevels() {
    $('#level-grid').innerHTML = LEVELS.map(l => `
      <article class="band-card" style="--c:${l.color}">
        <h3>${l.name}</h3>
        <p class="band-desc">${l.desc}</p>
      </article>`).join('');
  }

  function show(name) {
    ['intro', 'test', 'result'].forEach(s => { $('#screen-' + s).hidden = s !== name; });
    $('#nav-status').hidden = name !== 'test';
    $('#nav-cta').hidden = name === 'test';
    document.body.dataset.screen = name;
  }

  function askSubmit() {
    const left = state.answers.filter(a => a === null).length;
    $('#confirm-text').textContent = left ? `Bạn còn ${left} câu chưa trả lời. Câu bỏ trống được tính là sai.` : 'Bạn đã trả lời tất cả câu hỏi. Xem kết quả ngay?';
    $('#confirm').showModal();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.action === 'start' || t.dataset.action === 'restart') { e.preventDefault(); startTest(t.dataset.action === 'start' ? loadSaved() : null); }
    else if (t.dataset.go === 'intro') { if (state) return e.preventDefault(); show('intro'); }
    else if (t.classList.contains('lang-tab')) { lang = t.dataset.lang; writeJSON(LANG_KEY, lang); renderQuestion(); }
    else if (t.classList.contains('opt')) choose(t.dataset.key);
    else if (t.classList.contains('pal')) go(+t.dataset.i);
    else if (t.id === 'btn-prev') go(state.idx - 1);
    else if (t.id === 'btn-next') go(state.idx + 1);
    else if (t.id === 'btn-submit') askSubmit();
    else if (t.id === 'confirm-ok') { $('#confirm').close(); finish(); }
    else if (t.id === 'confirm-cancel') $('#confirm').close();
  });
  document.addEventListener('keydown', e => {
    if (!state || $('#confirm').open) return;
    const q = state.items[state.idx], n = parseInt(e.key, 10);
    if (n >= 1 && n <= q.opts.length) choose(q.opts[n - 1].key);
    else if (e.key === 'ArrowRight') go(state.idx + 1);
    else if (e.key === 'ArrowLeft') go(state.idx - 1);
  });
  window.addEventListener('beforeunload', save);

  renderLevels();
  show('intro');
  if (loadSaved()) $('#nav-cta').textContent = 'Tiếp tục làm bài';
})();
