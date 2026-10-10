import * as pdfjsLib from './lib/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.min.mjs', import.meta.url).href;

/* ───────────── i18n ───────────── */
const T = {
  zh: {
    appName: '乐谱翻页', tagline: '滑动翻页，专心演奏',
    email: '邮箱', password: '密码', login: '登录', register: '注册',
    toRegister: '没有账号？去注册', toLogin: '已有账号？去登录',
    confirmPw: '确认密码', displayNameOpt: '显示名称（可选）',
    errEmail: '请输入有效的邮箱', errPwLen: '密码至少 6 位', errPwMatch: '两次密码不一致',
    errExists: '该邮箱已注册', errBad: '邮箱或密码不正确', errCrypto: '当前环境不支持加密，请使用 https 或已安装的应用打开',
    tabLib: '乐谱', tabSign: '签到', tabMe: '我的',
    hello: '你好', myScores: '我的乐谱', upload: '＋ 上传 PDF',
    emptyLib: '还没有乐谱<br>点击右上角上传 PDF 乐谱', pages: '页', page: '页',
    delConfirm: '确定删除这份乐谱吗？', notPdf: '请选择 PDF 文件', loadFail: '无法打开这个 PDF',
    uploading: '正在导入…', imported: '已导入',
    checkin: '签到', signNow: '今日签到', signedToday: '今天已签到 ✓', signedOk: '签到成功！',
    streak: '连续签到', total: '累计签到', days: '天', today: '今天',
    profile: '个人资料', name: '姓名', displayName: '显示名称', language: '语言',
    changePhoto: '更换头像', save: '保存', saved: '已保存', logout: '退出登录',
    install: '安装到主屏幕', installTip: 'iPhone / iPad：用 Safari 打开，点分享按钮，选择「添加到主屏幕」。安卓：在 Chrome 菜单选择「安装应用」。',
    close: '关闭', spread: '双页', single: '单页', hintSwipe: '左右滑动或点击屏幕两侧翻页',
    resume: '继续阅读', dataNote: '所有数据只保存在这台设备上。',
    weekdays: ['日','一','二','三','四','五','六'],
  },
  en: {
    appName: 'Sheet Turner', tagline: 'Swipe to turn. Just play.',
    email: 'Email', password: 'Password', login: 'Log in', register: 'Sign up',
    toRegister: 'No account? Sign up', toLogin: 'Have an account? Log in',
    confirmPw: 'Confirm password', displayNameOpt: 'Display name (optional)',
    errEmail: 'Enter a valid email', errPwLen: 'Password must be at least 6 characters', errPwMatch: 'Passwords do not match',
    errExists: 'This email is already registered', errBad: 'Wrong email or password', errCrypto: 'Encryption is unavailable here. Open over https or from the installed app.',
    tabLib: 'Scores', tabSign: 'Check-in', tabMe: 'Me',
    hello: 'Hi', myScores: 'My scores', upload: '+ Upload PDF',
    emptyLib: 'No scores yet<br>Tap the button above to upload a PDF', pages: 'pages', page: 'page',
    delConfirm: 'Delete this score?', notPdf: 'Please choose a PDF file', loadFail: 'Could not open this PDF',
    uploading: 'Importing…', imported: 'Imported',
    checkin: 'Check-in', signNow: 'Check in today', signedToday: 'Checked in today ✓', signedOk: 'Checked in!',
    streak: 'Current streak', total: 'Total days', days: 'd', today: 'Today',
    profile: 'Profile', name: 'Name', displayName: 'Display name', language: 'Language',
    changePhoto: 'Change photo', save: 'Save', saved: 'Saved', logout: 'Log out',
    install: 'Install to home screen', installTip: 'iPhone / iPad: open in Safari, tap Share, then "Add to Home Screen". Android: Chrome menu → "Install app".',
    close: 'Close', spread: 'Two pages', single: 'One page', hintSwipe: 'Swipe, or tap the screen edges, to turn pages',
    resume: 'Resume', dataNote: 'All data stays on this device.',
    weekdays: ['S','M','T','W','T','F','S'],
  },
};
let lang = localStorage.getItem('ms_lang') || 'zh';
const t = (k) => T[lang][k] ?? k;
function setLang(l) {
  lang = l; localStorage.setItem('ms_lang', l);
  document.documentElement.lang = l === 'zh' ? 'zh' : 'en';
  document.title = t('appName');
}

/* ───────────── helpers ───────────── */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1800);
}
const b64e = (u8) => btoa(String.fromCharCode(...u8));
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ───────────── local accounts ───────────── */
const USERS_KEY = 'ms_users', SESSION_KEY = 'ms_session';
const getUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; } };
const putUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));
async function hashPw(pw, saltB64) {
  if (!globalThis.crypto?.subtle) throw new Error('nocrypto');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(saltB64), iterations: 150000, hash: 'SHA-256' }, key, 256);
  return b64e(new Uint8Array(bits));
}
let session = localStorage.getItem(SESSION_KEY);
const me = () => getUsers()[session];
function updateMe(fn) { const u = getUsers(); fn(u[session]); putUsers(u); }

async function register(email, pw, display) {
  const users = getUsers();
  if (users[email]) throw new Error('errExists');
  const salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
  users[email] = { salt, hash: await hashPw(pw, salt), name: '', display: display || email.split('@')[0], avatar: '', checkins: [], created: Date.now() };
  putUsers(users);
  session = email; localStorage.setItem(SESSION_KEY, email);
}
async function login(email, pw) {
  const u = getUsers()[email];
  if (!u || (await hashPw(pw, u.salt)) !== u.hash) throw new Error('errBad');
  session = email; localStorage.setItem(SESSION_KEY, email);
}
function logout() { session = null; localStorage.removeItem(SESSION_KEY); render(); }

/* ───────────── IndexedDB (PDF storage) ───────────── */
let dbp;
function db() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('sheetturner', 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore('pdfs', { keyPath: 'id' }); s.createIndex('owner', 'owner'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t_ = d.transaction('pdfs', mode); const out = fn(t_.objectStore('pdfs')); t_.oncomplete = () => res(out.result); t_.onerror = () => rej(t_.error); }); };
const dbPut = (rec) => tx('readwrite', (s) => s.put(rec));
const dbGet = (id) => tx('readonly', (s) => s.get(id));
const dbDel = (id) => tx('readwrite', (s) => s.delete(id));
const dbList = (owner) => tx('readonly', (s) => s.index('owner').getAll(owner));

/* ───────────── state / routing ───────────── */
let tab = 'lib';
let calView = { y: new Date().getFullYear(), m: new Date().getMonth() };
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (session && tab === 'me') render(); });

const root = $('#app');
function render() {
  setLang(lang);
  if (!session || !me()) { session = null; return renderAuth(); }
  root.innerHTML = `<div class="page" id="page"></div>
    <nav class="tabbar">
      ${[['lib', '♪', 'tabLib'], ['sign', '✓', 'tabSign'], ['me', '☺', 'tabMe']].map(([k, ic, lbl]) =>
        `<button data-tab="${k}" class="${tab === k ? 'on' : ''}"><span class="ic">${ic}</span>${t(lbl)}</button>`).join('')}
    </nav>`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
  ({ lib: renderLibrary, sign: renderCheckin, me: renderProfile })[tab]();
}

/* ───────────── auth screen ───────────── */
let authMode = 'login';
function renderAuth() {
  const reg = authMode === 'register';
  root.innerHTML = `
    <div class="langrow"><button id="lg">${lang === 'zh' ? 'English' : '中文'}</button></div>
    <form class="auth" id="af" novalidate>
      <h1>${t('appName')}</h1><p class="sub">${t('tagline')}</p>
      <label class="field"><span>${t('email')}</span><input id="em" type="email" autocomplete="email" inputmode="email" autocapitalize="off"></label>
      ${reg ? `<label class="field"><span>${t('displayNameOpt')}</span><input id="dn" type="text" maxlength="30"></label>` : ''}
      <label class="field"><span>${t('password')}</span><input id="pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
      ${reg ? `<label class="field"><span>${t('confirmPw')}</span><input id="pw2" type="password" autocomplete="new-password"></label>` : ''}
      <div class="err" id="err"></div>
      <button class="btn" type="submit">${reg ? t('register') : t('login')}</button>
      <button class="link" type="button" id="sw">${reg ? t('toLogin') : t('toRegister')}</button>
      <p class="sub" style="text-align:center;font-size:12px;margin-top:18px">${t('dataNote')}</p>
    </form>`;
  $('#lg').onclick = () => { setLang(lang === 'zh' ? 'en' : 'zh'); renderAuth(); };
  $('#sw').onclick = () => { authMode = reg ? 'login' : 'register'; renderAuth(); };
  $('#af').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#em').value.trim().toLowerCase(), pw = $('#pw').value, err = $('#err');
    err.textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (err.textContent = t('errEmail'));
    try {
      if (reg) {
        if (pw.length < 6) return (err.textContent = t('errPwLen'));
        if (pw !== $('#pw2').value) return (err.textContent = t('errPwMatch'));
        await register(email, pw, $('#dn').value.trim());
      } else await login(email, pw);
      tab = 'lib'; render();
    } catch (x) {
      err.textContent = x.message === 'nocrypto' ? t('errCrypto') : (T[lang][x.message] || x.message);
    }
  };
}

/* ───────────── library ───────────── */
async function renderLibrary() {
  const u = me(), page = $('#page');
  page.innerHTML = `
    <div class="lib-head"><h2>${t('hello')}, ${esc(u.display || u.name || '')}</h2>
      <button class="btn small" id="up">${t('upload')}</button></div>
    <input type="file" id="file" accept="application/pdf,.pdf" class="hidden" multiple>
    <div id="list"></div>`;
  $('#up').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    for (const f of files) await importPdf(f);
    renderLibrary();
  };
  const list = (await dbList(session)).sort((a, b) => b.added - a.added);
  const box = $('#list');
  if (!list.length) { box.innerHTML = `<div class="empty">${t('emptyLib')}</div>`; return; }
  box.innerHTML = `<div class="grid">${list.map((r) => {
    const prog = +localStorage.getItem(`ms_prog_${session}_${r.id}`) || 1;
    return `<div class="sheet" data-id="${r.id}">
      <button class="del" data-del="${r.id}" aria-label="delete">✕</button>
      <div class="thumb"><img src="${r.thumb}" alt=""></div>
      <div class="meta"><div class="name">${esc(r.name)}</div>
      <div class="sub">${prog}/${r.pages} ${t('pages')}</div></div></div>`;
  }).join('')}</div>`;
  box.querySelectorAll('.sheet').forEach((el) => el.onclick = (e) => {
    if (e.target.closest('[data-del]')) return;
    openReader(el.dataset.id);
  });
  box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm(t('delConfirm'))) return;
    await dbDel(b.dataset.del); localStorage.removeItem(`ms_prog_${session}_${b.dataset.del}`); renderLibrary();
  });
}
async function importPdf(file) {
  if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) return toast(t('notPdf'));
  toast(t('uploading'));
  try {
    const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await task.promise;
    const pg = await pdf.getPage(1), vp0 = pg.getViewport({ scale: 1 });
    const scale = 360 / vp0.width, vp = pg.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
    await dbPut({ id, owner: session, name: file.name.replace(/\.pdf$/i, ''), blob: file, pages: pdf.numPages, thumb: c.toDataURL('image/jpeg', 0.7), added: Date.now() });
    await task.destroy();
  } catch (e) { console.error(e); toast(t('loadFail')); }
}

/* ───────────── page-turner reader ───────────── */
async function openReader(id) {
  const rec = await dbGet(id);
  if (!rec) return;
  let pdf, task;
  try { task = pdfjsLib.getDocument({ data: new Uint8Array(await rec.blob.arrayBuffer()) }); pdf = await task.promise; }
  catch (e) { console.error(e); return toast(t('loadFail')); }
  const n = pdf.numPages, progKey = `ms_prog_${session}_${id}`;
  let spread = localStorage.getItem('ms_spread');
  spread = spread === null ? innerWidth > innerHeight * 1.2 : spread === '2';
  let p = clamp(+localStorage.getItem(progKey) || 1, 1, n);
  if (spread && p % 2 === 0) p -= 1; // spreads start on odd pages
  let gen = 0, barsOn = true, wake = null;
  const cache = new Map();

  const el = document.createElement('div'); el.className = 'reader';
  el.innerHTML = `
    <div class="bar top" id="bt"><button id="x">✕ ${t('close')}</button><div class="title">${esc(rec.name)}</div><button id="sp"></button></div>
    <div class="stage" id="st"><div class="pages" id="pg"></div></div>
    <div class="bar bot" id="bb"><button id="pv">‹</button><input type="range" id="sl" min="1" max="${n}" step="1"><span class="pg" id="pn"></span><button id="nx">›</button></div>
    <div class="hint" id="hint">${t('hintSwipe')}</div>`;
  document.body.appendChild(el);
  const stage = $('#st', el), pages = $('#pg', el), bt = $('#bt', el), bb = $('#bb', el);
  stage.style.touchAction = 'none';
  setTimeout(() => { $('#hint', el).style.opacity = 0; }, 2800);
  const setBars = (on) => { barsOn = on; bt.classList.toggle('off', !on); bb.classList.toggle('off', !on); };
  setTimeout(() => setBars(false), 2200);

  const count = () => (spread ? 2 : 1);
  const shown = () => (spread ? [p, p + 1].filter((x) => x <= n) : [p]);

  async function pageCanvas(num, cssW, cssH) {
    const key = `${num}@${Math.round(cssW)}x${Math.round(cssH)}`;
    if (cache.has(key)) return cache.get(key);
    const pg = await pdf.getPage(num), vp1 = pg.getViewport({ scale: 1 });
    const fit = Math.min(cssW / vp1.width, cssH / vp1.height);
    const dpr = Math.min(devicePixelRatio || 1, 2.5);
    const vp = pg.getViewport({ scale: fit * dpr });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    c.style.width = `${Math.floor(vp.width / dpr)}px`; c.style.height = `${Math.floor(vp.height / dpr)}px`;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    cache.set(key, c);
    while (cache.size > 8) cache.delete(cache.keys().next().value);
    return c;
  }
  async function show(dir = 0) {
    const my = ++gen;
    const w = stage.clientWidth, h = stage.clientHeight, list = shown();
    const cw = (w - (list.length - 1) * 2) / list.length;
    const canv = await Promise.all(list.map((x) => pageCanvas(x, cw, h)));
    if (my !== gen) return;
    pages.style.transition = 'none';
    pages.replaceChildren(...canv);
    pages.style.transform = `translateX(${dir * 28}px)`; pages.style.opacity = dir ? 0 : 1;
    void pages.offsetWidth;
    pages.style.transition = ''; pages.style.transform = 'none'; pages.style.opacity = 1;
    $('#pn', el).textContent = list.length > 1 ? `${list[0]}-${list[1]} / ${n}` : `${list[0]} / ${n}`;
    $('#sl', el).value = p;
    $('#sp', el).textContent = spread ? t('single') : t('spread');
    localStorage.setItem(progKey, String(p));
    // prefetch neighbours
    const nxt = p + count(), prv = p - count();
    [nxt, nxt + 1, prv, prv + 1].filter((x) => x >= 1 && x <= n).forEach((x) => pageCanvas(x, cw, h).catch(() => {}));
  }
  function turn(d) {
    const np = clamp(p + d * count(), 1, n);
    if (np === p || (d > 0 && p + count() > n)) {
      pages.style.transition = 'transform .12s'; pages.style.transform = `translateX(${-d * 14}px)`;
      setTimeout(() => { pages.style.transform = 'none'; }, 120); return;
    }
    p = np; show(d);
  }
  function jump(to) { p = clamp(to, 1, n); if (spread && p % 2 === 0) p -= 1; show(0); }

  // gestures: swipe or tap edges
  let sx = 0, sy = 0, st = 0, pointers = 0, multi = false;
  stage.addEventListener('pointerdown', (e) => { pointers++; if (pointers > 1) multi = true; else { multi = false; sx = e.clientX; sy = e.clientY; st = Date.now(); } });
  stage.addEventListener('pointercancel', () => { pointers = Math.max(0, pointers - 1); });
  stage.addEventListener('pointerup', (e) => {
    pointers = Math.max(0, pointers - 1);
    if (multi) { if (pointers === 0) multi = false; return; }
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) return turn(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && Date.now() - st < 450) {
      const f = e.clientX / stage.clientWidth;
      if (f < 0.28) turn(-1); else if (f > 0.72) turn(1); else setBars(!barsOn);
    }
  });
  const onKey = (e) => {
    if (['ArrowRight', 'PageDown', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); turn(1); }
    else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) { e.preventDefault(); turn(-1); }
    else if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  let rt; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { cache.clear(); show(0); }, 200); };
  addEventListener('resize', onResize); addEventListener('orientationchange', onResize);

  $('#pv', el).onclick = () => turn(-1);
  $('#nx', el).onclick = () => turn(1);
  $('#sl', el).oninput = (e) => jump(+e.target.value);
  $('#sp', el).onclick = () => { spread = !spread; localStorage.setItem('ms_spread', spread ? '2' : '1'); if (spread && p % 2 === 0) p -= 1; cache.clear(); show(0); };
  async function close() {
    document.removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize); removeEventListener('orientationchange', onResize);
    try { await wake?.release(); } catch {}
    el.remove(); task.destroy();
    if (tab === 'lib' && session) renderLibrary();
  }
  $('#x', el).onclick = close;
  try { wake = await navigator.wakeLock?.request('screen'); } catch {}
  show(0);
}

/* ───────────── check-in ───────────── */
function streakOf(set) {
  const d = new Date();
  if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let s = 0;
  while (set.has(dateKey(d))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}
function renderCheckin() {
  const u = me(), set = new Set(u.checkins || []), today = dateKey(), page = $('#page');
  const { y, m } = calView, first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
  const title = lang === 'zh' ? `${y}年${m + 1}月` : new Date(y, m, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  let cells = t('weekdays').map((w) => `<div class="dow">${w}</div>`).join('') + '<div></div>'.repeat(first);
  for (let d = 1; d <= dim; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    cells += `<div class="d ${set.has(k) ? 'on' : ''} ${k === today ? 'today' : ''}">${d}</div>`;
  }
  const done = set.has(today);
  page.innerHTML = `
    <h2>${t('checkin')}</h2>
    <div class="stats"><div class="card"><b>${streakOf(set)}</b><small>${t('streak')} (${t('days')})</small></div>
      <div class="card"><b>${set.size}</b><small>${t('total')} (${t('days')})</small></div></div>
    <div class="card"><div class="cal-head"><button id="pm">‹</button><strong>${title}</strong><button id="nm">›</button></div>
      <div class="cal">${cells}</div></div>
    <button class="btn signbtn" id="sg" ${done ? 'disabled' : ''}>${done ? t('signedToday') : t('signNow')}</button>`;
  $('#pm').onclick = () => { calView = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; renderCheckin(); };
  $('#nm').onclick = () => { calView = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; renderCheckin(); };
  $('#sg').onclick = () => {
    updateMe((x) => { x.checkins = [...new Set([...(x.checkins || []), dateKey()])].sort(); });
    calView = { y: new Date().getFullYear(), m: new Date().getMonth() };
    renderCheckin(); toast(t('signedOk'));
  };
}

/* ───────────── profile ───────────── */
function resizeAvatar(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
      const side = Math.min(img.width, img.height), sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, s, s);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = rej; img.src = url;
  });
}
function renderProfile() {
  const u = me(), page = $('#page');
  page.innerHTML = `
    <h2>${t('profile')}</h2>
    <div class="avatar-wrap">
      <div class="avatar">${u.avatar ? `<img src="${u.avatar}" alt="">` : esc((u.display || u.name || session)[0]?.toUpperCase() || '♪')}</div>
      <button class="btn ghost small" id="ph">${t('changePhoto')}</button>
      <input type="file" id="pf" accept="image/*" class="hidden">
    </div>
    <div class="card">
      <label class="field"><span>${t('email')}</span><input value="${esc(session)}" disabled></label>
      <label class="field"><span>${t('name')}</span><input id="nm" maxlength="40" value="${esc(u.name)}"></label>
      <label class="field"><span>${t('displayName')}</span><input id="dn" maxlength="30" value="${esc(u.display)}"></label>
      <label class="field"><span>${t('language')}</span>
        <select id="lg"><option value="zh" ${lang === 'zh' ? 'selected' : ''}>中文</option><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option></select></label>
      <button class="btn" id="sv">${t('save')}</button>
    </div>
    ${deferredInstall ? `<button class="btn ghost" id="ins" style="margin-bottom:14px">${t('install')}</button>` : ''}
    <p class="sub" style="color:var(--muted);font-size:13px;line-height:1.6">${t('installTip')}<br>${t('dataNote')}</p>
    <button class="btn danger" id="lo">${t('logout')}</button>`;
  $('#ph').onclick = () => $('#pf').click();
  $('#pf').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const a = await resizeAvatar(f); updateMe((x) => { x.avatar = a; }); renderProfile(); } catch { toast(t('loadFail')); }
  };
  $('#sv').onclick = () => {
    const newLang = $('#lg').value;
    updateMe((x) => { x.name = $('#nm').value.trim(); x.display = $('#dn').value.trim() || x.display; });
    setLang(newLang); render(); toast(t('saved'));
  };
  $('#lo').onclick = logout;
  if ($('#ins')) $('#ins').onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; renderProfile(); };
}

/* ───────────── boot ───────────── */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
render();
