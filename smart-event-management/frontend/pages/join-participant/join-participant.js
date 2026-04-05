/* =============================================
   JOIN PARTICIPANT — Planora
   join-participant.js
   Features:
   - Mock participant data with avatars, status, roles
   - Grid / List view toggle
   - Search (name, email, ID)
   - Filter (all, checked-in, pending, vip)
   - Sort (name, joined date, status)
   - Multi-select + bulk actions (check-in, remove)
   - Participant detail drawer (full info + timeline)
   - QR code ticket generation (canvas-drawn)
   - Add participant manually (modal form)
   - Check-in / undo toggle per card
   - Export CSV
   - Pagination (8 per page)
   - Stats counters + capacity bar
   - Starfield canvas
   - Toast notifications
   - Keyboard shortcuts (Escape)
   ============================================= */

'use strict';

/* ============================================================
   MOCK DATA
   ============================================================ */
const EVENT = {
  name: 'Tech Summit 2025',
  date: 'Apr 20, 2025',
  location: 'Bangalore, India',
  capacity: 130,
};

const AVATAR_COLORS = [
  ['#7c3aed','#9333ea'], ['#0891b2','#06b6d4'], ['#059669','#10b981'],
  ['#d97706','#f59e0b'], ['#dc2626','#ef4444'], ['#7c3aed','#a78bfa'],
  ['#0e7490','#22d3ee'], ['#065f46','#34d399'],
];

let participants = generateParticipants(24);

function generateParticipants(count) {
  const names = [
    'Priya Sharma','Arjun Mehta','Sneha Iyer','Rohan Das','Kavya Nair',
    'Aditya Patel','Meera Reddy','Vikram Singh','Ananya Bose','Rahul Gupta',
    'Deepika Rao','Siddharth Joshi','Pooja Verma','Karan Malhotra','Riya Kapoor',
    'Amit Kumar','Neha Pandey','Saurabh Tiwari','Isha Agarwal','Manish Chauhan',
    'Tanvi Mishra','Gaurav Bhatt','Simran Kaur','Varun Nanda',
  ];
  const roles = ['participant','participant','participant','participant','vip','speaker'];
  const domains = ['gmail.com','yahoo.com','outlook.com','protonmail.com','hotmail.com'];

  return names.slice(0, count).map((name, i) => {
    const joined = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 14);
    const colorIdx = i % AVATAR_COLORS.length;
    const role = roles[Math.floor(Math.random() * roles.length)];
    const checkedIn = Math.random() > 0.45;
    const nameParts = name.split(' ');
    const email = `${nameParts[0].toLowerCase()}.${nameParts[1].toLowerCase()}@${domains[i % domains.length]}`;
    return {
      id: `PLN-${String(10001 + i).padStart(5,'0')}`,
      name,
      email,
      phone: `+91 ${Math.floor(9000000000 + Math.random() * 999999999)}`,
      role,
      status: checkedIn ? 'checked' : 'pending',
      joinedAt: joined,
      avatarColor: AVATAR_COLORS[colorIdx],
      initials: nameParts.map(p => p[0]).join(''),
      notes: role === 'vip' ? 'VIP guest — priority seating.' : role === 'speaker' ? 'Keynote speaker, session 2.' : '',
      checkedInAt: checkedIn ? new Date(joined.getTime() + Math.random() * 1000 * 60 * 60 * 5) : null,
    };
  });
}

/* ============================================================
   STATE
   ============================================================ */
let filteredParticipants = [...participants];
let selectedIds = new Set();
let currentFilter = 'all';
let currentSort   = 'name-asc';
let currentSearch = '';
let currentView   = 'grid';
let currentPage   = 1;
const PAGE_SIZE   = 8;
let drawerParticipant = null;
let qrParticipant     = null;

/* ============================================================
   STARFIELD
   ============================================================ */
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

  function makeStar() {
    return {
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.1 + 0.2,
      alpha: Math.random() * 0.5 + 0.1,
      speed: Math.random() * 0.2 + 0.04,
      ts: Math.random() * 0.012 + 0.004, td: Math.random() > 0.5 ? 1 : -1,
    };
  }

  function init() { resize(); stars = Array.from({ length: 120 }, makeStar); }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.alpha += s.ts * s.td;
      if (s.alpha > 0.6 || s.alpha < 0.05) s.td *= -1;
      s.y -= s.speed;
      if (s.y < 0) { s.y = canvas.height; s.x = Math.random() * canvas.width; }
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,190,255,${s.alpha})`; ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  init(); draw();
  window.addEventListener('resize', resize);
})();

/* ============================================================
   RENDER PIPELINE
   ============================================================ */
function applyFiltersAndSort() {
  let list = [...participants];

  // Search
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  }

  // Filter
  if (currentFilter === 'checked') list = list.filter(p => p.status === 'checked');
  if (currentFilter === 'pending') list = list.filter(p => p.status === 'pending');
  if (currentFilter === 'vip')     list = list.filter(p => p.role === 'vip' || p.role === 'speaker');

  // Sort
  list.sort((a, b) => {
    switch (currentSort) {
      case 'name-asc':    return a.name.localeCompare(b.name);
      case 'name-desc':   return b.name.localeCompare(a.name);
      case 'joined-desc': return b.joinedAt - a.joinedAt;
      case 'joined-asc':  return a.joinedAt - b.joinedAt;
      case 'status':      return a.status.localeCompare(b.status);
      default:            return 0;
    }
  });

  filteredParticipants = list;
  currentPage = 1;
  renderGrid();
  renderPagination();
}

function renderGrid() {
  const grid  = document.getElementById('participantsGrid');
  const empty = document.getElementById('emptyState');
  if (!grid) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filteredParticipants.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = page.map((p, i) => buildCard(p, i)).join('');

  // Re-apply list/grid class
  if (currentView === 'list') {
    grid.classList.add('list-view');
  } else {
    grid.classList.remove('list-view');
  }
}

function buildCard(p, i) {
  const isSelected = selectedIds.has(p.id);
  const color = `linear-gradient(135deg,${p.avatarColor[0]},${p.avatarColor[1]})`;
  const delay  = `animation-delay:${i * 0.05}s`;

  const statusBadge = p.status === 'checked'
    ? `<span class="p-status-badge checked">✓ Checked In</span>`
    : `<span class="p-status-badge pending">⏳ Pending</span>`;

  const roleBadge = p.role === 'vip'
    ? `<span class="p-role-badge vip">⭐ VIP</span>`
    : p.role === 'speaker'
    ? `<span class="p-role-badge speaker">🎤 Speaker</span>`
    : `<span class="p-role-badge">Participant</span>`;

  const listExtra = currentView === 'list'
    ? `<div class="p-meta">
        <div class="p-meta-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" stroke-width="2"/></svg>
          ${p.email}
        </div>
        <div class="p-meta-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Joined ${formatDate(p.joinedAt)}
        </div>
      </div>`
    : '';

  const gridMeta = currentView === 'grid'
    ? `<div class="p-meta">
        <div class="p-meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" stroke-width="2"/></svg>
          ${p.email}
        </div>
        <div class="p-meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.35h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z" stroke="currentColor" stroke-width="2"/></svg>
          ${p.phone}
        </div>
        <div class="p-meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Joined ${formatDate(p.joinedAt)}
        </div>
      </div>`
    : '';

  return `
    <div class="p-card ${isSelected ? 'selected' : ''}" style="${delay}" data-id="${p.id}">
      <div class="p-card-top">
        <div class="p-card-left">
          <div class="p-select-check ${isSelected ? 'checked' : ''}" onclick="toggleSelect(event,'${p.id}')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="p-avatar" style="background:${color}">
            ${p.initials}
            <div class="p-avatar-status ${p.status}"></div>
          </div>
          <div>
            <div class="p-name">${p.name}</div>
            <div class="p-id">${p.id}</div>
          </div>
        </div>
        <div class="p-card-actions">
          <button class="p-action-btn" onclick="openQR(event,'${p.id}')" title="View ticket / QR">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="3" height="3" fill="currentColor"/><rect x="19" y="14" width="2" height="2" fill="currentColor"/><rect x="14" y="19" width="2" height="2" fill="currentColor"/></svg>
          </button>
          <button class="p-action-btn" onclick="openDrawer(event,'${p.id}')" title="View details">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="p-action-btn danger" onclick="removeParticipant(event,'${p.id}')" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      ${currentView === 'grid' ? gridMeta : listExtra}
      <div class="p-footer">
        ${statusBadge}
        ${roleBadge}
      </div>
    </div>
  `;
}

/* ============================================================
   PAGINATION
   ============================================================ */
function renderPagination() {
  const total = Math.ceil(filteredParticipants.length / PAGE_SIZE);
  const el    = document.getElementById('pagination');
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===total?'disabled':''}>›</button>`;
  el.innerHTML = html;
}

function goPage(page) {
  const total = Math.ceil(filteredParticipants.length / PAGE_SIZE);
  if (page < 1 || page > total) return;
  currentPage = page;
  renderGrid();
  renderPagination();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   STATS
   ============================================================ */
function updateStats() {
  const total     = participants.length;
  const checked   = participants.filter(p => p.status === 'checked').length;
  const pending   = total - checked;
  const capacity  = Math.round((total / EVENT.capacity) * 100);

  animateCount('statTotal',     total);
  animateCount('statCheckedIn', checked);
  animateCount('statPending',   pending);

  const capEl = document.getElementById('statCapacity');
  if (capEl) capEl.textContent = capacity + '%';

  const fillEl  = document.getElementById('capacityBarFill');
  const labelEl = document.getElementById('capacityBarLabel');
  if (fillEl)  setTimeout(() => { fillEl.style.width = capacity + '%'; }, 200);
  if (labelEl) labelEl.textContent = `${total} / ${EVENT.capacity} spots filled`;

  const navTitle = document.getElementById('navTitle');
  if (navTitle) navTitle.textContent = EVENT.name;
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step  = Math.ceil(target / 30);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 30);
}

/* ============================================================
   SEARCH
   ============================================================ */
function handleSearch() {
  const input = document.getElementById('searchInput');
  const clear = document.getElementById('searchClear');
  currentSearch = input.value.trim();
  clear?.classList.toggle('hidden', !currentSearch);
  applyFiltersAndSort();
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  currentSearch = '';
  document.getElementById('searchClear')?.classList.add('hidden');
  applyFiltersAndSort();
}

/* ============================================================
   FILTER
   ============================================================ */
function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFiltersAndSort();
}

/* ============================================================
   SORT
   ============================================================ */
function handleSort() {
  const select = document.getElementById('sortSelect');
  currentSort = select.value;
  applyFiltersAndSort();
}

/* ============================================================
   VIEW TOGGLE
   ============================================================ */
function setView(view) {
  currentView = view;
  document.getElementById('viewGrid')?.classList.toggle('active', view === 'grid');
  document.getElementById('viewList')?.classList.toggle('active', view === 'list');
  renderGrid();
}

/* ============================================================
   SELECTION + BULK ACTIONS
   ============================================================ */
function toggleSelect(e, id) {
  e.stopPropagation();
  if (selectedIds.has(id)) { selectedIds.delete(id); } else { selectedIds.add(id); }
  updateBulkBar();
  renderGrid();
}

function updateBulkBar() {
  const bar   = document.getElementById('bulkActions');
  const count = document.getElementById('bulkCount');
  if (!bar) return;
  const n = selectedIds.size;
  if (n > 0) {
    bar.classList.remove('hidden');
    if (count) count.textContent = `${n} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

function bulkCheckIn() {
  selectedIds.forEach(id => {
    const p = participants.find(x => x.id === id);
    if (p) { p.status = 'checked'; p.checkedInAt = new Date(); }
  });
  clearSelection();
  updateStats();
  applyFiltersAndSort();
  showToast(`${selectedIds.size || 'Selected'} participants checked in`, 'success');
}

function bulkRemove() {
  const n = selectedIds.size;
  participants = participants.filter(p => !selectedIds.has(p.id));
  clearSelection();
  updateStats();
  applyFiltersAndSort();
  showToast(`${n} participant(s) removed`, 'info');
}

function clearSelection() {
  selectedIds.clear();
  updateBulkBar();
  renderGrid();
}

/* ============================================================
   CHECK-IN TOGGLE (from drawer)
   ============================================================ */
function toggleCheckIn(id) {
  const p = participants.find(x => x.id === id);
  if (!p) return;
  if (p.status === 'checked') {
    p.status = 'pending';
    p.checkedInAt = null;
    showToast(`${p.name} check-in undone`, 'info');
  } else {
    p.status = 'checked';
    p.checkedInAt = new Date();
    showToast(`${p.name} checked in ✓`, 'success');
  }
  updateStats();
  applyFiltersAndSort();
  if (drawerParticipant?.id === id) openDrawer(null, id);
}

/* ============================================================
   REMOVE SINGLE
   ============================================================ */
function removeParticipant(e, id) {
  e.stopPropagation();
  const p = participants.find(x => x.id === id);
  if (!p) return;
  participants = participants.filter(x => x.id !== id);
  selectedIds.delete(id);
  updateStats();
  applyFiltersAndSort();
  showToast(`${p.name} removed`, 'error');
}

/* ============================================================
   DRAWER
   ============================================================ */
function openDrawer(e, id) {
  if (e) e.stopPropagation();
  const p = participants.find(x => x.id === id);
  if (!p) return;
  drawerParticipant = p;

  const body = document.getElementById('drawerBody');
  if (!body) return;

  const color = `linear-gradient(135deg,${p.avatarColor[0]},${p.avatarColor[1]})`;
  const statusLabel = p.status === 'checked' ? '✓ Checked In' : '⏳ Pending';
  const statusClass = p.status === 'checked' ? 'checked' : 'pending';

  const timeline = buildTimeline(p);

  body.innerHTML = `
    <div class="drawer-avatar-row">
      <div class="drawer-avatar" style="background:${color}">${p.initials}</div>
      <div>
        <div class="drawer-name">${p.name}</div>
        <div class="drawer-id">${p.id}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="p-status-badge ${statusClass}">${statusLabel}</span>
          <span class="p-role-badge ${p.role === 'vip' ? 'vip' : p.role === 'speaker' ? 'speaker' : ''}">${capitalize(p.role)}</span>
        </div>
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title">Contact Info</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item">
          <div class="drawer-info-label">Email</div>
          <div class="drawer-info-value">${p.email}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-label">Phone</div>
          <div class="drawer-info-value">${p.phone}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-label">Joined On</div>
          <div class="drawer-info-value">${formatDateFull(p.joinedAt)}</div>
        </div>
        <div class="drawer-info-item">
          <div class="drawer-info-label">Checked In</div>
          <div class="drawer-info-value">${p.checkedInAt ? formatDateFull(p.checkedInAt) : '—'}</div>
        </div>
      </div>
    </div>

    ${p.notes ? `
    <div class="drawer-section">
      <div class="drawer-section-title">Notes</div>
      <div class="drawer-info-item"><div class="drawer-info-value">${p.notes}</div></div>
    </div>` : ''}

    <div class="drawer-section">
      <div class="drawer-section-title">Activity Timeline</div>
      <div class="timeline">${timeline}</div>
    </div>

    <div class="drawer-actions">
      <button class="btn-purple" onclick="openQR(null,'${p.id}')">View Entry Ticket / QR</button>
      <button class="btn-green"  onclick="toggleCheckIn('${p.id}')">
        ${p.status === 'checked' ? 'Undo Check-In' : 'Mark as Checked In'}
      </button>
      <button class="btn-red" onclick="removeParticipant(event,'${p.id}'); closeDrawer()">Remove Participant</button>
    </div>
  `;

  document.getElementById('drawer')?.classList.remove('hidden');
  document.getElementById('drawerOverlay')?.classList.remove('hidden');
}

function buildTimeline(p) {
  const events = [
    { label: 'Registered for event', time: p.joinedAt },
    { label: 'Confirmation email sent', time: new Date(p.joinedAt.getTime() + 60000) },
  ];
  if (p.status === 'checked' && p.checkedInAt) {
    events.push({ label: 'Checked in at event', time: p.checkedInAt });
  }
  events.sort((a,b) => b.time - a.time);

  return events.map((ev, i) => `
    <div class="timeline-item">
      <div class="timeline-line">
        <div class="timeline-dot"></div>
        ${i < events.length - 1 ? '<div class="timeline-track"></div>' : ''}
      </div>
      <div class="timeline-content">
        <div class="timeline-event">${ev.label}</div>
        <div class="timeline-time">${formatDateFull(ev.time)}</div>
      </div>
    </div>
  `).join('');
}

function closeDrawer() {
  document.getElementById('drawer')?.classList.add('hidden');
  document.getElementById('drawerOverlay')?.classList.add('hidden');
  drawerParticipant = null;
}

/* ============================================================
   QR CODE (canvas-drawn pattern)
   ============================================================ */
function openQR(e, id) {
  if (e) e.stopPropagation();
  const p = participants.find(x => x.id === id);
  if (!p) return;
  qrParticipant = p;

  document.getElementById('qrEventName').textContent       = EVENT.name;
  document.getElementById('qrParticipantName').textContent  = p.name;
  document.getElementById('qrRoleBadge').textContent        = capitalize(p.role);
  document.getElementById('qrTicketId').textContent         = p.id;
  document.getElementById('qrTicketDate').textContent       = EVENT.date;

  document.getElementById('qrOverlay')?.classList.remove('hidden');

  // Draw QR-like canvas pattern (decorative)
  setTimeout(() => drawQRPattern(p.id), 50);
}

function drawQRPattern(seed) {
  const canvas = document.getElementById('qrCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 160;
  const cellSize = 8;
  const cells = size / cellSize; // 20x20

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Seeded pseudo-random
  let s = seed.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  function rand() { s = (s * 9301 + 49297) % 233280; return s / 233280; }

  ctx.fillStyle = '#111';

  // Fill random cells
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      // Skip finder pattern zones
      const inFinder = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
      if (!inFinder && rand() > 0.55) {
        ctx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }

  // Draw 3 finder patterns (corner squares)
  function drawFinder(x, y) {
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, 7 * cellSize, 7 * cellSize);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize);
    ctx.fillStyle = '#111';
    ctx.fillRect(x + 2 * cellSize, y + 2 * cellSize, 3 * cellSize, 3 * cellSize);
  }

  drawFinder(0, 0);
  drawFinder((cells - 7) * cellSize, 0);
  drawFinder(0, (cells - 7) * cellSize);
}

function closeQR() {
  document.getElementById('qrOverlay')?.classList.add('hidden');
  qrParticipant = null;
}

function downloadTicket() {
  const canvas = document.getElementById('qrCanvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `planora-ticket-${qrParticipant?.id || 'ticket'}.png`;
  link.href = canvas.toDataURL();
  link.click();
  showToast('Ticket downloaded!', 'success');
}

/* ============================================================
   ADD PARTICIPANT MANUALLY
   ============================================================ */
function openAdd() {
  document.getElementById('addOverlay')?.classList.remove('hidden');
  setTimeout(() => document.getElementById('addName')?.focus(), 100);
}

function closeAdd() {
  document.getElementById('addOverlay')?.classList.add('hidden');
  ['addName','addEmail','addPhone','addNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function addParticipantManual() {
  const name  = document.getElementById('addName')?.value.trim();
  const email = document.getElementById('addEmail')?.value.trim();
  const phone = document.getElementById('addPhone')?.value.trim() || 'N/A';
  const role  = document.getElementById('addRole')?.value || 'participant';
  const notes = document.getElementById('addNotes')?.value.trim() || '';

  if (!name || !email) {
    showToast('Name and email are required.', 'error');
    return;
  }

  const nameParts = name.split(' ');
  const initials  = nameParts.map(p => p[0]).toUpperCase().join('').slice(0,2);
  const colorIdx  = participants.length % AVATAR_COLORS.length;
  const newId     = `PLN-${String(10001 + participants.length).padStart(5,'0')}`;

  participants.unshift({
    id: newId,
    name, email, phone, role, notes,
    status: 'pending',
    joinedAt: new Date(),
    avatarColor: AVATAR_COLORS[colorIdx],
    initials,
    checkedInAt: null,
  });

  closeAdd();
  updateStats();
  applyFiltersAndSort();
  showToast(`${name} added as ${capitalize(role)}!`, 'success');
}

/* ============================================================
   EXPORT CSV
   ============================================================ */
function exportCSV() {
  const headers = ['ID','Name','Email','Phone','Role','Status','Joined At','Checked In At'];
  const rows = participants.map(p => [
    p.id, p.name, p.email, p.phone,
    capitalize(p.role),
    p.status === 'checked' ? 'Checked In' : 'Pending',
    formatDateFull(p.joinedAt),
    p.checkedInAt ? formatDateFull(p.checkedInAt) : '',
  ]);

  const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `planora-participants-${EVENT.name.replace(/\s+/g,'-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div class="toast-dot"></div><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('qrOverlay')?.classList.contains('hidden'))   { closeQR();     return; }
      if (!document.getElementById('addOverlay')?.classList.contains('hidden'))  { closeAdd();    return; }
      if (!document.getElementById('drawer')?.classList.contains('hidden'))      { closeDrawer(); return; }
      if (selectedIds.size) { clearSelection(); return; }
    }
  });
}

/* ============================================================
   NAVBAR SCROLL
   ============================================================ */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (!navbar) return;
    navbar.style.background = window.scrollY > 20 ? 'rgba(5,5,7,0.95)' : 'rgba(5,5,7,0.75)';
  });
}

/* ============================================================
   UTILS
   ============================================================ */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function formatDateFull(date) {
  return date.toLocaleString('en-IN', {
    day:'numeric', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit',
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initKeyboard();
  updateStats();
  applyFiltersAndSort();
});