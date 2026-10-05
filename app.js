(() => {
  'use strict';

  const C = window.COUNTRY_BY_CODE;
  const COUNTRIES = window.COUNTRIES;
  const REGIONS = window.REGIONS;
  const flagOf = window.flagOf;
  const TOTAL = COUNTRIES.length;
  const BACKUP_KEY = 'wfl-last-backup';

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fmtDate = s => { const [y, m, d] = (s || '').split('-'); return y ? `${y}/${+m}/${+d}` : ''; };
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const safeGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

  const state = {
    tab: 'home',
    visits: [],
    region: 'all',      // home filter
    sort: 'region',     // home sort
    uRegion: 'all',     // unvisited list / roulette filter
    bannerHidden: false,
  };
  let mainUrls = [];

  /* ---------- derived data ---------- */
  function byCode() {
    const map = new Map();
    for (const v of state.visits) {
      if (!map.has(v.code)) map.set(v.code, []);
      map.get(v.code).push(v);
    }
    for (const list of map.values()) list.sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }
  const visitedSet = () => new Set(state.visits.map(v => v.code).filter(c => C[c]));

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2400);
  }

  /* ---------- layers (sheets) with Android back-button support ---------- */
  const layers = [];
  function openLayer({ cls = '', render, onClose, canClose, refresh = false }) {
    const L = { el: document.createElement('div'), urls: [], render, onClose, canClose, refresh, closed: false };
    L.el.className = 'layer ' + cls;
    L.url = blob => { const u = URL.createObjectURL(blob); L.urls.push(u); return u; };
    L.draw = () => {
      L.urls.forEach(URL.revokeObjectURL);
      L.urls = [];
      L.el.innerHTML = L.render(L);
    };
    L.draw();
    $('#layers').appendChild(L.el);
    layers.push(L);
    history.pushState({ layer: layers.length }, '');
    return L;
  }
  function closeTop() { if (layers.length) history.back(); }
  window.addEventListener('popstate', () => {
    const L = layers[layers.length - 1];
    if (!L) return;
    if (L.canClose && !L.canClose()) { history.pushState({ layer: layers.length }, ''); return; }
    layers.pop();
    L.closed = true;
    L.urls.forEach(URL.revokeObjectURL);
    L.el.remove();
    if (L.onClose) L.onClose();
  });
  function refreshLayers() { layers.filter(l => l.refresh).forEach(l => l.draw()); }

  /* ---------- load / reload ---------- */
  async function reload() {
    state.visits = await window.Store.all();
    render();
    refreshLayers();
  }

  /* ---------- main render ---------- */
  function render() {
    mainUrls.forEach(URL.revokeObjectURL);
    mainUrls = [];
    const seen = visitedSet().size;
    $('#top').innerHTML = `<h1>🌍 世界ごはん制覇</h1><span class="pill">${seen} / ${TOTAL}</span>`;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
    const main = $('#main');
    main.innerHTML = { home: homeHTML, progress: progressHTML, history: historyHTML, settings: settingsHTML }[state.tab]();
    if (state.tab === 'progress') { initMap($('#map')); fillUnvisited(); }
    if (state.tab === 'settings') updateStorageInfo();
  }

  const chipsHTML = (current, act) =>
    `<div class="chips">${['all', ...REGIONS].map(r => `<button class="chip ${current === r ? 'on' : ''}" data-act="${act}" data-r="${r}">${r === 'all' ? 'すべて' : r}</button>`).join('')}</div>`;

  /* ----- home: flag gallery ----- */
  function homeHTML() {
    const map = byCode();
    let codes = [...map.keys()].filter(c => C[c] && (state.region === 'all' || C[c].region === state.region));
    const latest = c => map.get(c)[0].date;
    if (state.sort === 'recent') codes.sort((a, b) => latest(b).localeCompare(latest(a)));
    else if (state.sort === 'name') codes.sort((a, b) => C[a].name.localeCompare(C[b].name, 'ja'));
    else codes.sort((a, b) => REGIONS.indexOf(C[a].region) - REGIONS.indexOf(C[b].region) || C[a].name.localeCompare(C[b].name, 'ja'));

    const tile = c => {
      const n = map.get(c).length;
      return `<button class="tile" data-act="country" data-code="${c}"><span class="flag">${flagOf(c)}</span><span class="cname">${esc(C[c].name)}</span>${n > 1 ? `<span class="badge">×${n}</span>` : ''}</button>`;
    };
    let body;
    if (!state.visits.length) {
      body = `<div class="empty"><span class="flag">🍽️</span><p>まだ記録がありません。<br>最初に食べた国を記録しましょう！</p><p style="margin-top:16px"><button class="primary" data-act="add">記録を追加</button></p></div>`;
    } else if (!codes.length) {
      body = `<div class="empty"><p>この地域の記録はまだありません。</p></div>`;
    } else if (state.sort === 'region') {
      body = REGIONS.map(r => {
        const list = codes.filter(c => C[c].region === r);
        if (!list.length) return '';
        const total = COUNTRIES.filter(x => x.region === r).length;
        return `<div class="region-h"><b>${r}</b><small>${list.length} / ${total}か国</small></div><div class="grid">${list.map(tile).join('')}</div>`;
      }).join('');
    } else {
      body = `<div class="grid">${codes.map(tile).join('')}</div>`;
    }

    const last = +safeGet(BACKUP_KEY) || 0;
    const needBackup = state.visits.length && !state.bannerHidden && Date.now() - last > 30 * 864e5;
    const banner = needBackup ? `<button class="banner" data-act="backup-hint">💾 バックアップがありません／1か月以上前です。タップして設定へ</button>` : '';
    const sorts = [['region', '地域順'], ['recent', '新しい順'], ['name', '国名順']];
    return `<div class="stack">${banner}${chipsHTML(state.region, 'home-region')}
      <div class="sortbar">${sorts.map(([k, l]) => `<button class="${state.sort === k ? 'on' : ''}" data-act="sort" data-s="${k}">${l}</button>`).join('')}</div>
      <div>${body}</div></div><button class="fab" data-act="add" aria-label="記録を追加">＋</button>`;
  }

  /* ----- progress: ring, regions, map, unvisited ----- */
  function progressHTML() {
    const seen = visitedSet();
    const n = seen.size, pct = n / TOTAL;
    const R = 46, circ = 2 * Math.PI * R;
    const ring = `<svg class="ring" viewBox="0 0 112 112"><circle cx="56" cy="56" r="${R}" fill="none" stroke="var(--map-off)" stroke-width="12"/>
      <circle cx="56" cy="56" r="${R}" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(circ * pct).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 56 56)"/>
      <text x="56" y="63" text-anchor="middle" font-size="22">${Math.round(pct * 100)}%</text></svg>`;
    const rows = REGIONS.map(r => {
      const list = COUNTRIES.filter(c => c.region === r);
      const k = list.filter(c => seen.has(c.code)).length;
      return `<button class="rbar" data-act="region-zoom" data-r="${r}"><span>${r}</span><span class="track"><span class="fill" style="display:block;width:${(k / list.length * 100).toFixed(0)}%"></span></span><b>${k}/${list.length}</b></button>`;
    }).join('');
    const remain = TOTAL - n;
    return `<div class="stack">
      <div class="card ring-wrap">${ring}<div><div class="big">${n} / ${TOTAL}</div><div class="muted">${remain ? `あと ${remain}か国で世界制覇！` : '🎉 世界制覇おめでとう！'}</div></div></div>
      <div><div class="mapwrap">${mapSVG(seen)}<div class="zoom"><button data-act="zoom-in" aria-label="拡大">＋</button><button data-act="zoom-out" aria-label="縮小">−</button><button data-act="zoom-reset" aria-label="全体表示">⟲</button></div></div>
        <div class="legend"><span><i style="background:var(--accent)"></i>食べた</span><span><i style="background:var(--map-off)"></i>まだ</span><span>ピンチで拡大・タップで詳細</span></div></div>
      <div class="card"><div class="rbars">${rows}</div></div>
      <div class="card"><div class="row between" style="margin-bottom:8px"><b>まだ食べていない国</b><button class="primary sm" data-act="roulette">🎲 ルーレット</button></div>
        <div id="unv"></div></div></div>`;
  }

  function unvisitedHTML() {
    const seen = visitedSet();
    const list = COUNTRIES.filter(c => !seen.has(c.code) && (state.uRegion === 'all' || c.region === state.uRegion));
    return `${chipsHTML(state.uRegion, 'u-region')}${list.length
      ? `<div class="grid small">${list.map(c => `<button class="tile" data-act="country" data-code="${c.code}"><span class="flag">${flagOf(c.code)}</span><span class="cname">${esc(c.name)}</span></button>`).join('')}</div>`
      : '<div class="empty">🎉 この地域は制覇済み！</div>'}`;
  }
  function fillUnvisited() { const el = $('#unv'); if (el) el.innerHTML = unvisitedHTML(); }

  function mapSVG(seen) {
    const { viewBox, paths } = window.WORLD_MAP;
    const codes = Object.keys(paths);
    const isDot = c => paths[c].includes('a2 2 0 1 0 4 0');
    codes.sort((a, b) => isDot(a) - isDot(b)); // small-country dots on top
    const body = codes.map(c => C[c]
      ? `<path class="c ${seen.has(c) ? 'v' : ''}" data-code="${c}" d="${paths[c]}"/>`
      : `<path class="o" d="${paths[c]}"/>`).join('');
    return `<svg id="map" viewBox="${viewBox}" role="img" aria-label="世界地図">${body}</svg>`;
  }

  /* ----- map pan / zoom ----- */
  let mapCtl = null;
  function initMap(svg) {
    const base = { x: 0, y: 30, w: 1010, h: 580 };
    let vb = { ...base };
    const apply = () => svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const fit = () => { vb.x = clamp(vb.x, -40, 1050 - vb.w); vb.y = clamp(vb.y, -10, 640 - vb.h); };
    apply();
    const scale = () => svg.getBoundingClientRect().width / vb.w;
    const toSvg = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: vb.x + (cx - r.left) / scale(), y: vb.y + (cy - r.top) / scale() }; };
    const zoomAt = (cx, cy, factor) => {
      const p = toSvg(cx, cy);
      const w = clamp(vb.w * factor, base.w / 14, base.w), k = w / vb.w;
      vb.x = p.x - (p.x - vb.x) * k; vb.y = p.y - (p.y - vb.y) * k; vb.w = w; vb.h *= k;
      fit(); apply();
    };
    const center = () => { const r = svg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    mapCtl = {
      zoomBy: f => zoomAt(...center(), f),
      reset: () => { vb = { ...base }; apply(); },
      zoomTo(box) {
        const pad = 14, ar = base.w / base.h;
        let w = box.width + pad * 2, h = box.height + pad * 2;
        if (w / h < ar) w = h * ar; else h = w / ar;
        vb = { x: box.x + box.width / 2 - w / 2, y: box.y + box.height / 2 - h / 2, w: Math.min(w, base.w), h: Math.min(w, base.w) / ar };
        fit(); apply();
      },
    };

    const pts = new Map();
    let start = null, moved = false, pinch = 0;
    svg.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (pts.size === 1) { moved = false; start = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y, target: e.target }; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = true; }
    });
    svg.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch / d);
        pinch = d;
      } else if (start) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        moved = true;
        vb.x = start.vx - dx / scale(); vb.y = start.vy - dy / scale();
        fit(); apply();
      }
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      if (pts.size === 1 && !moved && e.type === 'pointerup') {
        const code = start && start.target && start.target.dataset && start.target.dataset.code;
        if (code) openCountry(code);
      }
      pts.delete(e.pointerId);
      pinch = 0;
      if (pts.size === 1) { const [p] = [...pts.values()]; start = { x: p.x, y: p.y, vx: vb.x, vy: vb.y, target: null }; }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.2 : 1 / 1.2); }, { passive: false });
  }

  function zoomToRegion(region) {
    if (!mapCtl) return;
    const codes = COUNTRIES.filter(c => c.region === region && c.code !== 'RU').map(c => c.code);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const code of codes) {
      const el = document.querySelector(`#map path[data-code="${code}"]`);
      if (!el) continue;
      const b = el.getBBox();
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    if (x0 < Infinity) mapCtl.zoomTo({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }

  /* ----- history ----- */
  function historyHTML() {
    if (!state.visits.length) {
      return `<div class="empty"><span class="flag">📅</span><p>開催の履歴がここに並びます。</p></div><button class="fab" data-act="add" aria-label="記録を追加">＋</button>`;
    }
    const asc = [...state.visits].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
    const no = new Map(asc.map((v, i) => [v.id, i + 1]));
    const desc = asc.slice().reverse();
    let html = '', month = '';
    for (const v of desc) {
      const m = v.date.slice(0, 7);
      if (m !== month) { month = m; html += `<div class="month-h">${m.slice(0, 4)}年${+m.slice(5)}月</div>`; }
      const c = C[v.code] || { name: v.code };
      const names = v.dishes.map(d => d.name).filter(Boolean).join('、');
      const photos = v.dishes.filter(d => d.photo).slice(0, 4).map(d => { const u = URL.createObjectURL(d.photo); mainUrls.push(u); return `<img src="${u}" alt="" loading="lazy">`; }).join('');
      html += `<button class="card entry" style="margin-bottom:8px" data-act="country" data-code="${v.code}">
        <span class="flag">${flagOf(v.code)}</span>
        <span class="body"><span class="no">第${no.get(v.id)}回 · ${fmtDate(v.date)}</span>
        <span class="title" style="display:block">${esc(c.name)}${v.restaurant ? ` <small>／ ${esc(v.restaurant)}</small>` : ''}</span>
        <span class="dishes" style="display:block">${esc(names)}</span>
        ${v.rating ? `<span class="stars" style="font-size:13px">${stars(v.rating)}</span>` : ''}
        ${photos ? `<span class="thumbs">${photos}</span>` : ''}</span></button>`;
    }
    return html + `<button class="fab" data-act="add" aria-label="記録を追加">＋</button>`;
  }

  /* ----- settings / backup ----- */
  function settingsHTML() {
    const dishes = state.visits.reduce((n, v) => n + v.dishes.length, 0);
    const photos = state.visits.reduce((n, v) => n + v.dishes.filter(d => d.photo).length, 0);
    const last = +safeGet(BACKUP_KEY);
    let canShare = false;
    try { canShare = !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })); } catch { /* ignore */ }
    return `<div class="stack settings">
      <div class="card stats"><div><b>${state.visits.length}</b><small>回</small></div><div><b>${visitedSet().size}</b><small>か国</small></div><div><b>${dishes}</b><small>料理</small></div><div><b>${photos}</b><small>写真</small></div></div>
      <div class="card"><h3>💾 バックアップ</h3>
        <p>記録はこの端末のブラウザ内だけに保存されています。機種変更やブラウザのデータ削除で消えるので、定期的にファイルへ書き出してください。最後のバックアップ：<b>${last ? fmtDate(new Date(last).toISOString().slice(0, 10)) : 'なし'}</b></p>
        <div class="btns"><button class="primary" data-act="export">ファイルに書き出す</button>${canShare ? '<button class="ghost" data-act="export-share">共有で保存</button>' : ''}<label class="ghost" style="cursor:pointer">読み込む<input type="file" id="importFile" accept="application/json,.json" hidden></label></div></div>
      <div class="card"><h3>🛡️ データの保護</h3><p id="storageInfo">確認中…</p><div class="btns"><button class="ghost" data-act="persist">自動削除されないよう申請する</button></div></div>
      <div class="card"><h3>📲 ホーム画面に追加</h3><p>iPhone：共有ボタン →「ホーム画面に追加」／Android：メニュー →「ホーム画面に追加」または「アプリをインストール」。追加するとアプリのように使え、データも消えにくくなります。</p></div>
      <div class="card"><h3>ℹ️ このアプリについて</h3><p>国：国連加盟193か国＋バチカン・パレスチナ（計195か国）。世界地図：<a href="https://github.com/VictorCazanave/svg-maps" style="color:var(--accent)">@svg-maps/world</a>（CC BY 4.0）を軽量化して使用。</p></div></div>`;
  }

  async function updateStorageInfo() {
    const el = $('#storageInfo');
    if (!el) return;
    let text = '';
    try {
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (est) text += `使用量：約 ${(est.usage / 1048576).toFixed(1)} MB。`;
      text += persisted ? ' 自動削除から保護されています。' : ' 保護の申請はまだです。';
    } catch { text = '保存状況を取得できませんでした。'; }
    const e2 = $('#storageInfo');
    if (e2) e2.textContent = text;
  }

  const blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

  async function buildBackupFile() {
    const visits = await window.Store.all();
    const out = [];
    for (const v of visits) {
      out.push({ ...v, dishes: await Promise.all(v.dishes.map(async d => ({ name: d.name, photo: d.photo ? await blobToDataURL(d.photo) : null }))) });
    }
    const json = JSON.stringify({ app: 'world-food-log', version: 1, exportedAt: new Date().toISOString(), visits: out });
    return new File([json], `sekai-gohan-${today().replace(/-/g, '')}.json`, { type: 'application/json' });
  }

  async function exportBackup(share) {
    try {
      const file = await buildBackupFile();
      if (share) await navigator.share({ files: [file], title: '世界ごはん制覇 バックアップ' });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      safeSet(BACKUP_KEY, String(Date.now()));
      toast('バックアップを書き出しました');
      render();
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('書き出しに失敗しました');
    }
  }

  async function importBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'world-food-log' || !Array.isArray(data.visits)) throw new Error('format');
      const list = [];
      for (const v of data.visits) {
        if (!v || !v.id || !C[v.code]) continue;
        const dishes = [];
        for (const d of (v.dishes || [])) dishes.push({ name: String(d.name || ''), photo: d.photo ? await (await fetch(d.photo)).blob() : null });
        list.push({ id: String(v.id), code: v.code, date: v.date || today(), restaurant: v.restaurant || '', mapUrl: v.mapUrl || '', companions: v.companions || '', rating: +v.rating || 0, note: v.note || '', dishes, createdAt: v.createdAt || Date.now() });
      }
      if (!list.length) throw new Error('empty');
      if (!confirm(`${list.length}件の記録を読み込みます。同じ記録は上書きされます。よろしいですか？`)) return;
      await window.Store.putMany(list);
      await reload();
      toast(`${list.length}件を読み込みました`);
    } catch {
      toast('読み込めませんでした（ファイルが違うか壊れています）');
    }
  }

  /* ---------- country detail ---------- */
  function openCountry(code) {
    const c = C[code];
    if (!c) return;
    openLayer({
      refresh: true,
      render(L) {
        const visits = (byCode().get(code) || []);
        const list = visits.map(v => {
          const photos = v.dishes.filter(d => d.photo).map(d => `<figure><img src="${L.url(d.photo)}" alt="" data-act="lightbox"><figcaption>${esc(d.name)}</figcaption></figure>`).join('');
          const plain = v.dishes.filter(d => !d.photo && d.name).map(d => `<li>${esc(d.name)}</li>`).join('');
          return `<div class="card visit"><div class="head"><b>${fmtDate(v.date)}</b>${v.rating ? `<span class="stars">${stars(v.rating)}</span>` : ''}</div>
            <div class="meta">${v.restaurant ? '🍴 ' + esc(v.restaurant) : ''}${v.mapUrl && /^https?:\/\//i.test(v.mapUrl) ? ` <a href="${esc(v.mapUrl)}" target="_blank" rel="noopener">地図</a>` : ''}${v.companions ? `<br>👥 ${esc(v.companions)}` : ''}</div>
            ${photos ? `<div class="dish-photos">${photos}</div>` : ''}${plain ? `<ul class="dish-list">${plain}</ul>` : ''}
            ${v.note ? `<p style="margin-top:8px;font-size:14px;white-space:pre-wrap">${esc(v.note)}</p>` : ''}
            <div class="actions"><button class="ghost" data-act="edit" data-id="${v.id}">編集</button><button class="ghost danger" data-act="delete" data-id="${v.id}">削除</button></div></div>`;
        }).join('');
        return `<div class="sheet-head"><button class="icon" data-act="close" aria-label="閉じる">✕</button><h2>${esc(c.name)}</h2><span style="width:40px"></span></div>
          <div class="sheet-body stack"><div class="hero"><span class="flag">${flagOf(code)}</span><div><h3>${esc(c.name)}</h3><small>${c.region}</small><div class="muted" style="font-size:14px">${visits.length ? `${visits.length}回 食べました` : 'まだ食べていません'}</div></div></div>
          ${list}<button class="primary" style="width:100%" data-act="add" data-code="${code}">＋ ${visits.length ? 'もう一度記録する' : 'この国の記録を追加'}</button></div>`;
      },
    });
  }

  function openLightbox(src) {
    openLayer({ cls: 'dim lightbox', render: () => `<div class="lb" data-act="close"><img src="${src}" alt=""></div>` });
  }

  /* ---------- country picker ---------- */
  function openPicker(onPick) {
    const seen = visitedSet();
    const L = openLayer({
      render: () => `<div class="sheet-head"><button class="icon" data-act="close" aria-label="閉じる">✕</button><h2>国を選ぶ</h2><span style="width:40px"></span></div>
        <div class="sheet-body"><input class="search" id="pq" type="search" placeholder="国名で検索" autocomplete="off"><div class="plist" id="plist"></div></div>`,
    });
    const draw = q => {
      const list = COUNTRIES.filter(c => !q || c.name.includes(q));
      $('#plist', L.el).innerHTML = REGIONS.map(r => {
        const items = list.filter(c => c.region === r);
        if (!items.length) return '';
        return `<h4>${r}</h4>` + items.map(c => `<button data-act="pick" data-code="${c.code}"><span class="flag">${flagOf(c.code)}</span><span>${esc(c.name)}</span>${seen.has(c.code) ? '<span class="tick">✓ 食べた</span>' : ''}</button>`).join('');
      }).join('') || '<div class="empty">見つかりません</div>';
    };
    draw('');
    L.onPick = onPick;
    $('#pq', L.el).addEventListener('input', e => draw(e.target.value.trim()));
  }

  /* ---------- add / edit form ---------- */
  let form = null;
  function openForm(init = {}) {
    const editing = !!init.id;
    form = {
      editing,
      dirty: false,
      v: editing
        ? { ...init, dishes: init.dishes.map(d => ({ ...d })) }
        : { id: uid(), code: init.code || '', date: today(), restaurant: '', mapUrl: '', companions: '', rating: 0, note: '', dishes: [{ name: '', photo: null }], createdAt: Date.now() },
    };
    form.L = openLayer({
      render: L => formHTML(L),
      canClose: () => !form || !form.dirty || confirm('保存していない変更があります。破棄して閉じますか？'),
      onClose: () => { form = null; },
    });
  }

  function dishesHTML(L) {
    const { dishes } = form.v;
    return dishes.map((d, i) => `<div class="dish" data-i="${i}"><div class="main">
      <input class="dname" placeholder="料理名（例：トムヤムクン）" value="${esc(d.name)}" maxlength="80">
      <div class="photo-row">${d.photo ? `<img src="${L.url(d.photo)}" alt="">` : ''}
        <label class="photo-btn">📷 ${d.photo ? '写真を変更' : '写真を追加'}<input type="file" accept="image/*" class="pfile" data-i="${i}" hidden></label>
        ${d.photo ? `<button type="button" class="rm" data-act="photo-del" data-i="${i}">削除</button>` : ''}</div></div>
      ${dishes.length > 1 ? `<button type="button" class="icon danger" data-act="dish-del" data-i="${i}" aria-label="この料理を削除">🗑</button>` : ''}</div>`).join('');
  }

  function formHTML(L) {
    const v = form.v, c = C[v.code];
    return `<div class="sheet-head"><button class="icon" data-act="close" aria-label="閉じる">✕</button><h2>${form.editing ? '記録を編集' : '記録を追加'}</h2><button class="primary sm" data-act="save">保存</button></div>
      <div class="sheet-body form">
        <button type="button" class="country-pick" data-act="pick-country"><span class="flag">${c ? flagOf(v.code) : '🌍'}</span><span><b>${c ? esc(c.name) : '国を選ぶ'}</b><small>${c ? c.region : 'タップして選択'}</small></span></button>
        <label>食べた日<input type="date" name="date" value="${esc(v.date)}"></label>
        <label>レストラン<input name="restaurant" value="${esc(v.restaurant)}" maxlength="80" autocomplete="off"></label>
        <label>地図のリンク（任意）<input name="mapUrl" type="url" inputmode="url" placeholder="https://maps.app.goo.gl/…" value="${esc(v.mapUrl)}"></label>
        <label>一緒に食べた人（任意）<input name="companions" value="${esc(v.companions)}" maxlength="80"></label>
        <div class="field"><span>評価</span><div class="stars-input">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="${i <= v.rating ? 'on' : ''}" data-act="rate" data-n="${i}" aria-label="${i}点">★</button>`).join('')}</div></div>
        <div class="field"><span>料理</span><div id="dishes">${dishesHTML(L)}</div><button type="button" class="ghost" data-act="dish-add">＋ 料理を追加</button></div>
        <label>メモ（任意）<textarea name="note" rows="3">${esc(v.note)}</textarea></label>
      </div>`;
  }

  // read current input values back into the in-memory form state
  function syncForm() {
    const el = form.L.el, v = form.v;
    for (const name of ['date', 'restaurant', 'mapUrl', 'companions', 'note']) v[name] = $(`[name="${name}"]`, el).value.trim();
    el.querySelectorAll('.dish').forEach(d => { v.dishes[+d.dataset.i].name = $('.dname', d).value.trim(); });
  }
  function redrawDishes() { $('#dishes', form.L.el).innerHTML = dishesHTML(form.L); }

  async function compress(file, max = 1000, quality = 0.8) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      bmp = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
    }
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, max / Math.max(w0, h0));
    const cv = document.createElement('canvas');
    cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', quality));
  }

  async function saveForm() {
    syncForm();
    const v = form.v;
    const dishes = v.dishes.filter(d => d.name || d.photo).map(d => ({ name: d.name || '', photo: d.photo || null }));
    if (!v.code) { toast('国を選んでください'); return; }
    if (!dishes.length) { toast('料理名を1つ以上入力してください'); return; }
    try {
      await window.Store.put({ ...v, dishes, date: v.date || today() });
    } catch {
      toast('保存に失敗しました（容量不足の可能性）');
      return;
    }
    form.dirty = false;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    closeTop();
    await reload();
    toast('保存しました');
  }

  /* ---------- roulette ---------- */
  function openRoulette() {
    const seen = visitedSet();
    const pool = COUNTRIES.filter(c => !seen.has(c.code) && (state.uRegion === 'all' || c.region === state.uRegion));
    if (!pool.length) { toast('🎉 対象の国はすべて制覇済みです'); return; }
    const L = openLayer({
      cls: 'dim',
      render: () => `<div class="rou"><span class="flag" id="rflag">🌍</span><h3 id="rname">…</h3><small id="rreg">${state.uRegion === 'all' ? '全世界' : state.uRegion}から</small>
        <div class="actions" style="margin-top:20px"><button class="ghost" data-act="spin" id="rspin" disabled>もう一回</button><button class="primary" data-act="rou-go" id="rgo" disabled>ここに決定</button></div>
        <p style="margin-top:12px"><button class="muted" data-act="close">閉じる</button></p></div>`,
    });
    L.pool = pool;
    spin(L);
  }
  function spin(L) {
    const flag = $('#rflag', L.el), name = $('#rname', L.el), reg = $('#rreg', L.el);
    const spinBtn = $('#rspin', L.el), go = $('#rgo', L.el);
    spinBtn.disabled = go.disabled = true;
    const pick = () => L.pool[Math.floor(Math.random() * L.pool.length)];
    let n = 0, delay = 60;
    const step = () => {
      if (L.closed) return;
      const c = pick();
      flag.textContent = flagOf(c.code); name.textContent = c.name; reg.textContent = c.region;
      L.result = c;
      if (++n < 22) { delay *= 1.08; setTimeout(step, delay); }
      else { spinBtn.disabled = go.disabled = false; }
    };
    step();
  }

  /* ---------- actions (event delegation) ---------- */
  const actions = {
    tab: el => { state.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
    close: () => closeTop(),
    add: el => openForm({ code: el.dataset.code || '' }),
    country: el => openCountry(el.dataset.code),
    'home-region': el => { state.region = el.dataset.r; render(); },
    sort: el => { state.sort = el.dataset.s; render(); },
    'u-region': el => { state.uRegion = el.dataset.r; fillUnvisited(); },
    'region-zoom': el => { state.uRegion = el.dataset.r; fillUnvisited(); zoomToRegion(el.dataset.r); },
    'zoom-in': () => mapCtl && mapCtl.zoomBy(1 / 1.6),
    'zoom-out': () => mapCtl && mapCtl.zoomBy(1.6),
    'zoom-reset': () => mapCtl && mapCtl.reset(),
    roulette: () => openRoulette(),
    spin: () => { const L = layers[layers.length - 1]; if (L && L.pool) spin(L); },
    'rou-go': () => { const L = layers[layers.length - 1]; const c = L && L.result; if (!c) return; closeTop(); setTimeout(() => openForm({ code: c.code }), 60); },
    'backup-hint': () => { state.tab = 'settings'; render(); },
    export: () => exportBackup(false),
    'export-share': () => exportBackup(true),
    persist: async () => {
      try { toast((await navigator.storage.persist()) ? '保護されました' : 'ブラウザに許可されませんでした（ホーム画面に追加すると許可されやすくなります）'); } catch { toast('この端末では利用できません'); }
      updateStorageInfo();
    },
    edit: el => { const v = state.visits.find(x => x.id === el.dataset.id); if (v) openForm(v); },
    delete: async el => {
      if (!confirm('この記録を削除しますか？（元に戻せません）')) return;
      await window.Store.remove(el.dataset.id);
      await reload();
      toast('削除しました');
    },
    lightbox: el => openLightbox(el.getAttribute('src')),
    // form
    'pick-country': () => { syncForm(); openPicker(null); const L = layers[layers.length - 1]; L.onPick = code => { form.v.code = code; form.dirty = true; form.L.draw(); }; },
    pick: el => { const L = layers[layers.length - 1]; const cb = L.onPick; closeTop(); if (cb) cb(el.dataset.code); },
    rate: el => { syncForm(); const n = +el.dataset.n; form.v.rating = form.v.rating === n ? 0 : n; form.dirty = true; form.L.draw(); },
    'dish-add': () => { syncForm(); form.v.dishes.push({ name: '', photo: null }); form.dirty = true; redrawDishes(); const inputs = form.L.el.querySelectorAll('.dname'); inputs[inputs.length - 1].focus(); },
    'dish-del': el => { syncForm(); form.v.dishes.splice(+el.dataset.i, 1); form.dirty = true; redrawDishes(); },
    'photo-del': el => { syncForm(); form.v.dishes[+el.dataset.i].photo = null; form.dirty = true; redrawDishes(); },
    save: () => saveForm(),
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el);
  });
  document.addEventListener('input', e => { if (form && form.L.el.contains(e.target)) form.dirty = true; });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.classList && t.classList.contains('pfile') && form) {
      const file = t.files && t.files[0];
      if (!file) return;
      syncForm();
      try {
        form.v.dishes[+t.dataset.i].photo = await compress(file);
        form.dirty = true;
        redrawDishes();
      } catch { toast('写真を読み込めませんでした'); }
    } else if (t.id === 'importFile' && t.files[0]) {
      await importBackup(t.files[0]);
      t.value = '';
    }
  });

  /* ---------- start ---------- */
  (async () => {
    try {
      state.visits = await window.Store.all();
    } catch {
      $('#main').innerHTML = '<div class="empty">この環境では記録を保存できません。<br>プライベートブラウズを解除して再読み込みしてください。</div>';
      return;
    }
    render();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  })();
})();
