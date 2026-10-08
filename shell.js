/* hondana-app：ホーム画面のアプリの入れ物。
   本の画面とデータは非公開の hondana リポジトリにあり、ここには「トークンの設定・読み込み・保存の口」だけを置く。
   トークンはこの端末にだけ保存し、api.github.com 以外には送らない。

   流れ：
   1. トークンが無ければ設定の画面を出す
   2. hondana の site/quiz.html（または site/index.html）を GitHub API で読み、この端末にとっておく
      （次からは、とっておいた版をすぐ出し、裏で新しい版が出ていないかを確かめる）
   3. その HTML に、アイコンなどの頭と「保存の口（bridge）」を足して、この画面に書き出す */
(() => {
  'use strict';
  const CFG = window.HONDANA_APP;
  const REPO = { owner: 'peirin1230-ship-it', name: 'hondana', main: 'main', data: 'app-data' };
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'hondana-app:token';
  const DATA_CACHE = 'hondana-app-data-v1';
  const META_KEY = 'hondana-app:page:' + CFG.file;
  const CACHE_PREFIX = new URL('../__data/', location.href).href;
  const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?' + new URLSearchParams({
    name: 'hondana-app',
    description: 'hondana の推薦棚と知識の棚卸し（ホーム画面のアプリ）から読み書きする',
    target_name: REPO.owner,
    expires_in: '365',
    contents: 'write',
  });
  const root = document.getElementById('shell');

  /* ---------- 小さな道具 ---------- */
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  };
  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } };
  const setToken = t => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 保存できない */ } };
  const getMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) { return null; } };
  const setMeta = m => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* 保存できない */ } };
  const headers = (token, extra) => Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + token }, extra || {});
  const fail = (code, status, message) => Object.assign(new Error(message || code), { code, status });

  async function call(url, token, extra) {
    let res;
    try { res = await fetch(url, { headers: headers(token, extra), cache: 'no-store' }); }
    catch (e) { throw fail('offline', 0, '通信できませんでした'); }
    if (res.status === 401) throw fail('auth', 401, 'トークンが無効になっています。作り直して貼り直してください');
    if (res.status === 404) throw fail('auth', 404, 'トークンの対象に hondana が入っていません（Only select repositories → hondana）');
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') !== '0') throw fail('auth', 403, 'トークンにこのリポジトリを読む権限がありません（Contents）');
    if (!res.ok) throw fail('offline', res.status, `読み込めませんでした（${res.status}）`);
    return res;
  }
  async function cacheGet(sha) {
    try { const c = await caches.open(DATA_CACHE); const r = await c.match(CACHE_PREFIX + sha); return r ? await r.text() : null; } catch (e) { return null; }
  }
  async function cachePut(sha, text) {
    try { const c = await caches.open(DATA_CACHE); await c.put(CACHE_PREFIX + sha, new Response(text, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })); } catch (e) { /* 次も取りにいくだけ */ }
  }

  /* ---------- 画面（設定・読み込み中・失敗） ---------- */
  function frame(...kids) {
    root.replaceChildren(h('div', { class: 'panel' },
      h('div', { class: 'brand' }, h('img', { src: 'icon-180.png', alt: '', width: 64, height: 64 }), h('div', null, h('h1', null, CFG.name), h('p', null, CFG.tagline))),
      kids));
  }
  function loading(text) {
    root.replaceChildren(h('div', { class: 'splash' }, h('img', { src: 'icon-180.png', alt: '', width: 76, height: 76 }), h('p', null, text)));
  }
  function failed(e) {
    frame(h('p', { class: 'lead' }, '読み込めませんでした。'), h('p', { class: 'note' }, e.message || String(e)),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => start() }, 'もう一度')));
  }
  function setup(message) {
    const input = h('input', { id: 'tok', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'github_pat_…', 'aria-describedby': 'tok-status' });
    const status = h('p', { id: 'tok-status', class: 'status', role: 'status' }, message || '');
    const save = h('button', { class: 'btn primary', type: 'submit' }, '保存してひらく');
    const form = h('form', { class: 'token', onsubmit: async ev => {
      ev.preventDefault();
      const t = input.value.trim();
      if (!t) { status.textContent = 'トークンを貼ってください'; return; }
      save.disabled = true; status.textContent = '確かめています…';
      try {
        const res = await call(`${API}/repos/${REPO.owner}/${REPO.name}`, t);
        const j = await res.json();
        setToken(t);
        status.textContent = `${j.full_name} につながりました`;
        start();
      } catch (e) { status.textContent = e.message; save.disabled = false; }
    } }, h('label', { for: 'tok' }, 'トークン'), input, status, h('div', { class: 'row' }, save));
    frame(
      h('p', { class: 'lead' }, '本とクイズのデータは、非公開の hondana リポジトリにあります。最初に一度だけ、GitHub のトークンを貼ってください。'),
      h('ol', { class: 'steps' },
        h('li', null, h('a', { href: TOKEN_URL, target: '_blank', rel: 'noopener' }, 'トークンを作る画面をひらく'), '（名前・期限・Contents の権限は入った状態でひらきます）'),
        h('li', null, '「Repository access」で ', h('b', null, 'Only select repositories → hondana'), ' を選んで、いちばん下の「Generate token」'),
        h('li', null, '出てきた ', h('code', null, 'github_pat_…'), ' をコピーして、下に貼る')),
      form,
      h('p', { class: 'note' }, 'トークンはこの端末にだけ保存し、GitHub 以外には送りません。推薦棚と知識の棚卸しで同じトークンを使えます。'));
    setTimeout(() => input.focus(), 50);
  }

  /* ---------- 読み込みと書き出し ---------- */
  async function latest(token) {
    const dir = CFG.file.split('/').slice(0, -1).join('/');
    const res = await call(`${API}/repos/${REPO.owner}/${REPO.name}/contents/${dir}?ref=${REPO.main}`, token);
    const f = (await res.json()).find(x => x.path === CFG.file);
    if (!f) throw fail('offline', 404, `${CFG.file} が見つかりません`);
    const raw = await call(`${API}/repos/${REPO.owner}/${REPO.name}/git/blobs/${f.sha}`, token, { Accept: 'application/vnd.github.raw+json' });
    return { sha: f.sha, text: await raw.text() };
  }

  async function start() {
    registerSW();
    const token = getToken();
    if (!token) { setup(); return; }
    const meta = getMeta();
    const cached = meta && meta.sha ? await cacheGet(meta.sha) : null;
    if (cached) { mount(cached, meta.sha); return; }
    loading('本棚から読み込んでいます…');
    try {
      const { sha, text } = await latest(token);
      await cachePut(sha, text);
      setMeta({ sha, at: Date.now() });
      mount(text, sha);
    } catch (e) {
      if (e.code === 'auth') { setToken(''); setup(e.message); } else failed(e);
    }
  }

  function headTags() {
    const t = CFG.theme;
    return [
      `<link rel="manifest" href="manifest.webmanifest">`,
      `<link rel="icon" href="icon.svg" type="image/svg+xml">`,
      `<link rel="apple-touch-icon" href="icon-180.png">`,
      `<meta name="apple-mobile-web-app-capable" content="yes">`,
      `<meta name="mobile-web-app-capable" content="yes">`,
      `<meta name="apple-mobile-web-app-status-bar-style" content="default">`,
      `<meta name="apple-mobile-web-app-title" content="${CFG.name}">`,
      `<meta name="theme-color" content="${t.light}" media="(prefers-color-scheme: light)">`,
      `<meta name="theme-color" content="${t.dark}" media="(prefers-color-scheme: dark)">`,
    ].join('\n');
  }

  function mount(html, sha) {
    const cfg = {
      api: API, owner: REPO.owner, repo: REPO.name, main: REPO.main, data: REPO.data,
      tokenKey: TOKEN_KEY, metaKey: META_KEY, cache: DATA_CACHE, cachePrefix: CACHE_PREFIX,
      app: CFG.app, file: CFG.file, sha, links: CFG.links,
    };
    const inject = headTags() + `\n<script>(${bridge.toString()})(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script>\n`;
    const out = html.includes('<head>') ? html.replace('<head>', () => '<head>\n' + inject) : inject + html;
    document.open();
    document.write(out);
    document.close();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || registerSW.done) return;
    registerSW.done = true;
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => { /* なくても動く */ });
  }

  /* ---------- 書き出した画面の中で動く「保存の口」。文字列にして渡すので、外の変数は使わない ---------- */
  function bridge(cfg) {
    'use strict';
    const base = `${cfg.api}/repos/${cfg.owner}/${cfg.repo}`;
    const tok = () => { try { return localStorage.getItem(cfg.tokenKey) || ''; } catch (e) { return ''; } };
    const H = extra => Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + tok() }, extra || {});
    const err = (code, status, message) => Object.assign(new Error(message || code), { code, status });
    const b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
    const b64e = s => { const b = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(bin); };
    const fileUrl = (path, ref) => `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}${ref ? '?ref=' + encodeURIComponent(ref) : ''}`;

    async function call(url, init) {
      let res;
      try { res = await fetch(url, Object.assign({ cache: 'no-store' }, init)); }
      catch (e) { throw err('unavailable', 0, '通信できませんでした'); }
      if (res.status === 401) { authBanner(); throw err('auth', 401, 'トークンが無効になっています'); }
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') throw err('unavailable', 403, 'GitHub の回数制限です。少しおいてから');
      return res;
    }
    async function read(path, branch) {
      const res = await call(fileUrl(path, branch), { headers: H() });
      if (res.status === 404) return null;
      if (res.status === 403) { authBanner(); throw err('auth', 403, 'トークンに読む権限がありません'); }
      if (!res.ok) throw err('unavailable', res.status, `読み込めませんでした（${res.status}）`);
      const j = await res.json();
      if (j.encoding === 'base64' && typeof j.content === 'string' && j.content) return { text: b64d(j.content), sha: j.sha };
      const raw = await call(`${base}/git/blobs/${j.sha}`, { headers: H({ Accept: 'application/vnd.github.raw+json' }) });
      if (!raw.ok) throw err('unavailable', raw.status, `読み込めませんでした（${raw.status}）`);
      return { text: await raw.text(), sha: j.sha };
    }
    async function ensureBranch(branch) {
      const has = await call(`${base}/git/ref/heads/${encodeURIComponent(branch)}`, { headers: H() });
      if (has.ok) return;
      const main = await call(`${base}/git/ref/heads/${encodeURIComponent(cfg.main)}`, { headers: H() });
      if (!main.ok) throw err(main.status === 403 ? 'auth' : 'unavailable', main.status);
      const sha = (await main.json()).object.sha;
      const made = await call(`${base}/git/refs`, { method: 'POST', headers: H({ 'Content-Type': 'application/json' }), body: JSON.stringify({ ref: 'refs/heads/' + branch, sha }) });
      if (!made.ok && made.status !== 422) throw err(made.status === 403 ? 'auth' : 'unavailable', made.status);
    }
    async function write(path, text, sha, message, branch) {
      const body = JSON.stringify(Object.assign({ message, content: b64e(text), branch }, sha ? { sha } : {}));
      const put = () => call(fileUrl(path), { method: 'PUT', headers: H({ 'Content-Type': 'application/json' }), body });
      let res = await put();
      if (!sha && (res.status === 404 || res.status === 422) && branch !== cfg.main) { await ensureBranch(branch); res = await put(); }
      if (res.status === 409 || res.status === 422) throw err('conflict', res.status, 'ほかの端末の保存と重なりました');
      if (res.status === 403) { authBanner(); throw err('auth', 403, 'トークンに書き込みの権限がありません（Contents: Read and write）'); }
      if (res.status === 404) { authBanner(); throw err('auth', 404, 'トークンの対象に hondana が入っていません'); }
      if (!res.ok) throw err('unavailable', res.status, `保存できませんでした（${res.status}）`);
      const j = await res.json();
      return { sha: j.content && j.content.sha };
    }

    /* 知らせ（下に出る短い札）と、トークンが使えないときの帯 */
    const css = document.createElement('style');
    css.textContent = `
      .hb-toast { position: fixed; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 2147483000;
        display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 32px); padding: 10px 12px 10px 16px; border-radius: 10px;
        background: #18202B; color: #FCFCFA; font: 500 13.5px/1.5 system-ui, -apple-system, "Hiragino Sans", sans-serif; box-shadow: 0 10px 28px -10px rgba(0,0,0,.45); }
      .hb-toast button { flex: none; min-height: 34px; padding: 0 12px; border: 0; border-radius: 8px; background: #FCFCFA; color: #18202B; font: inherit; font-weight: 700; cursor: pointer; }
      .hb-auth { position: fixed; left: 0; right: 0; top: 0; z-index: 2147483001; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 14px;
        padding: calc(8px + env(safe-area-inset-top, 0px)) 16px 8px; background: #F0C64F; color: #3A2D07; font: 600 13.5px/1.5 system-ui, -apple-system, "Hiragino Sans", sans-serif; }
      .hb-auth button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 8px; background: #3A2D07; color: #F0C64F; font: inherit; cursor: pointer; }`;
    document.head.append(css);
    let toastEl = null, toastTimer = 0;
    function toast(text, label, action) {
      if (toastEl) toastEl.remove();
      clearTimeout(toastTimer);
      toastEl = document.createElement('div');
      toastEl.className = 'hb-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.append(text);
      if (label) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = action; toastEl.append(b); }
      document.body.append(toastEl);
      toastTimer = setTimeout(() => { if (toastEl) toastEl.remove(); toastEl = null; }, label ? 12000 : 5000);
    }
    function resetToken() {
      try { localStorage.removeItem(cfg.tokenKey); } catch (e) { /* なにもしない */ }
      location.reload();
    }
    let authShown = false;
    function authBanner() {
      if (authShown || !document.body) return;
      authShown = true;
      const bar = document.createElement('div');
      bar.className = 'hb-auth';
      bar.setAttribute('role', 'alert');
      bar.append('GitHub のトークンが使えません。');
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '設定し直す'; b.onclick = resetToken;
      bar.append(b);
      document.body.append(bar);
    }

    /* 新しい版が出ていたら取っておき、ひらき直すか聞く */
    let checkedAt = 0;
    async function checkUpdate() {
      if (Date.now() - checkedAt < 60000) return;
      checkedAt = Date.now();
      try {
        const dir = cfg.file.split('/').slice(0, -1).join('/');
        const res = await call(`${base}/contents/${dir}?ref=${cfg.main}`, { headers: H() });
        if (!res.ok) return;
        const f = (await res.json()).find(x => x.path === cfg.file);
        if (!f || f.sha === cfg.sha) return;
        const raw = await call(`${base}/git/blobs/${f.sha}`, { headers: H({ Accept: 'application/vnd.github.raw+json' }) });
        if (!raw.ok) return;
        const text = await raw.text();
        const c = await caches.open(cfg.cache);
        await c.put(cfg.cachePrefix + f.sha, new Response(text, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
        await c.delete(cfg.cachePrefix + cfg.sha);
        localStorage.setItem(cfg.metaKey, JSON.stringify({ sha: f.sha, at: Date.now() }));
        cfg.sha = f.sha;
        toast('新しい版を読み込みました。', 'ひらき直す', () => location.reload());
      } catch (e) { /* つながらなければ次の機会に */ }
    }
    window.addEventListener('load', () => setTimeout(checkUpdate, 2500));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });

    if (cfg.app === 'quiz') {
      /* 知識の棚卸し：記録は app-data ブランチの quiz/state.json */
      window.HONDANA_GH = {
        read: path => read(path, cfg.data),
        write: (path, text, sha, message) => write(path, text, sha, message + ' [skip ci]', cfg.data),
        links: cfg.links,
        onAuthError: authBanner,
        resetToken,
        toast,
      };
    }

    if (cfg.app === 'shelf') {
      /* 推薦棚：押した反応を recommendations.md の「**反応**」の行にそのまま書く（scripts/apply_reactions.py と同じ書き方） */
      const LABELS = { '◎': '買った', '✓': 'もう読んだ', '○': '気になる', '△': '保留', '×': '興味なし', '-': '' };
      const ENTRY = /^###\s*(\d+)\.\s*『(.+?)』\s*$/;
      const BREAK = /^#{2,3}\s/;
      const REACT = /^\*\*反応\*\*/;
      const parse = text => {
        const map = {};
        let num = null;
        for (const line of text.split('\n')) {
          const m = line.match(ENTRY);
          if (m) { num = Number(m[1]); continue; }
          if (BREAK.test(line)) { num = null; continue; }
          if (num != null && REACT.test(line)) { const rest = line.replace('**反応**', '').trim(); map[num] = rest ? rest.split(/\s+/)[0] : '-'; num = null; }
        }
        return map;
      };
      const apply = (text, changes) => {
        const lines = text.split('\n');
        const applied = [];
        for (const c of changes) {
          const start = lines.findIndex(l => { const m = l.match(ENTRY); return m && Number(m[1]) === c.number; });
          if (start < 0) continue;
          for (let i = start + 1; i < lines.length; i++) {
            if (BREAK.test(lines[i])) break;
            if (REACT.test(lines[i])) {
              const after = `**反応** ${c.to} ${LABELS[c.to] || ''}`.trimEnd();
              if (lines[i] !== after) { lines[i] = after; applied.push(c); }
              break;
            }
          }
        }
        return { text: lines.join('\n'), applied };
      };
      window.HONDANA_SAVE = async changes => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const f = await read('recommendations.md', cfg.main);
          if (!f) throw err('unavailable', 404, 'recommendations.md が見つかりません');
          const { text, applied } = apply(f.text, changes);
          if (!applied.length) return;
          try {
            await write('recommendations.md', text, f.sha, `rec: 反応を更新（アプリから） ${applied.map(c => c.number + '=' + c.to).join(' ')} [skip ci]`, cfg.main);
            return;
          } catch (e) { if (e.code !== 'conflict') throw e; }
        }
        throw err('conflict', 409, 'ほかの更新と重なりました');
      };
      document.addEventListener('DOMContentLoaded', async () => {
        const foot = document.querySelector('.colophon');
        if (foot) {
          const p = document.createElement('p');
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'btn quiet'; b.textContent = 'この端末の GitHub トークンを外す';
          b.onclick = () => { if (b.dataset.sure) resetToken(); else { b.dataset.sure = '1'; b.textContent = 'もう一度押すと外します'; } };
          p.append(b);
          foot.append(p);
        }
        try {
          const f = await read('recommendations.md', cfg.main);
          if (f && window.HONDANA_SHELF) window.HONDANA_SHELF.setBase(parse(f.text));
        } catch (e) { /* 読めなければ、とっておいた画面のまま */ }
      });
    }
  }

  start();
})();
