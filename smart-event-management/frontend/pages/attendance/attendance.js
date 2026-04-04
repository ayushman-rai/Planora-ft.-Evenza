/* ============================================================
   Planora — Attendance Page JS
   ============================================================ */

'use strict';

// ── Starfield ──────────────────────────────────────────────
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createStars(count = 140) {
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random(),
      speed: Math.random() * 0.004 + 0.002,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      s.a += s.speed;
      const alpha = (Math.sin(s.a) * 0.5 + 0.5) * 0.7 + 0.1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,255,${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  createStars();
  draw();
  window.addEventListener('resize', () => { resize(); createStars(); });
})();

// ── Data ───────────────────────────────────────────────────
const COLORS = [
  '#7c3aed','#2563eb','#db2777','#d97706','#059669',
  '#7c3aed','#0891b2','#c026d3','#16a34a','#ea580c',
];

const ROLES = ['participant', 'participant', 'participant', 'volunteer', 'participant'];

function randomTime() {
  const h = Math.floor(Math.random() * 4) + 8;
  const m = Math.floor(Math.random() * 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} AM`;
}

function generateParticipants(count = 148) {
  const firstNames = ['Alex','Jordan','Morgan','Taylor','Casey','Riley','Quinn','Avery','Blake','Drew',
    'Sam','Jamie','Charlie','Skyler','Reese','Finley','Cameron','Dakota','Hayden','Peyton',
    'Emery','Sage','River','Rowan','Marlowe','Indigo','Phoenix','Zion','Cypress','Remy'];
  const lastNames  = ['Chen','Patel','Kim','Smith','Johnson','Williams','Brown','Garcia','Martinez','Lee',
    'Thompson','White','Harris','Clark','Lewis','Robinson','Walker','Hall','Young','Allen',
    'Wright','Scott','Green','Adams','Baker','Nelson','Carter','Mitchell','Perez','Roberts'];
  const domains = ['gmail.com','yahoo.com','outlook.com','protonmail.com','icloud.com'];

  return Array.from({ length: count }, (_, i) => {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    const isPresent = i < 112;
    return {
      id:      `PLN-${String(i + 1).padStart(4, '0')}`,
      name:    `${fn} ${ln}`,
      email:   `${fn.toLowerCase()}.${ln.toLowerCase()}@${domains[i % domains.length]}`,
      role:    ROLES[i % ROLES.length],
      color:   COLORS[i % COLORS.length],
      initials:`${fn[0]}${ln[0]}`,
      status:  isPresent ? 'present' : 'absent',
      time:    isPresent ? randomTime() : null,
    };
  });
}

// ── State ──────────────────────────────────────────────────
const STATE = {
  participants: generateParticipants(),
  filter:       'all',
  search:       '',
  currentPage:  1,
  perPage:      20,
  viewMode:     'table', // 'table' | 'grid'
  sortKey:      null,
  sortDir:      'asc',
};

// ── Helpers ────────────────────────────────────────────────
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function updateStats() {
  const total   = STATE.participants.length;
  const present = STATE.participants.filter(p => p.status === 'present').length;
  const absent  = total - present;
  const rate    = Math.round((present / total) * 100);

  animateCounter(document.querySelector('[data-target="148"]'), total);
  animateCounter(document.getElementById('presentCount'), present);
  animateCounter(document.getElementById('absentCount'),  absent);
  animateCounter(document.getElementById('rateValue'),    rate);

  document.querySelector('.rate-bar-value').textContent = `${rate}%`;
  document.getElementById('rateBarFill').style.width = `${rate}%`;

  // Update legend
  const legend = document.querySelectorAll('.rate-bar-legend span');
  if (legend[0]) legend[0].innerHTML = `<i class="legend-dot legend-present"></i> Present (${present})`;
  if (legend[1]) legend[1].innerHTML = `<i class="legend-dot legend-absent"></i> Absent (${absent})`;

  // Update tab counts
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => {
    const f = tab.dataset.filter;
    const count = f === 'all' ? total : STATE.participants.filter(p => p.status === f).length;
    const badge = tab.querySelector('.tab-count');
    if (badge) badge.textContent = count;
  });
}

function animateCounter(el, target) {
  if (!el) return;
  const start    = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Filtered & Sorted Data ─────────────────────────────────
function getFiltered() {
  let data = [...STATE.participants];

  if (STATE.filter !== 'all') {
    data = data.filter(p => p.status === STATE.filter);
  }

  if (STATE.search.trim()) {
    const q = STATE.search.toLowerCase();
    data = data.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  }

  if (STATE.sortKey) {
    data.sort((a, b) => {
      let va = a[STATE.sortKey] || '';
      let vb = b[STATE.sortKey] || '';
      if (STATE.sortKey === 'time') {
        va = va || 'ZZ'; vb = vb || 'ZZ';
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return STATE.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  return data;
}

function getPage(data) {
  const start = (STATE.currentPage - 1) * STATE.perPage;
  return data.slice(start, start + STATE.perPage);
}

// ── Toggle Attendance ──────────────────────────────────────
function toggleAttendance(id) {
  const p = STATE.participants.find(x => x.id === id);
  if (!p) return;
  if (p.status === 'absent') {
    p.status = 'present';
    p.time   = randomTime();
    showToast(`✓ ${p.name} marked as Present`, 'success');
  } else {
    p.status = 'absent';
    p.time   = null;
    showToast(`✗ ${p.name} marked as Absent`, 'error');
  }
  render();
  updateStats();
}

// ── Render Table ───────────────────────────────────────────
function renderTable(data) {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-3)">No participants found</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((p, idx) => `
    <tr class="row-animate" style="animation-delay:${idx * 0.03}s" data-id="${p.id}">
      <td class="th-check">
        <label class="custom-checkbox">
          <input type="checkbox" class="row-check" data-id="${p.id}" />
          <span class="checkmark"></span>
        </label>
      </td>
      <td>
        <div class="participant-cell">
          <div class="participant-avatar" style="background:${p.color}">${p.initials}</div>
          <div>
            <div class="participant-name">${p.name}</div>
            <div class="participant-email">${p.email}</div>
          </div>
        </div>
      </td>
      <td><span class="id-cell">${p.id}</span></td>
      <td><span class="role-badge role-${p.role}">${capitalize(p.role)}</span></td>
      <td>
        ${p.time
          ? `<span class="time-cell">${p.time}</span>`
          : `<span class="time-not-marked">—</span>`
        }
      </td>
      <td>
        <span class="status-badge status-${p.status}">
          ${p.status === 'present' ? 'Present' : 'Absent'}
        </span>
      </td>
      <td>
        <button class="toggle-btn toggle-${p.status === 'present' ? 'present' : 'absent'}"
                onclick="toggleAttendance('${p.id}')">
          ${p.status === 'present'
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Absent`
            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Present`
          }
        </button>
      </td>
    </tr>
  `).join('');

  // Row checkboxes
  tbody.querySelectorAll('.row-check').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
    });
  });
}

// ── Render Grid ────────────────────────────────────────────
function renderGrid(data) {
  const grid = document.getElementById('gridView');
  if (!grid) return;

  if (data.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-3)">No participants found</div>`;
    return;
  }

  grid.innerHTML = data.map((p, idx) => `
    <div class="grid-card ${p.status}-card" style="animation-delay:${idx * 0.025}s;animation:rowIn 0.3s ease forwards">
      <div class="grid-avatar" style="background:${p.color}">${p.initials}</div>
      <div class="grid-name">${p.name}</div>
      <div class="grid-role"><span class="role-badge role-${p.role}">${capitalize(p.role)}</span></div>
      <div class="grid-time">${p.time || '—'}</div>
      <button class="grid-toggle toggle-btn toggle-${p.status === 'present' ? 'present' : 'absent'}"
              onclick="toggleAttendance('${p.id}')">
        ${p.status === 'present'
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Mark Absent`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Mark Present`
        }
      </button>
    </div>
  `).join('');
}

// ── Render Pagination ──────────────────────────────────────
function renderPagination(total) {
  const pages    = Math.ceil(total / STATE.perPage);
  const curr     = STATE.currentPage;
  const start    = (curr - 1) * STATE.perPage + 1;
  const end      = Math.min(curr * STATE.perPage, total);

  document.getElementById('paginationInfo').textContent =
    total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`;

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  prevBtn.disabled = curr === 1;
  nextBtn.disabled = curr === pages || pages === 0;

  const pgNumbers = document.getElementById('pgNumbers');
  const maxPages  = 5;
  let startPage   = Math.max(1, curr - 2);
  let endPage     = Math.min(pages, startPage + maxPages - 1);
  if (endPage - startPage < maxPages - 1) startPage = Math.max(1, endPage - maxPages + 1);

  pgNumbers.innerHTML = Array.from({ length: endPage - startPage + 1 }, (_, i) => {
    const page = startPage + i;
    return `<button class="pg-num${page === curr ? ' active' : ''}" data-page="${page}">${page}</button>`;
  }).join('');

  pgNumbers.querySelectorAll('.pg-num').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.currentPage = parseInt(btn.dataset.page);
      render();
    });
  });
}

// ── Master Render ──────────────────────────────────────────
function render() {
  const filtered = getFiltered();
  const paged    = getPage(filtered);

  if (STATE.viewMode === 'table') {
    renderTable(paged);
  } else {
    renderGrid(paged);
  }

  renderPagination(filtered.length);
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Controls Wiring ────────────────────────────────────────
function initControls() {
  // Search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', () => {
    STATE.search = searchInput.value;
    STATE.currentPage = 1;
    searchClear.classList.toggle('visible', !!STATE.search);
    render();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    STATE.search = '';
    searchClear.classList.remove('visible');
    render();
  });

  // Filter Tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      STATE.filter = tab.dataset.filter;
      STATE.currentPage = 1;
      render();
    });
  });

  // View Toggle
  const tableViewBtn = document.getElementById('tableViewBtn');
  const gridViewBtn  = document.getElementById('gridViewBtn');
  const tableView    = document.getElementById('tableView');
  const gridView     = document.getElementById('gridView');

  tableViewBtn.addEventListener('click', () => {
    STATE.viewMode = 'table';
    tableViewBtn.classList.add('active');
    gridViewBtn.classList.remove('active');
    tableView.classList.remove('hidden');
    gridView.classList.add('hidden');
    render();
  });
  gridViewBtn.addEventListener('click', () => {
    STATE.viewMode = 'grid';
    gridViewBtn.classList.add('active');
    tableViewBtn.classList.remove('active');
    gridView.classList.remove('hidden');
    tableView.classList.add('hidden');
    render();
  });

  // Pagination Arrows
  document.getElementById('prevBtn').addEventListener('click', () => {
    if (STATE.currentPage > 1) { STATE.currentPage--; render(); }
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    const pages = Math.ceil(getFiltered().length / STATE.perPage);
    if (STATE.currentPage < pages) { STATE.currentPage++; render(); }
  });

  // Select All
  document.getElementById('selectAll').addEventListener('change', e => {
    document.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = e.target.checked;
      cb.closest('tr').classList.toggle('selected', e.target.checked);
    });
  });

  // Sort
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (STATE.sortKey === key) {
        STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        STATE.sortKey = key;
        STATE.sortDir = 'asc';
      }
      render();
    });
  });

  // Mark All Present (open modal)
  document.getElementById('markAllBtn').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.add('open');
  });

  // Modal Cancel
  document.getElementById('modalCancel').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.remove('open');
  });

  // Modal Confirm
  document.getElementById('modalConfirm').addEventListener('click', () => {
    STATE.participants.forEach(p => {
      if (p.status === 'absent') {
        p.status = 'present';
        p.time   = randomTime();
      }
    });
    document.getElementById('modalOverlay').classList.remove('open');
    render();
    updateStats();
    showToast('✓ All participants marked as Present', 'success');
  });

  // Close modal on overlay click
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) {
      document.getElementById('modalOverlay').classList.remove('open');
    }
  });

  // Export CSV
  document.getElementById('exportBtn').addEventListener('click', exportCSV);

  // Mobile sidebar toggle
  const menuToggle = document.getElementById('menuToggle');
  const sidebar    = document.getElementById('sidebar');
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // Event selector change
  document.getElementById('eventSelector').addEventListener('change', () => {
    STATE.participants = generateParticipants();
    STATE.currentPage  = 1;
    render();
    updateStats();
    showToast('Event switched — data refreshed', 'info');
  });
}

// ── Export CSV ─────────────────────────────────────────────
function exportCSV() {
  const headers = ['ID','Name','Email','Role','Status','Check-in Time'];
  const rows = STATE.participants.map(p =>
    [p.id, p.name, p.email, capitalize(p.role), capitalize(p.status), p.time || '—'].join(',')
  );
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'planora-attendance.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully', 'success');
}

// ── Animate Stats on Load ──────────────────────────────────
function animateStatsOnLoad() {
  const statEls = document.querySelectorAll('.stat-value[data-target]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el     = entry.target;
        const target = parseInt(el.dataset.target);
        animateCounter(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });
  statEls.forEach(el => observer.observe(el));

  // Rate bar animation
  setTimeout(() => {
    document.getElementById('rateBarFill').style.width = '76%';
  }, 400);
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  render();
  updateStats();
  initControls();
  animateStatsOnLoad();
});