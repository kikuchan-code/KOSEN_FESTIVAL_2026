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

  // id → カード（③が①②のコードを受け取るために使う）
  const byId = {};
  cards.forEach(c => { if (c.dataset.id) byId[c.dataset.id] = c; });

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

  const fileName = card => card.dataset.src.split('/').pop();

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

    // 他のカード（③）がこのコードを読み込めるようにする
    card.getCode = async () => { await ready; return code; };

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
      const finish = (text, error, data = null) => {
        card.dispatchEvent(new CustomEvent('code-result', { detail: { text, error, data } }));
        return !error;
      };
      if (!code) return finish('エラー: コードを読み込めませんでした。', true);

      try {
        const py = await getPyodide();

        // ③のように他の .py を読み込むプログラムは、仮想ファイルとして同じフォルダに置く
        const needs = (card.dataset.requires || '').split(',').filter(Boolean);
        if (needs.length) {
          const cwd = py.runPython('import os\nos.getcwd()');
          for (const id of needs) {
            const dep = byId[id];
            const depCode = dep ? await dep.getCode() : '';
            if (!depCode) throw new Error(`${fileName(dep || card)} を読み込めませんでした。`);
            py.FS.writeFile(`${cwd}/${fileName(dep)}`, depCode);
          }
        }

        const lines = [];
        py.setStdout({ batched: line => lines.push(line) });
        py.setStderr({ batched: line => lines.push(line) });

        const globals = py.globals.get('dict')();
        let data = null;
        try {
          await py.runPythonAsync(code, { globals });

          // DIFF_RESULT があれば、表の作成用に JavaScript のデータとして受け取る
          const proxy = globals.get('DIFF_RESULT');
          if (proxy) {
            data = typeof proxy.toJs === 'function'
              ? proxy.toJs({ dict_converter: Object.fromEntries, create_proxies: false })
              : proxy;
            if (typeof proxy.destroy === 'function') proxy.destroy();
          }
        } finally {
          globals.destroy();
        }
        return finish(lines.join('\n'), false, data);
      } catch (err) {
        return finish('エラー: ' + (err && err.message ? err.message : err), true);
      }
    };

    card.runCode = run;
  });
})();


// ==========================================
// 実行結果の比較（①を基準に②と並べて表示し、③が計算した差を表にする）
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
  const results = {};            // id -> { text, error, data }
  const BASE = '1';              // 常に左に置く基準
  const other = '2';             // 比較相手（②）
  const DIFF_ID = '3';           // 差を計算するプログラム（③）
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

  // スマホ幅かどうか（狭いときは「速度のみ」を折り返して表示する）
  const mqMobile = window.matchMedia('(max-width: 600px)');

  // 「速度のみ」に残す行の見出し（py の print の先頭と同じ文字）
  const ITEMS = [
    'スイングバイ直前の速度（太陽基準）',
    'スイングバイ直前の速度（惑星基準）',
    'スイングバイ直後の速度（惑星基準）',
    'スイングバイ直後の速度（太陽基準）'
  ];
  const TIME_KEYS = ['データの時間', 'シミュレーションの時間', '最接近日'];
  const FINAL_KEY = 'スイングバイ終了後速度';
  // スマホでは「見出し」と「値」を2行に分ける行
  const SPLIT_KEYS = [...ITEMS, FINAL_KEY, 'データの時間', 'シミュレーションの時間'];

  // 「速度のみ」表示：★見出し、時間、速度の行、終了後速度だけを残す
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
      if (inPlanet && (ITEMS.some(k => line.startsWith(k)) || TIME_KEYS.some(k => line.startsWith(k)))) {
        out.push(line);
      }
    });
    return out.join('\n');
  }

  // スマホ用：「見出し =」のあとで改行し、値の余分な空白をつめて横スクロールを避ける
  function reflowForMobile(text) {
    return text.split('\n').map(line => {
      if (!SPLIT_KEYS.some(k => line.startsWith(k))) return line;
      const m = line.match(/^(.*?)\s*(=|：)\s*(.+)$/);
      if (!m) return line;
      const value = m[3].replace(/\[\s+/, '[').replace(/\s{2,}/g, ' ');
      return `${m[1]} ${m[2]}\n  ${value}`;
    }).join('\n');
  }

  function displayText(r) {
    if (r.error || mode === 'detail') return r.text;
    const v = velocityOnly(r.text) || r.text;
    return mqMobile.matches ? reflowForMobile(v) : v;
  }

  // ---- ③が計算した速度の差を表にする ----
  const diffWrap = document.getElementById('compareDiff');
  const diffBody = document.getElementById('diffBody');
  const diffFinal = document.getElementById('diffFinal');
  const diffText = document.getElementById('diffText');

  function fmtDiff(d) {
    if (d < 1e-6) return '0';
    if (d >= 100) return d.toFixed(0);
    return d.toPrecision(3);
  }

  // 符号つき（＋は②のほうが速い）
  function fmtSigned(d) {
    const a = Math.abs(d);
    if (a < 1e-6) return '0';
    return (d > 0 ? '+' : '−') + fmtDiff(a);
  }

  function diffClass(d) {
    const a = Math.abs(d);
    if (a < 1e-6) return 'diff-0';
    if (a < 0.01) return 'diff-s';
    if (a < 0.1) return 'diff-m';
    if (a < 1) return 'diff-l';
    return 'diff-x';
  }

  // 表の列（キーは ③の DIFF_RESULT と同じ名前）
  const DIFF_COLS = [
    { key: 'pre_dv',  label: 'スイングバイ直前 |Δv|',    signed: false },
    { key: 'post_dv', label: 'スイングバイ直後 |Δv|',    signed: false },
    { key: 'pre_ds',  label: 'スイングバイ直前 Δ速さ',   signed: true },
    { key: 'post_ds', label: 'スイングバイ直後 Δ速さ',   signed: true }
  ];

  function cell(tag, text, cls) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  function renderDiff() {
    if (!diffWrap || !diffBody) return;
    const r = results[DIFF_ID];
    const planets = r && !r.error && r.data && Array.isArray(r.data.planets) ? r.data.planets : [];
    if (!planets.length) {
      diffWrap.hidden = true;
      return;
    }

    diffBody.replaceChildren();
    planets.forEach(p => {
      const tr = document.createElement('tr');

      // 惑星名と、計算に使った時間（シミュレーション期間）
      const th = document.createElement('th');
      th.scope = 'row';
      th.appendChild(cell('span', p.planet, 'diff-planet'));
      th.appendChild(cell('small', `${p.period}（${p.days}日間）`, 'diff-period'));
      th.appendChild(cell('small', `最接近 ${p.closest}`, 'diff-period'));
      tr.appendChild(th);

      DIFF_COLS.forEach(col => {
        const v = p[col.key];
        if (typeof v !== 'number') {
          const td = cell('td', '—', 'is-na');
          td.dataset.label = col.label;
          tr.appendChild(td);
          return;
        }
        const td = cell('td', col.signed ? fmtSigned(v) : fmtDiff(v), diffClass(v));
        td.dataset.label = col.label;
        tr.appendChild(td);
      });
      diffBody.appendChild(tr);
    });

    // 海王星を通過したあとの最終的な速度（太陽基準）
    const f = r.data.final;
    if (diffFinal && f && typeof f.dv === 'number') {
      diffFinal.textContent =
        `海王星を通過したあとの速度（太陽基準）は、①と②で |Δv| = ${fmtDiff(f.dv)} km/s、` +
        `速さは ①${f.speed_1.toFixed(2)} km/s・②${f.speed_2.toFixed(2)} km/s（差 ${fmtSigned(f.ds)} km/s）です。`;
      diffFinal.hidden = false;
    } else if (diffFinal) {
      diffFinal.hidden = true;
    }

    if (diffText) diffText.textContent = r.text || '';
    diffWrap.hidden = false;
  }

  function fill(sideKey, id) {
    const s = side[sideKey];
    const label = shortName(id);
    s.title.textContent = label;
    s.tab.textContent = label;

    const r = results[id];
    s.out.classList.toggle('is-empty', !r);
    s.out.classList.toggle('is-error', !!(r && r.error));
    // スマホの「速度のみ」だけ折り返す（詳細は横スクロール）
    s.out.classList.toggle('is-wrap', mode === 'velocity' && mqMobile.matches);
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

  // 画面の向きを変えたときも表示を作り直す
  if (typeof mqMobile.addEventListener === 'function') {
    mqMobile.addEventListener('change', render);
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
    // ①②を実行してから、③で速度の差を計算する
    const order = [BASE, other, DIFF_ID].filter(id => cards[id]);
    runBothBtn.disabled = true;
    runBothBtn.classList.add('is-running');
    try {
      let allOk = true;
      for (const id of order) {
        statusEl.textContent = id === DIFF_ID
          ? `${circled[id]}で速度の差を計算しています…`
          : `${circled[id]}を実行しています…（初回は実行環境の読み込みに時間がかかります）`;
        const ok = await cards[id].runCode();
        allOk = allOk && ok;
      }
      statusEl.textContent = allOk
        ? `${circled[BASE]}と${circled[other]}の実行と、${circled[DIFF_ID]}での差の計算が完了しました。見比べてみましょう。`
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
