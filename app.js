// ══════════════════════════════════════════════════════════════
//  MARATHON MATCH TRACKER — app.js
// ══════════════════════════════════════════════════════════════

// ── Config ──────────────────────────────────────────────────────
const PASSPHRASE = 'BRMT';
const BIN_ID     = '69e1376936566621a8bf226e';
const ACCESS_KEY = '$2a$10$E6pA48tio9acUxs5dPr9fecbrNbnPPSBmcj/pEZjcI7BlPBX/6AO2';
const BIN_URL    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const AUTH_KEY   = 'marathon_auth_v1';
const NAME_KEY   = 'marathon_player_name';
const TEAM_KEY   = 'team';
const SOLO_KEY   = 'solo';
const MAP_IMGS_KEY = 'marathon_map_images_v1';

// ── Auth ─────────────────────────────────────────────────────────
function initAuth() {
  if (sessionStorage.getItem(AUTH_KEY) === '1') {
    showAuthPassed();
  } else {
    document.getElementById('authGate').style.display = 'block';
    setTimeout(() => document.getElementById('authInput').focus(), 100);
  }
}

function checkAuth() {
  const val = (document.getElementById('authInput').value || '').trim().toUpperCase();
  if (val === PASSPHRASE) {
    sessionStorage.setItem(AUTH_KEY, '1');
    document.getElementById('authGate').style.display = 'none';
    showAuthPassed();
  } else {
    const inp = document.getElementById('authInput');
    const err = document.getElementById('authError');
    err.textContent = 'INVALID PASSPHRASE — ACCESS DENIED';
    inp.classList.remove('shake');
    void inp.offsetWidth;
    inp.classList.add('shake');
    inp.value = '';
    setTimeout(() => { err.textContent = ''; inp.classList.remove('shake'); }, 2500);
  }
}

function toggleAuthVis() {
  const inp = document.getElementById('authInput');
  const eye = document.getElementById('authEye');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  eye.textContent = inp.type === 'password' ? '◉' : '◎';
}

function showAuthPassed() {
  document.getElementById('mainHeader').style.display = 'grid';
  initProfile();
}

// ── JSONBin ───────────────────────────────────────────────────────
let remoteData = { team: [], solo: [] }, syncTimer = null, pendingSync = false;

function setSyncStatus(state, msg) {
  const el = document.getElementById('syncIndicator');
  if (!el) return;
  el.className = 'sync-status ' + state;
  el.textContent = msg;
}

async function loadFromBin() {
  setSyncStatus('syncing', '● SYNCING');
  try {
    const res = await fetch(BIN_URL + '/latest', { headers: { 'X-Access-Key': ACCESS_KEY } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const record = json.record || {};
    remoteData.team = Array.isArray(record.team) ? record.team : [];
    remoteData.solo = Array.isArray(record.solo) ? record.solo : [];
    setSyncStatus('synced', '● SYNCED');
    return true;
  } catch (e) {
    console.error('Load error:', e);
    setSyncStatus('error', '● OFFLINE');
    return false;
  }
}

async function saveToBin() {
  setSyncStatus('syncing', '● SAVING');
  try {
    const res = await fetch(BIN_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Access-Key': ACCESS_KEY },
      body: JSON.stringify({ team: remoteData.team, solo: remoteData.solo })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    setSyncStatus('synced', '● SYNCED');
    pendingSync = false;
  } catch (e) {
    console.error('Save error:', e);
    setSyncStatus('error', '● SYNC FAILED');
  }
}

function queueSave() {
  pendingSync = true;
  setSyncStatus('syncing', '● SAVING');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(saveToBin, 800);
}

function loadJSON(key)       { return key === TEAM_KEY ? remoteData.team : key === SOLO_KEY ? remoteData.solo : []; }
function saveJSON(key, data) { if (key === TEAM_KEY) remoteData.team = data; else if (key === SOLO_KEY) remoteData.solo = data; queueSave(); }
function loadStr(k)          { return localStorage.getItem(k) || ''; }
function saveStr(k, v)       { localStorage.setItem(k, v); }

// ── App State ─────────────────────────────────────────────────────
let currentTab = 'team', currentFilter = 'all', editingId = null, playerName = '';
let intelScope = 'team', intelSubtab = 'maps';

function getMatches() {
  return currentTab === 'team'
    ? loadJSON(TEAM_KEY)
    : loadJSON(SOLO_KEY).filter(m => m.player === playerName);
}

function saveMatchToStore(match, isEdit) {
  const key = currentTab === 'team' ? TEAM_KEY : SOLO_KEY;
  const list = loadJSON(key);
  if (isEdit) {
    const idx = list.findIndex(m => m.id === editingId);
    if (idx > -1) list[idx] = match;
  } else {
    list.unshift(match);
  }
  saveJSON(key, list);
}

function deleteFromStore(id) {
  const key = currentTab === 'team' ? TEAM_KEY : SOLO_KEY;
  saveJSON(key, loadJSON(key).filter(m => m.id !== id));
}

// ── Profile ───────────────────────────────────────────────────────
async function initProfile() {
  playerName = loadStr(NAME_KEY);
  await loadFromBin();
  if (!playerName) {
    document.getElementById('profileSetup').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    return;
  }
  showMain();
}

function confirmProfile() {
  const v = document.getElementById('setupInput').value.trim().toUpperCase();
  if (!v) { alert('Please enter a name.'); return; }
  playerName = v;
  saveStr(NAME_KEY, v);
  document.getElementById('profileSetup').style.display = 'none';
  showMain();
}

function showMain() {
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('profileArea').innerHTML = `
    <span class="profile-label">RUNNER:</span>
    <span style="font-family:var(--mono);font-size:13px;color:var(--accent);letter-spacing:2px">${playerName}</span>
    <button class="btn btn-ghost btn-sm" onclick="changeName()" style="font-size:9px;padding:3px 8px">CHANGE</button>`;
  updateBadges();
  renderAll();
}

function changeName() {
  const n = prompt('Enter new callsign:', '');
  if (!n || !n.trim()) return;
  playerName = n.trim().toUpperCase();
  saveStr(NAME_KEY, playerName);
  showMain();
}

// ── Tabs ──────────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  currentFilter = 'all';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');

  const isIntel = tab === 'intel';
  const isMaps  = tab === 'maps';
  document.getElementById('trackerPanel').style.display = (!isIntel && !isMaps) ? 'block' : 'none';
  document.getElementById('intelPanel').style.display   = isIntel ? 'block' : 'none';
  document.getElementById('mapsPanel').style.display    = isMaps  ? 'block' : 'none';

  if (!isIntel && !isMaps) {
    const fb = document.querySelector('.filter-btn');
    if (fb) fb.classList.add('active');
    const si = document.getElementById('searchInput');
    if (si) si.value = '';
    renderAll();
  } else if (isIntel) {
    renderIntel();
  } else if (isMaps) {
    renderMapsTab();
  }
}

function updateBadges() {
  document.getElementById('teamBadge').textContent = loadJSON(TEAM_KEY).length;
  document.getElementById('soloBadge').textContent = loadJSON(SOLO_KEY).filter(m => m.player === playerName).length;
}

// ── Filter / Sort ─────────────────────────────────────────────────
function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderMatches();
}

function getFiltered() {
  let list = getMatches();
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  if (currentFilter !== 'all') list = list.filter(m => m.result === currentFilter);
  if (q) list = list.filter(m => (m.map + m.runner + (m.player || '')).toLowerCase().includes(q));
  const s = document.getElementById('sortSel')?.value || 'date_desc';
  if (s === 'date_desc')   list.sort((a, b) => b.date.localeCompare(a.date));
  else if (s === 'date_asc')    list.sort((a, b) => a.date.localeCompare(b.date));
  else if (s === 'kills_desc')  list.sort((a, b) => b.kills - a.kills);
  else if (s === 'profit_desc') list.sort((a, b) => b.profit - a.profit);
  return list;
}

// ── Stats ─────────────────────────────────────────────────────────
function renderStats() {
  const list = getMatches(), total = list.length;
  const extracted  = list.filter(m => m.result === 'extracted').length;
  const died       = list.filter(m => m.result === 'died').length;
  const er         = total ? Math.round(extracted / total * 100) : 0;
  const totalKills = list.reduce((s, m) => s + (m.kills || 0), 0);
  const totalProfit= list.reduce((s, m) => s + (m.profit || 0), 0);
  const avgKills   = total ? (totalKills / total).toFixed(1) : '0';
  const profStr    = totalProfit >= 1000 ? (totalProfit / 1000).toFixed(1) + 'k' : totalProfit;

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card"><div class="stat-label">MATCHES</div><div class="stat-value">${total}</div></div>
    <div class="stat-card"><div class="stat-label">EXTRACTED</div><div class="stat-value c-green">${extracted}</div></div>
    <div class="stat-card"><div class="stat-label">DIED</div><div class="stat-value c-red">${died}</div></div>
    <div class="stat-card"><div class="stat-label">EXTRACT RATE</div><div class="stat-value ${er >= 50 ? 'c-green' : 'c-red'}">${er}%</div></div>
    <div class="stat-card"><div class="stat-label">TOTAL KILLS</div><div class="stat-value c-amber">${totalKills}</div></div>
    ${currentTab !== 'team' ? `<div class="stat-card"><div class="stat-label">TOTAL PROFIT</div><div class="stat-value c-amber">${profStr} cR</div></div>` : ''}
    <div class="stat-card"><div class="stat-label">AVG KILLS</div><div class="stat-value c-blue">${avgKills}</div></div>`;
}

// ── Matches ───────────────────────────────────────────────────────
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMatches() {
  const el = document.getElementById('matchesList');
  const list = getFiltered();
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">◈</span>NO MATCHES FOUND<br><br>${currentTab === 'team' ? 'Log your first team match.' : 'Log your first solo match.'}</div>`;
    return;
  }
  el.innerHTML = list.map(m => {
    const isEx = m.result === 'extracted';
    const profStr = (m.profit || 0) >= 1000 ? ((m.profit || 0) / 1000).toFixed(1) + 'k' : (m.profit || 0);
    const playerBadges = currentTab === 'team' && m.players && m.players.length
      ? `<div class="m-players">${m.players.map(p => `<span class="m-pbadge">${esc(p)}</span>`).join('')}</div>`
      : (currentTab !== 'team' ? '' : `<span class="m-player">${esc(m.player || '?')}</span>`);
    return `<div class="match-card ${m.result}" id="mc-${m.id}">
      <div class="match-header" onclick="toggle('${m.id}')">
        <span class="result-badge ${isEx ? 'b-extracted' : 'b-died'}">${isEx ? 'EXTRACTED' : 'DIED'}</span>
        <div class="match-info">
          <span class="m-map">${esc(m.map) || 'Unknown'}</span>
          ${currentTab !== 'team' ? `<span class="m-runner">${esc(m.runner) || ''}</span>` : ''}
          ${playerBadges}
        </div>
        <div class="match-qs">
          <div class="qs"><span class="qs-v k">${m.kills || 0}</span><span class="qs-l">KILLS</span></div>
          ${currentTab !== 'team' ? `<div class="qs"><span class="qs-v p">${profStr} cR</span><span class="qs-l">PROFIT</span></div>` : ''}
        </div>
        <span class="m-date">${m.date || ''}</span>
        <button class="expand-btn" id="exp-${m.id}">▼</button>
      </div>
      <div class="match-detail" id="det-${m.id}">
        <div class="detail-grid">
          <div class="d-stat"><div class="d-stat-v k">${m.kills || 0}</div><div class="d-stat-l">KILLS</div></div>
          ${currentTab !== 'team' ? `<div class="d-stat"><div class="d-stat-v p">${profStr} cR</div><div class="d-stat-l">PROFIT</div></div>` : ''}
          <div class="d-stat"><div class="d-stat-v">${esc(m.loot) || '—'}</div><div class="d-stat-l">LOOT</div></div>
        </div>
        ${(m.good || m.bad) ? `<div class="feedback-row">
          <div class="feedback-box good"><div class="feedback-title good">✓ What went well</div><div class="feedback-text">${esc(m.good) || '—'}</div></div>
          <div class="feedback-box bad"><div class="feedback-title bad">✗ What went wrong</div><div class="feedback-text">${esc(m.bad) || '—'}</div></div>
        </div>` : ''}
        ${currentTab === 'team' ? `
        <div class="notes-section">
          <div class="notes-header"><span>PLAYER NOTES</span></div>
          <div class="player-notes-list" id="pnl-${m.id}">${renderPlayerNotes(m)}</div>
          <div class="note-editor" id="ne-${m.id}">
            <div class="note-editor-label">MY NOTE — ${playerName}</div>
            <textarea class="note-textarea" id="nt-${m.id}" placeholder="Add your personal note...">${esc((m.playerNotes || {})[playerName] || '')}</textarea>
            <div class="note-editor-actions">
              <button class="btn btn-ghost btn-sm" onclick="closeNote('${m.id}',event)">CANCEL</button>
              <button class="btn btn-primary btn-sm" onclick="saveNote('${m.id}',event)">SAVE NOTE</button>
            </div>
          </div>
        </div>` : ''}
        <div class="match-actions">
          ${currentTab === 'team' ? `<button class="btn btn-ghost btn-sm" onclick="openNote('${m.id}',event)">${((m.playerNotes || {})[playerName]) ? 'EDIT MY NOTE' : '+ MY NOTE'}</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="editMatch('${m.id}',event)">EDIT</button>
          <button class="btn btn-danger" onclick="delMatch('${m.id}',event)">DELETE</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggle(id) {
  const det = document.getElementById('det-' + id);
  const btn = document.getElementById('exp-' + id);
  const open = det.classList.toggle('open');
  if (btn) btn.textContent = open ? '▲' : '▼';
}

function renderAll() { renderStats(); renderMatches(); updateBadges(); }

// ── INTEL / ANALYZE ───────────────────────────────────────────────
function switchIntelSubtab(sub) {
  intelSubtab = sub;
  document.querySelectorAll('.intel-subtab').forEach(t => t.classList.remove('active'));
  document.getElementById('isubtab-' + sub).classList.add('active');
  document.querySelectorAll('.intel-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('ipanel-' + sub).classList.add('active');
  renderIntel();
}

function setIntelScope(scope) {
  intelScope = scope;
  document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('scope-' + scope).classList.add('active');
  renderIntel();
}

function getIntelMatches() {
  if (intelScope === 'team') return loadJSON(TEAM_KEY);
  if (intelScope === 'solo') return loadJSON(SOLO_KEY).filter(m => m.player === playerName);
  return [...loadJSON(TEAM_KEY), ...loadJSON(SOLO_KEY)];
}

function renderIntel() {
  if (intelSubtab === 'maps') renderMapPerformance();
}

// ── MAP PERFORMANCE ───────────────────────────────────────────────
function renderMapPerformance() {
  const container = document.getElementById('intelMapsContent');
  const all = getIntelMatches();

  if (!all.length) {
    container.innerHTML = `<div class="intel-empty"><span style="font-size:28px;display:block;margin-bottom:12px;opacity:.15">◈</span>NO MATCH DATA YET<br><br>Log some matches to see map analysis.</div>`;
    return;
  }

  const maps = {};
  all.forEach(m => {
    const name = m.map || 'Unknown';
    if (!maps[name]) maps[name] = { name, total: 0, extracted: 0, died: 0, kills: [], profit: [] };
    maps[name].total++;
    if (m.result === 'extracted') maps[name].extracted++;
    else maps[name].died++;
    maps[name].kills.push(m.kills || 0);
    maps[name].profit.push(m.profit || 0);
  });

  const mapList = Object.values(maps).sort((a, b) => b.total - a.total);
  mapList.forEach(m => {
    m.er        = m.total ? Math.round(m.extracted / m.total * 100) : 0;
    m.avgKills  = m.kills.length ? (m.kills.reduce((s, v) => s + v, 0) / m.kills.length) : 0;
    m.avgProfit = m.profit.length ? (m.profit.reduce((s, v) => s + v, 0) / m.profit.length) : 0;
    m.totalKills= m.kills.reduce((s, v) => s + v, 0);
  });

  const ranked   = mapList.filter(m => m.total >= 2).sort((a, b) => b.er - a.er);
  const bestMap  = ranked[0] || null;
  const worstMap = ranked[ranked.length - 1] || null;

  const totalMatches   = all.length;
  const totalExtracted = all.filter(m => m.result === 'extracted').length;
  const overallER      = totalMatches ? Math.round(totalExtracted / totalMatches * 100) : 0;
  const totalKills     = all.reduce((s, m) => s + (m.kills || 0), 0);
  const avgKills       = totalMatches ? (totalKills / totalMatches).toFixed(1) : '0';

  let html = '';

  if (bestMap && worstMap && bestMap.name !== worstMap.name) {
    html += `<div class="map-callouts">
      <div class="callout-card best">
        <div class="callout-tag best">◈ STRONGEST MAP</div>
        <div class="callout-map">${esc(bestMap.name)}</div>
        <div class="callout-stat">${bestMap.er}% extract rate · ${bestMap.total} matches</div>
      </div>
      <div class="callout-card worst">
        <div class="callout-tag worst">◉ WEAKEST MAP</div>
        <div class="callout-map">${esc(worstMap.name)}</div>
        <div class="callout-stat">${worstMap.er}% extract rate · ${worstMap.total} matches</div>
      </div>
    </div>`;
  }

  html += `<div class="map-perf-grid">`;

  mapList.forEach(m => {
    const erColor      = m.er >= 60 ? '#7aad6e' : m.er >= 40 ? '#e8b84b' : '#c0464a';
    const erColorClass = m.er >= 60 ? 'good' : m.er >= 40 ? 'amber' : 'bad';
    const avgKillsStr  = m.avgKills.toFixed(1);
    const avgProfStr   = m.avgProfit >= 1000 ? (m.avgProfit / 1000).toFixed(1) + 'k' : Math.round(m.avgProfit);

    const mapMatches = all.filter(x => (x.map || 'Unknown') === m.name)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10).reverse();
    const svgBars  = buildMatchBarsChart(mapMatches);
    const killsBar = buildKillsBar(m.kills);

    html += `<div class="map-perf-card">
      <div class="map-perf-header">
        <div class="map-perf-name">${esc(m.name)}</div>
        <div class="map-perf-quick">
          <div class="mpq"><span class="mpq-v" style="color:${erColor}">${m.er}%</span><span class="mpq-l">EXTRACT</span></div>
          <div class="mpq"><span class="mpq-v">${m.total}</span><span class="mpq-l">MATCHES</span></div>
          <div class="mpq"><span class="mpq-v amber">${avgKillsStr}</span><span class="mpq-l">AVG KILLS</span></div>
          ${intelScope !== 'team' ? `<div class="mpq"><span class="mpq-v blue">${avgProfStr} cR</span><span class="mpq-l">AVG PROFIT</span></div>` : ''}
          <div class="mpq"><span class="mpq-v good">${m.extracted}</span><span class="mpq-l">EXTRACTED</span></div>
          <div class="mpq"><span class="mpq-v bad">${m.died}</span><span class="mpq-l">DIED</span></div>
        </div>
      </div>
      <div class="map-perf-body">
        <div class="er-bar-wrap">
          <div class="er-bar-label"><span>EXTRACT RATE</span><span style="color:${erColor}">${m.er}%</span></div>
          <div class="er-bar-track"><div class="er-bar-fill" style="width:${m.er}%;background:${erColor}"></div></div>
        </div>
        ${mapMatches.length > 1 ? `<div class="chart-section">
          <div class="chart-label">RECENT RESULTS (LAST ${mapMatches.length} MATCHES)</div>
          <div class="chart-svg-wrap">${svgBars}</div>
        </div>` : ''}
        ${m.kills.length > 1 ? `<div class="chart-section">
          <div class="chart-label">KILLS DISTRIBUTION</div>
          <div class="chart-svg-wrap">${killsBar}</div>
        </div>` : ''}
      </div>
    </div>`;
  });

  html += `</div>`;

  html += `<div class="intel-summary">
    <div class="is-card"><div class="is-label">MAPS PLAYED</div><div class="is-value">${mapList.length}</div><div class="is-sub">unique maps</div></div>
    <div class="is-card"><div class="is-label">OVERALL EXTRACT</div><div class="is-value">${overallER}%</div><div class="is-sub">${totalExtracted} / ${totalMatches} matches</div></div>
    <div class="is-card"><div class="is-label">TOTAL KILLS</div><div class="is-value" style="color:var(--accent2)">${totalKills}</div><div class="is-sub">${avgKills} avg per match</div></div>
    <div class="is-card"><div class="is-label">MOST PLAYED</div><div class="is-value" style="font-size:18px;padding-top:4px">${esc(mapList[0]?.name || '—')}</div><div class="is-sub">${mapList[0]?.total || 0} matches</div></div>
  </div>`;

  container.innerHTML = html;
}

function buildMatchBarsChart(matches) {
  if (!matches.length) return '';
  const W = 600, H = 80, pad = 4;
  const count = matches.length;
  const barW  = Math.floor((W - pad * (count + 1)) / count);
  let bars = '';

  matches.forEach((m, i) => {
    const x     = pad + i * (barW + pad);
    const isEx  = m.result === 'extracted';
    const color = isEx ? '#7aad6e' : '#c0464a';
    const opacity = isEx ? '0.75' : '0.55';
    const kills = m.kills || 0;
    const maxK  = Math.max(...matches.map(x => x.kills || 0), 1);
    const bh    = Math.max(8, Math.round((kills / maxK) * (H - 28)));
    const y     = H - 18 - bh;

    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="1"
      fill="${color}" fill-opacity="${opacity}"
      onmouseover="this.setAttribute('fill-opacity','1')"
      onmouseout="this.setAttribute('fill-opacity','${opacity}')">
      <title>${m.map || ''} · ${isEx ? 'EXTRACTED' : 'DIED'} · ${kills} kills${m.date ? ' · ' + m.date : ''}</title>
    </rect>`;
    bars += `<circle cx="${x + barW / 2}" cy="${H - 10}" r="3" fill="${color}" fill-opacity="0.9"/>`;
    if (barW >= 20) {
      bars += `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="9" fill="${color}" fill-opacity="0.8">${kills > 0 ? kills : ''}</text>`;
    }
  });

  const yLine = `<line x1="0" y1="${H - 18}" x2="${W}" y2="${H - 18}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">${yLine}${bars}</svg>`;
}

function buildKillsBar(killsArr) {
  if (!killsArr.length) return '';
  const buckets = { '0': 0, '1': 0, '2': 0, '3': 0, '4+': 0 };
  killsArr.forEach(k => {
    if (k === 0) buckets['0']++;
    else if (k === 1) buckets['1']++;
    else if (k === 2) buckets['2']++;
    else if (k === 3) buckets['3']++;
    else buckets['4+']++;
  });
  const total  = killsArr.length;
  const colors = { '0': '#c0464a', '1': '#e8b84b', '2': '#7a8fa0', '3': '#7aad6e', '4+': '#c8922a' };
  const W = 600, H = 48;
  let x = 0, rects = '', legend = '';
  const entries = Object.entries(buckets).filter(([, v]) => v > 0);
  entries.forEach(([label, count]) => {
    const pct  = count / total;
    const segW = Math.round(pct * W);
    const col  = colors[label];
    rects += `<rect x="${x}" y="0" width="${segW}" height="20" fill="${col}" fill-opacity="0.7">
      <title>${label} kills: ${count} matches (${Math.round(pct * 100)}%)</title>
    </rect>`;
    if (segW > 30) {
      rects += `<text x="${x + segW / 2}" y="14" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-size="10" fill="#fff" fill-opacity="0.9">${label}k</text>`;
    }
    x += segW;
  });
  let lx = 0;
  entries.forEach(([label, count]) => {
    const pct = Math.round(count / total * 100);
    const col = colors[label];
    legend += `<circle cx="${lx + 5}" cy="36" r="3" fill="${col}" fill-opacity="0.8"/>`;
    legend += `<text x="${lx + 12}" y="40" font-family="'IBM Plex Mono',monospace" font-size="9" fill="rgba(160,152,128,0.7)">${label} KILLS: ${pct}%</text>`;
    lx += 82;
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${W}" height="20" rx="2" fill="rgba(255,255,255,0.04)"/>
    ${rects}${legend}
  </svg>`;
}

// ── Modal ─────────────────────────────────────────────────────────
function openModal(reset = true) {
  const isTeam = currentTab === 'team';
  document.getElementById('teamPlayersSection').style.display = isTeam ? 'block' : 'none';
  document.getElementById('runnerField').style.display  = isTeam ? 'none' : '';
  document.getElementById('profitField').style.display  = isTeam ? 'none' : '';
  document.getElementById('mapRunnerRow').style.gridTemplateColumns  = isTeam ? '1fr' : '';
  document.getElementById('killsProfitRow').style.gridTemplateColumns = isTeam ? '1fr' : '';
  if (reset) {
    editingId = null;
    document.getElementById('modalTitleText').textContent = 'LOG MATCH';
    document.getElementById('f_result').value = 'extracted';
    document.getElementById('f_date').value = new Date().toISOString().split('T')[0];
    ['f_map', 'f_runner', 'f_kills', 'f_profit', 'f_loot', 'f_good', 'f_bad'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.querySelectorAll('.player-chip').forEach(c => {
      c.classList.remove('selected');
      if (c.dataset.custom) c.remove();
    });
    document.getElementById('customPlayerInput').value = '';
  }
  document.getElementById('modalTabHint').textContent = isTeam ? 'TEAM' : 'SOLO / ' + playerName;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
function g(id)  { return (document.getElementById(id)?.value || '').trim(); }
function gn(id) { const v = parseInt(document.getElementById(id)?.value); return isNaN(v) ? 0 : v; }

// ── Player Notes ──────────────────────────────────────────────────
function renderPlayerNotes(m) {
  const notes = m.playerNotes || {}, players = m.players && m.players.length ? m.players : [];
  if (!players.length && !Object.keys(notes).length) return `<span class="pn-empty">No notes yet.</span>`;
  const shown = new Set(); let html = '';
  players.forEach(p => {
    shown.add(p);
    const isMine = p === playerName, txt = notes[p]; if (!txt) return;
    html += `<div class="player-note-item ${isMine ? 'mine' : 'other'}"><span class="pn-name ${isMine ? '' : 'other'}">${esc(p)}</span><span class="pn-text">${esc(txt)}</span></div>`;
  });
  Object.keys(notes).forEach(p => {
    if (shown.has(p)) return;
    const isMine = p === playerName;
    html += `<div class="player-note-item ${isMine ? 'mine' : 'other'}"><span class="pn-name ${isMine ? '' : 'other'}">${esc(p)}</span><span class="pn-text">${esc(notes[p])}</span></div>`;
  });
  return html || `<span class="pn-empty">No notes yet.</span>`;
}

function openNote(id, e) {
  e.stopPropagation();
  const det = document.getElementById('det-' + id), btn = document.getElementById('exp-' + id);
  if (!det.classList.contains('open')) { det.classList.add('open'); if (btn) btn.textContent = '▲'; }
  document.getElementById('ne-' + id).classList.add('open');
  document.getElementById('nt-' + id).focus();
}
function closeNote(id, e) { e.stopPropagation(); document.getElementById('ne-' + id).classList.remove('open'); }
function saveNote(id, e) {
  e.stopPropagation();
  const text = (document.getElementById('nt-' + id).value || '').trim();
  const list = loadJSON(TEAM_KEY);
  const idx  = list.findIndex(m => m.id === id);
  if (idx === -1) return;
  if (!list[idx].playerNotes) list[idx].playerNotes = {};
  if (text) list[idx].playerNotes[playerName] = text;
  else delete list[idx].playerNotes[playerName];
  saveJSON(TEAM_KEY, list);
  document.getElementById('pnl-' + id).innerHTML = renderPlayerNotes(list[idx]);
  document.getElementById('ne-' + id).classList.remove('open');
  const hasNote = !!(list[idx].playerNotes && list[idx].playerNotes[playerName]);
  const actionsDiv = document.querySelector(`#mc-${id} .match-actions`);
  if (actionsDiv) { const nb = actionsDiv.querySelector('button:first-child'); if (nb) nb.textContent = hasNote ? 'EDIT MY NOTE' : '+ MY NOTE'; }
}

function togglePlayer(chip) { chip.classList.toggle('selected'); }

function addCustomPlayer() {
  const input = document.getElementById('customPlayerInput');
  const name = (input.value || '').trim(); if (!name) return;
  const existing = [...document.querySelectorAll('.player-chip')].find(c => c.dataset.player.toLowerCase() === name.toLowerCase());
  if (existing) { existing.classList.add('selected'); input.value = ''; return; }
  const chip = document.createElement('div');
  chip.className = 'player-chip selected';
  chip.dataset.player = name; chip.textContent = name;
  chip.onclick = function () { togglePlayer(this); };
  const x = document.createElement('span');
  x.textContent = ' ×'; x.style.cssText = 'opacity:.5;cursor:pointer;margin-left:2px';
  x.onclick = function (e) { e.stopPropagation(); chip.remove(); };
  chip.appendChild(x);
  document.getElementById('playerPicker').appendChild(chip);
  input.value = '';
}

function getSelectedPlayers() { return [...document.querySelectorAll('.player-chip.selected')].map(c => c.dataset.player); }

function saveMatch() {
  if (!g('f_map')) { alert('Please select a map.'); return; }
  const match = {
    id: editingId || Date.now().toString(),
    result: g('f_result'), map: g('f_map'), runner: g('f_runner'),
    date: g('f_date'), kills: gn('f_kills'), profit: gn('f_profit'), loot: g('f_loot'),
    good: g('f_good'), bad: g('f_bad'), player: playerName,
    players: currentTab === 'team' ? getSelectedPlayers() : [],
    tab: currentTab,
    playerNotes: (() => {
      if (editingId && currentTab === 'team') {
        const ex = loadJSON(TEAM_KEY).find(m => m.id === editingId);
        return ex ? (ex.playerNotes || {}) : {};
      }
      return {};
    })(),
  };
  saveMatchToStore(match, !!editingId);
  closeModal();
  renderAll();
}

function editMatch(id, e) {
  e.stopPropagation();
  const list = currentTab === 'team' ? loadJSON(TEAM_KEY) : loadJSON(SOLO_KEY);
  const m = list.find(x => x.id === id); if (!m) return;
  editingId = id;
  document.getElementById('modalTitleText').textContent = 'EDIT MATCH';
  document.getElementById('f_result').value = m.result;
  document.getElementById('f_date').value   = m.date || '';
  document.getElementById('f_map').value    = m.map || '';
  document.getElementById('f_runner').value = m.runner || '';
  document.getElementById('f_kills').value  = m.kills || 0;
  document.getElementById('f_profit').value = m.profit || 0;
  document.getElementById('f_loot').value   = m.loot || '';
  document.getElementById('f_good').value   = m.good || '';
  document.getElementById('f_bad').value    = m.bad || '';
  document.querySelectorAll('.player-chip').forEach(c => c.classList.toggle('selected', (m.players || []).includes(c.dataset.player)));
  openModal(false);
}

function delMatch(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this match?')) return;
  deleteFromStore(id);
  renderAll();
}

document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ══════════════════════════════════════════════════════════════════
//  MAPS TAB
// ══════════════════════════════════════════════════════════════════

/**
 * Map definitions.
 * Images live at maps/<imgFile> in the repo — no upload needed.
 */
const MAP_DEFINITIONS = [
  {
    id: 'perimeter',
    name: 'Perimeter',
    imgFile: 'perimeter.png'
  },
  {
    id: 'diremarsh',
    name: 'Dire Marsh',
    imgFile: 'diremarsh.png'
  },
  {
    id: 'outpost',
    name: 'Outpost',
    imgFile: 'outpost.png'
  },
  {
    id: 'cryoarchive',
    name: 'Cryo Archive',
    imgFile: 'cryoarchive.png'
  },
];

// Which map subtab is currently active
let activeMapId = MAP_DEFINITIONS[0].id;

function switchMapSubtab(id) {
  activeMapId = id;

  // Update subtab button states
  document.querySelectorAll('.map-subtab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mapId === id);
  });

  // Show/hide map panels
  document.querySelectorAll('.map-detail-panel').forEach(panel => {
    panel.style.display = panel.dataset.mapId === id ? 'block' : 'none';
  });
}

function renderMapsTab() {
  const container = document.getElementById('mapCardsContainer');

  // ── Subtab bar ────────────────────────────────────────────────
  const subtabBar = `<div class="map-subtab-bar">
    ${MAP_DEFINITIONS.map(m =>
      `<button class="map-subtab${m.id === activeMapId ? ' active' : ''}"
        data-map-id="${m.id}"
        onclick="switchMapSubtab('${m.id}')">
        ${m.name}
      </button>`
    ).join('')}
  </div>`;

  // ── One detail panel per map ──────────────────────────────────
  const panels = MAP_DEFINITIONS.map(map => {

    return `<div class="map-detail-panel" data-map-id="${map.id}"
        style="display:${map.id === activeMapId ? 'block' : 'none'}">
      <div class="map-detail-layout">

        <div class="map-detail-img-wrap">
          <img
            src="maps/${map.imgFile}"
            alt="${map.name}"
            class="map-detail-img"
            onclick="openLightbox('${map.id}')"
            title="Click to zoom"
          >
          <div class="map-detail-img-hint">CLICK TO ZOOM</div>
        </div>

        <div class="map-detail-info">
          <div class="map-detail-name">${map.name}</div>
        </div>

      </div>
    </div>`;
  }).join('');

  container.innerHTML = subtabBar + panels;
}

function openLightbox(mapId) {
  const map = MAP_DEFINITIONS.find(m => m.id === mapId);
  if (!map) return;
  document.getElementById('lightboxImg').src = `maps/${map.imgFile}`;
  document.getElementById('lightboxName').textContent = map.name;
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ── Init ──────────────────────────────────────────────────────────
initAuth();
