/**
 * Crocker Grocery — frontend
 * Hits Apps Script webhook for all reads/writes.
 */

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzYGSYtGGycZPg4Gr8i0IwAjliAc8Lq4eyK_xGinpUCSx2TDDzg3xlWWn5His_Zh55_aA/exec';

const STORES = ['HEB', "Sam's Club", 'Tractor Supply', 'Walmart', 'Petco'];
const VALID_USERS = ['Chad', 'Ashley', 'Clayton'];

const state = {
  user: null,
  view: 'list',
  store: 'HEB',
  items: {},      // grouped by store
  history: [],
  selectedAddStore: null,
  loading: false
};

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// --- bootstrap ---
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('crockerUser');
  if (saved && VALID_USERS.indexOf(saved) >= 0) {
    state.user = saved;
    showApp();
    refresh();
  } else {
    showNamePicker();
  }
  wireEvents();
  registerSW();
});

// --- views ---
function showNamePicker() {
  $('#name-picker').classList.remove('hidden');
  $('#app').classList.add('hidden');
}

function showApp() {
  $('#name-picker').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#current-user-badge').textContent = state.user.charAt(0);
  setView(state.view);
}

function setView(name) {
  state.view = name;
  $$('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  // FAB only on list view
  $('#add-btn').classList.toggle('hidden-fab', name !== 'list');
  if (name === 'history') loadHistory();
}

function setStore(store) {
  state.store = store;
  $$('.store-tab').forEach(b => b.classList.toggle('active', b.dataset.store === store));
  renderItems();
}

// --- events ---
function wireEvents() {
  $$('.name-btn').forEach(b => b.addEventListener('click', () => {
    state.user = b.dataset.name;
    localStorage.setItem('crockerUser', state.user);
    showApp();
    refresh();
  }));

  $('#refresh-btn').addEventListener('click', refresh);

  $$('.view-tab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('.store-tab').forEach(b => b.addEventListener('click', () => setStore(b.dataset.store)));

  $('#add-btn').addEventListener('click', openAddModal);
  $('#add-cancel').addEventListener('click', closeAddModal);
  $('#add-save').addEventListener('click', saveAdd);
  $('#add-modal').addEventListener('click', e => {
    if (e.target.id === 'add-modal') closeAddModal();
  });
  $$('.store-pick').forEach(b => b.addEventListener('click', () => {
    state.selectedAddStore = b.dataset.store;
    $$('.store-pick').forEach(x => x.classList.toggle('selected', x === b));
  }));

  $('#history-search').addEventListener('input', renderHistory);

  $('#switch-user').addEventListener('click', e => {
    e.preventDefault();
    localStorage.removeItem('crockerUser');
    state.user = null;
    showNamePicker();
  });
}

// --- API ---
async function apiGet(action) {
  const res = await fetch(WEBHOOK_URL + '?action=' + action, { method: 'GET' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function apiPost(action, body) {
  // text/plain to dodge CORS preflight (Apps Script web apps work with this)
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action }, body)),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// --- refresh ---
async function refresh() {
  setStatus('Loading...');
  try {
    const data = await apiGet('list');
    if (!data.ok) throw new Error(data.error || 'unknown');
    state.items = data.items || {};
    renderItems();
    setStatus('');
  } catch (err) {
    setStatus('Offline');
    toast('Could not load list', true);
    console.error(err);
  }
}

async function loadHistory() {
  $('#history-container').innerHTML = '<div class="empty-state">Loading history...</div>';
  try {
    const data = await apiGet('history');
    if (!data.ok) throw new Error(data.error || 'unknown');
    state.history = data.items || [];
    renderHistory();
  } catch (err) {
    $('#history-container').innerHTML = '<div class="empty-state">Could not load history.</div>';
    console.error(err);
  }
}

// --- render ---
function renderItems() {
  const list = state.items[state.store] || [];
  const c = $('#items-container');
  if (!list.length) {
    c.innerHTML = '<div class="empty-state">No items for ' + escapeHtml(state.store) + '.<br>Tap + Add Item below.</div>';
    return;
  }
  c.innerHTML = list.map(item => `
    <div class="item-row" data-id="${escapeAttr(item.id)}">
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.item)}</div>
        <div class="item-meta">${[item.quantity, item.notes].filter(Boolean).map(escapeHtml).join(' • ') || ' '}</div>
      </div>
      <div class="item-by-badge" title="${escapeAttr(item.addedBy)}">${escapeHtml(item.addedBy.charAt(0))}</div>
      <button class="check-btn" data-action="check" data-id="${escapeAttr(item.id)}" title="Mark bought">✓</button>
    </div>
  `).join('');
  c.querySelectorAll('.check-btn').forEach(btn => {
    btn.addEventListener('click', () => markBought(btn.dataset.id));
  });
}

function renderHistory() {
  const q = ($('#history-search').value || '').toLowerCase().trim();
  const list = state.history.filter(it => {
    if (!q) return true;
    return (it.item || '').toLowerCase().includes(q)
        || (it.notes || '').toLowerCase().includes(q)
        || (it.store || '').toLowerCase().includes(q);
  });
  const c = $('#history-container');
  if (!list.length) {
    c.innerHTML = '<div class="empty-state">No history yet.</div>';
    return;
  }
  c.innerHTML = list.map(item => {
    const date = (item.boughtDate || '').split(' ')[0] || '';
    const meta = [item.store, item.quantity, date].filter(Boolean).join(' • ');
    return `
      <div class="history-row" data-id="${escapeAttr(item.id)}">
        <div class="history-info">
          <div class="history-item">${escapeHtml(item.item)}</div>
          <div class="history-meta">${escapeHtml(meta)}</div>
        </div>
        <button class="readd-btn" data-id="${escapeAttr(item.id)}">+ Re-add</button>
      </div>
    `;
  }).join('');
  c.querySelectorAll('.readd-btn').forEach(btn => {
    btn.addEventListener('click', () => reAdd(btn.dataset.id));
  });
}

// --- actions ---
async function markBought(id) {
  const row = document.querySelector('.item-row[data-id="' + cssEscape(id) + '"]');
  if (row) row.classList.add('removing');
  try {
    const data = await apiPost('mark_bought', { id, boughtBy: state.user });
    if (!data.ok) throw new Error(data.error || 'unknown');
    // Remove from local state
    Object.keys(state.items).forEach(s => {
      state.items[s] = (state.items[s] || []).filter(it => it.id !== id);
    });
    renderItems();
    toast('Got it');
  } catch (err) {
    if (row) row.classList.remove('removing');
    toast('Could not mark bought', true);
    console.error(err);
  }
}

async function reAdd(id) {
  try {
    const data = await apiPost('readd', { id, addedBy: state.user });
    if (!data.ok) throw new Error(data.error || 'unknown');
    toast('Added back to list');
    refresh();
  } catch (err) {
    toast('Could not re-add', true);
    console.error(err);
  }
}

function openAddModal() {
  $('#add-modal').classList.remove('hidden');
  // Default to currently active store
  state.selectedAddStore = state.store;
  $$('.store-pick').forEach(b => b.classList.toggle('selected', b.dataset.store === state.store));
  $('#add-item').value = '';
  $('#add-qty').value = '';
  $('#add-notes').value = '';
  setTimeout(() => $('#add-item').focus(), 60);
}

function closeAddModal() {
  $('#add-modal').classList.add('hidden');
}

async function saveAdd() {
  const item = $('#add-item').value.trim();
  const qty = $('#add-qty').value.trim();
  const notes = $('#add-notes').value.trim();
  const store = state.selectedAddStore;
  if (!store) { toast('Pick a store', true); return; }
  if (!item) { toast('Enter an item', true); return; }
  $('#add-save').disabled = true;
  try {
    const data = await apiPost('add', {
      addedBy: state.user, store, item, quantity: qty, notes
    });
    if (!data.ok) throw new Error(data.error || 'unknown');
    closeAddModal();
    setStore(store);
    toast(`Added to ${store}`);
    refresh();
  } catch (err) {
    toast('Could not save', true);
    console.error(err);
  } finally {
    $('#add-save').disabled = false;
  }
}

// --- helpers ---
let toastTimer = null;
function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1800);
}

function setStatus(text) {
  $('#status-line').textContent = text;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) {
  return escapeHtml(s);
}
function cssEscape(s) {
  return String(s).replace(/(["'\\])/g, '\\$1');
}

// --- service worker ---
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW reg failed:', err));
  }
}
