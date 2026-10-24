// ==========================================
// アンカースクロール
// ==========================================

const HEADER_HEIGHT = 80;

function scrollWithOffset(targetId) {
  const target = document.querySelector(targetId);

  if (!target) return;

  const offsetPosition =
    target.offsetTop - HEADER_HEIGHT;

  window.scrollTo({
    top: offsetPosition,
    behavior: "smooth"
  });
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {

    const targetId = this.getAttribute("href");

    if (targetId.length > 1) {
      e.preventDefault();
      scrollWithOffset(targetId);
    }
  });
});


// ==========================================
// ハンバーガーメニュー
// ==========================================

const nav = document.getElementById('nav');
const hamburger = document.getElementById('hamburger');

function closeMenu() {
  nav?.classList.remove('active');
  hamburger?.classList.remove('open');
  hamburger?.setAttribute('aria-expanded', 'false');
}

hamburger?.addEventListener('click', (e) => {
  e.stopPropagation();

  nav?.classList.toggle('active');
  const isOpen = hamburger.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
});

nav?.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    closeMenu();
  }
});

document.addEventListener('click', (e) => {
  if (
    nav &&
    hamburger &&
    !nav.contains(e.target) &&
    !hamburger.contains(e.target)
  ) {
    closeMenu();
  }
});


// ==========================================
// Topへ戻るボタン
// ==========================================

const toTopBtn =
  document.getElementById("toTopBtn");

if (toTopBtn) {

  window.addEventListener("scroll", () => {

    if (window.scrollY > 100) {
      toTopBtn.classList.add("show");
    } else {
      toTopBtn.classList.remove("show");
    }

  }, { passive: true });

  toTopBtn.addEventListener("click", () => {

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  });
}

// ==========================================
// Pythonコードの表示・コピー・ブラウザ実行
// ==========================================

(function () {
  const cards = document.querySelectorAll('[data-code-card]');
  if (!cards.length) return;

  const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  let pyodidePromise = null;

  // Pyodide は「初めて実行ボタンが押されたとき」にだけ読み込む
  function getPyodide() {
    if (!pyodidePromise) {
      pyodidePromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = PYODIDE_URL + 'pyodide.js';
        s.onload = async () => {
          try {
            const py = await loadPyodide({ indexURL: PYODIDE_URL });
            await py.loadPackage('numpy');
            resolve(py);
          } catch (err) {
            reject(err);
          }
        };
        s.onerror = () => reject(new Error('実行環境（Pyodide）の読み込みに失敗しました。'));
        document.head.appendChild(s);
      }).catch(err => {
        pyodidePromise = null; // 次回やり直せるように
        throw err;
      });
    }
    return pyodidePromise;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  cards.forEach(card => {
    const codeEl = card.querySelector('.code-block code');
    const statusEl = card.querySelector('.code-status');
    const copyBtn = card.querySelector('[data-action="copy"]');
    let code = '';

    const setStatus = msg => { statusEl.textContent = msg; };

    // ソースは .py ファイルを1つだけ持ち、表示・コピー・実行すべてで共用する
    const ready = fetch(card.dataset.src)
      .then(res => {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(text => {
        code = text;
        codeEl.textContent = text;
      })
      .catch(() => {
        codeEl.textContent = 'コードを読み込めませんでした。「.py をダウンロード」からご利用ください。';
      });

    copyBtn?.addEventListener('click', async () => {
      await ready;
      if (!code) return;
      await copyText(code);
      setStatus('コードをコピーしました');
      setTimeout(() => { if (statusEl.textContent === 'コードをコピーしました') setStatus(''); }, 2500);
    });

    // 実行ボタンは「実行結果を比べる」の1か所だけ。結果は code-result イベントで渡す
    const run = async () => {
      await ready;
      const finish = (text, error) => {
        card.dispatchEvent(new CustomEvent('code-result', { detail: { text, error } }));
        return !error;
      };
      if (!code) return finish('エラー: コードを読み込めませんでした。', true);

      try {
        const py = await getPyodide();

        const lines = [];
        py.setStdout({ batched: line => lines.push(line) });
        py.setStderr({ batched: line => lines.push(line) });

        const globals = py.globals.get('dict')();
        try {
          await py.runPythonAsync(code, { globals });
        } finally {
          globals.destroy();
        }
        return finish(lines.join('\n'), false);
      } catch (err) {
        return finish('エラー: ' + (err && err.message ? err.message : err), true);
      }
    };

    card.runCode = run;
  });
})();


// ==========================================
// 実行結果の比較（①を基準に、②または③と並べて表示）
// スマホはタブで切り替え、幅があれば2列で表示
// ==========================================

(function () {
  const panel = document.getElementById('comparePanel');
  const runBothBtn = document.getElementById('runBoth');
  const runBothLabel = document.getElementById('runBothLabel');
  const statusEl = document.getElementById('compareStatus');
  const modeBtns = [...document.querySelectorAll('.compare-pair')];
  const cardEls = [...document.querySelectorAll('[data-code-card][data-id]')];
  if (!panel || !cardEls.length) return;

  const cards = Object.fromEntries(cardEls.map(c => [c.dataset.id, c]));
  const results = {};            // id -> { text, error }
  const BASE = '1';              // 常に左に置く基準
  const other = '2';             // 比較相手（②）
  let mode = 'velocity';         // 'velocity'（速度のみ） | 'detail'（詳細）

  const circled = { 1: '①', 2: '②', 3: '③' };
  const tabs = [...panel.querySelectorAll('.compare-tab')];
  const side = {
    a: {
      pane: document.getElementById('cmp-a'),
      title: document.querySelector('#cmp-a .compare-pane-title'),
      out: document.querySelector('#cmp-a .compare-out'),
      tab: document.getElementById('tab-a')
    },
    b: {
      pane: document.getElementById('cmp-b'),
      title: document.querySelector('#cmp-b .compare-pane-title'),
      out: document.querySelector('#cmp-b .compare-out'),
      tab: document.getElementById('tab-b')
    }
  };

  const shortName = id => cards[id]?.dataset.short || id;

  // 「速度のみ」表示：★見出しと速度の行、終了後速度だけを残す
  function velocityOnly(text) {
    const out = [];
    let inPlanet = false;
    text.split('\n').forEach(line => {
      if (line.startsWith('★')) {
        if (out.length) out.push('');
        out.push(line);
        inPlanet = true;
        return;
      }
      if (line.startsWith(FINAL_KEY)) {
        if (out.length) out.push('');
        out.push(line);
        inPlanet = false;
        return;
      }
      if (inPlanet && ITEMS.some(k => line.startsWith(k))) out.push(line);
    });
    return out.join('\n');
  }

  function displayText(r) {
    if (r.error || mode === 'detail') return r.text;
    return velocityOnly(r.text) || r.text;
  }

  // ---- 出力テキストから速度ベクトルを取り出して差を計算する ----
  const diffWrap = document.getElementById('compareDiff');
  const diffBody = document.getElementById('diffBody');
  const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  const ITEMS = [
    'スイングバイ直前の速度（太陽基準）',
    'スイングバイ直前の速度（惑星基準）',
    'スイングバイ直後の速度（惑星基準）',
    'スイングバイ直後の速度（太陽基準）'
  ];
  // 差を表示する項目（ITEMS の番号）：1=直前（惑星基準）, 2=直後（惑星基準）
  // 太陽基準は同じ惑星速度を足すだけなので、差は惑星基準と同じ大きさになる
  const DIFF_COLS = [1, 2];
  const FINAL_KEY = 'スイングバイ終了後速度';
  const PLANETS = ['木星', '土星', '天王星', '海王星'];

  function vecOf(line) {
    const i = line.indexOf('[');
    if (i < 0) return null;
    const nums = line.slice(i).match(NUM);
    return nums && nums.length >= 3 ? nums.slice(0, 3).map(Number) : null;
  }

  function parseVelocities(text) {
    const data = { final: null };
    let planet = null;
    text.split('\n').forEach(line => {
      const m = line.match(/^★\s*(.+?)でのスイングバイ/);
      if (m) { planet = m[1]; data[planet] = {}; return; }
      if (line.startsWith(FINAL_KEY)) { data.final = vecOf(line); planet = null; return; }
      if (!planet) return;
      ITEMS.forEach((key, idx) => {
        if (line.startsWith(key)) {
          const v = vecOf(line);
          if (v) data[planet][idx] = v;
        }
      });
    });
    return data;
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  function fmtDiff(d) {
    if (d < 1e-6) return '0';
    if (d >= 100) return d.toFixed(0);
    return d.toPrecision(3);
  }

  function diffClass(d) {
    if (d < 1e-6) return 'diff-0';
    if (d < 0.01) return 'diff-s';
    if (d < 0.1) return 'diff-m';
    if (d < 1) return 'diff-l';
    return 'diff-x';
  }

  function cell(tag, text, cls) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  function renderDiff() {
    if (!diffWrap || !diffBody) return;
    const ra = results[BASE];
    const rb = results[other];
    if (!ra || !rb || ra.error || rb.error) {
      diffWrap.hidden = true;
      return;
    }
    const A = parseVelocities(ra.text);
    const B = parseVelocities(rb.text);
    diffBody.replaceChildren();

    PLANETS.forEach(p => {
      if (!A[p] || !B[p]) return;
      const tr = document.createElement('tr');
      tr.appendChild(cell('th', p)).scope = 'row';
      DIFF_COLS.forEach(idx => {
        const a = A[p][idx], b = B[p][idx];
        if (!a || !b) { tr.appendChild(cell('td', '—', 'is-na')); return; }
        const d = dist(a, b);
        tr.appendChild(cell('td', fmtDiff(d), diffClass(d)));
      });
      diffBody.appendChild(tr);
    });

    diffWrap.hidden = diffBody.children.length === 0;
  }

  function fill(sideKey, id) {
    const s = side[sideKey];
    const label = shortName(id);
    s.title.textContent = label;
    s.tab.textContent = label;

    const r = results[id];
    s.out.classList.toggle('is-empty', !r);
    s.out.classList.toggle('is-error', !!(r && r.error));
    s.out.textContent = r ? displayText(r) : 'まだ実行されていません。';
    s.out.scrollTop = 0;
    s.out.scrollLeft = 0;
  }

  function render() {
    fill('a', BASE);
    fill('b', other);
    runBothLabel.textContent = `${circled[BASE]}と${circled[other]}を実行して比較`;
    renderDiff();
    modeBtns.forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function showPane(key) {
    // 切り替え前に表示していた側のスクロール位置を覚えておく
    const prev = Object.keys(side).find(k => side[k].pane.classList.contains('is-active'));
    const top = prev ? side[prev].out.scrollTop : 0;
    const left = prev ? side[prev].out.scrollLeft : 0;

    tabs.forEach(t => {
      const on = t.dataset.pane === key;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    Object.keys(side).forEach(k => side[k].pane.classList.toggle('is-active', k === key));

    // 「速度のみ」は①②の位置をそろえ、「詳細」は連動させず先頭から表示する
    if (prev && prev !== key) {
      const linked = mode === 'velocity';
      side[key].out.scrollTop = linked ? top : 0;
      side[key].out.scrollLeft = linked ? left : 0;
    }
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => showPane(t.dataset.pane));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = tabs[(tabs.indexOf(t) + 1) % tabs.length];
      next.focus();
      showPane(next.dataset.pane);
    });
  });

  modeBtns.forEach(b => {
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      render();
      Object.values(side).forEach(s => { s.out.scrollTop = 0; s.out.scrollLeft = 0; });
    });
  });

  // 各カードの実行結果を記録し、表示中の組み合わせに反映する
  Object.entries(cards).forEach(([id, card]) => {
    card.addEventListener('code-result', e => {
      results[id] = e.detail;
      render();
    });
  });

  // 「速度のみ」のときだけ、①②の縦スクロールを連動させる（行を見比べやすくする）
  // 「詳細」は出力の行数が違うので、連動させず別々にスクロールできる
  let syncing = false;
  [['a', 'b'], ['b', 'a']].forEach(([from, to]) => {
    side[from].out.addEventListener('scroll', () => {
      if (syncing || mode !== 'velocity') return;
      syncing = true;
      side[to].out.scrollTop = side[from].out.scrollTop;
      requestAnimationFrame(() => { syncing = false; });
    }, { passive: true });
  });

  runBothBtn?.addEventListener('click', async () => {
    const pair = [BASE, other];
    runBothBtn.disabled = true;
    runBothBtn.classList.add('is-running');
    try {
      let allOk = true;
      for (const id of pair) {
        statusEl.textContent = `${circled[id]}を実行しています…（初回は実行環境の読み込みに時間がかかります）`;
        const ok = await cards[id].runCode();
        allOk = allOk && ok;
      }
      statusEl.textContent = allOk
        ? `${circled[BASE]}と${circled[other]}の実行が完了しました。見比べてみましょう。`
        : '一部の実行に失敗しました。';
      showPane('a');
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      runBothBtn.disabled = false;
      runBothBtn.classList.remove('is-running');
    }
  });

  render();
})();
