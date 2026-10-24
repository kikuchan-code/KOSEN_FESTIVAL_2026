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
}

hamburger?.addEventListener('click', (e) => {
  e.stopPropagation();

  nav?.classList.toggle('active');
  hamburger.classList.toggle('open');
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
    const outEl = card.querySelector('.code-output');
    const statusEl = card.querySelector('.code-status');
    const runBtn = card.querySelector('[data-action="run"]');
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

    runBtn?.addEventListener('click', async () => {
      await ready;
      if (!code) return;

      runBtn.disabled = true;
      outEl.classList.remove('is-error');
      setStatus('実行環境を準備しています…（初回は時間がかかります）');

      try {
        const py = await getPyodide();
        setStatus('実行中…');

        const lines = [];
        py.setStdout({ batched: line => lines.push(line) });
        py.setStderr({ batched: line => lines.push(line) });

        const globals = py.globals.get('dict')();
        try {
          await py.runPythonAsync(code, { globals });
        } finally {
          globals.destroy();
        }

        outEl.hidden = false;
        outEl.textContent = lines.join('\n');
        setStatus('実行が完了しました');
        outEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        outEl.hidden = false;
        outEl.classList.add('is-error');
        outEl.textContent = 'エラー: ' + (err && err.message ? err.message : err);
        setStatus('実行に失敗しました');
      } finally {
        runBtn.disabled = false;
      }
    });
  });
})();
