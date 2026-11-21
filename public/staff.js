/**
 * staff.js — CivicResolve Staff Console SPA
 * Vanilla JS, no framework, no bundler.
 * Manages #overview | #reports | #report/:id | #map | #analytics | #team | #settings
 * inside #console-main.
 *
 * Design: white/professional, civic blue #1D4ED8, no emojis in UI.
 * "Analysis" panel labels never mention AI or Gemini to end users.
 */

'use strict';

/* ─────────────────────────── Labels ───────────────────────────────────── */
const L = {
  appTitle: 'CivicResolve Staff',
  overview: 'Overview',
  reports: 'Reports',
  map: 'Map',
  analytics: 'Analytics',
  team: 'Team',
  settings: 'Settings',

  // KPI labels
  totalOpen: 'Total Open',
  critical: 'Critical',
  overdue: 'Overdue',
  avgResolution: 'Avg Resolution',
  hours: 'hrs',
  slaCompliance: 'SLA Compliance',
  recentActivity: 'Recent Activity',
  quickActions: 'Quick Actions',
  assignUnassigned: 'Assign Unassigned Critical',

  // Reports table
  id: 'ID',
  title: 'Title',
  status: 'Status',
  priority: 'Priority',
  category: 'Category',
  department: 'Department',
  ward: 'Ward',
  submittedAt: 'Submitted',
  dueAt: 'Due',
  assignedTo: 'Assigned To',
  actions: 'Actions',
  filters: 'Filters',
  applyFilters: 'Apply Filters',
  clearFilters: 'Clear Filters',
  bulkAssign: 'Bulk Assign',
  bulkStatus: 'Change Status',
  exportCSV: 'Export CSV',
  savedViews: 'Saved Views',
  saveView: 'Save Current View',
  noReports: 'No reports match the current filters.',
  loading: 'Loading…',
  error: 'Failed to load. Retry?',
  retry: 'Retry',
  back: 'Back',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  previous: 'Previous',
  next: 'Next',
  page: 'Page',
  of: 'of',
  perPage: 'Per page',
  sortAsc: 'Sort ascending',
  sortDesc: 'Sort descending',
  selected: 'selected',
  selectAll: 'Select all',
  deselectAll: 'Deselect all',

  // Report detail
  reportDetail: 'Report Detail',
  originalText: 'Original Text',
  englishTranslation: 'English Translation',
  showTranslation: 'Show Translation',
  hideTranslation: 'Hide Translation',
  imageGallery: 'Images',
  locationMap: 'Location Map',
  analysis: 'Analysis',
  analysisCategory: 'Category',
  analysisPriority: 'Priority',
  analysisImpact: 'Impact Score',
  analysisConfidence: 'Confidence',
  analysisRecommended: 'Recommended Action',
  analysisNotes: 'Analysis Notes',
  analysisImageFindings: 'Image Findings',
  duplicateLinks: 'Possible Duplicates',
  overrideCategory: 'Override Category',
  overridePriority: 'Override Priority',
  overrideReason: 'Reason (required)',
  applyOverride: 'Apply Override',
  changeStatus: 'Change Status',
  internalNote: 'Internal Note',
  publicNote: 'Public Note',
  updateStatus: 'Update Status',
  assignTo: 'Assign To',
  assignOfficer: 'Assign Officer',
  auditTimeline: 'Audit Timeline',
  unassigned: 'Unassigned',
  noImages: 'No images attached.',
  noDuplicates: 'No duplicates detected.',
  noLocation: 'No location data.',

  // Map
  mapView: 'Map View',
  clickMarker: 'Click a marker to see details.',

  // Analytics
  resolutionRate: 'Resolution Rate',
  avgResolutionTime: 'Avg Resolution Time',
  slaComplianceRate: 'SLA Compliance',
  overrideRate: 'Override Rate',
  byDepartment: 'By Department',
  byWard: 'By Ward',
  byCategory: 'By Category',
  trend30d: '30-Day Trend',
  resolved: 'Resolved',
  total: 'Total',

  // Team
  teamManagement: 'Team Management',
  inviteByEmail: 'Invite by Email',
  invite: 'Invite',
  name: 'Name',
  email: 'Email',
  role: 'Role',
  ticketCount: 'Tickets',
  deactivate: 'Deactivate',
  editRole: 'Edit Role',
  editDept: 'Edit Department',
  adminOnly: 'Admin access required.',
  inviteSent: 'Invitation sent.',

  // Settings
  slaTargets: 'SLA Targets (hours)',
  departments: 'Departments',
  categoryMapping: 'Category-to-Department Mapping',
  addDepartment: 'Add Department',
  saveSLA: 'Save SLA Targets',
  saveMapping: 'Save Mapping',

  // Misc
  noData: 'No data available.',
  unknownError: 'An unknown error occurred.',
  successSaved: 'Saved successfully.',
  confirmDeactivate: 'Deactivate this account?',
};

/* ─────────────────────────── Core helpers ──────────────────────────────── */

/** Shorthand querySelector */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/** HTML-escape a value */
const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/** Active toast timeout handle */
let _toastTimer = null;

/**
 * Show a toast notification.
 * @param {string} msg
 * @param {'info'|'success'|'error'} type
 */
function toast(msg, type = 'info') {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    container.style.cssText = [
      'position:fixed', 'bottom:1.5rem', 'left:50%', 'transform:translateX(-50%)',
      'z-index:9999', 'display:flex', 'flex-direction:column', 'gap:.5rem',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  const bg = type === 'error' ? '#b91c1c' : type === 'success' ? '#047857' : '#1D4ED8';
  el.style.cssText = [
    `background:${bg}`, 'color:#fff', 'padding:.7rem 1.2rem', 'border-radius:10px',
    'font-size:.95rem', 'font-weight:600', 'opacity:0',
    'transition:opacity .22s', 'pointer-events:none', 'max-width:380px',
    'text-align:center',
  ].join(';');
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => {
    el.style.opacity = '0';
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3400);
}

/**
 * Fetch wrapper — always uses credentials:'include', redirects to /staff-login.html on 401.
 * @param {string} path - path appended to /api
 * @param {RequestInit} opts
 */
async function api(path, opts = {}) {
  const defaults = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  };
  let res;
  try {
    res = await fetch('/api' + path, { ...defaults, ...opts, headers: { ...defaults.headers, ...(opts.headers || {}) } });
  } catch (e) {
    throw new Error('Network error: ' + e.message);
  }
  if (res.status === 401) {
    window.location.href = '/staff-login.html?next=' + encodeURIComponent(window.location.href);
    throw new Error('Unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Format an ISO date string to locale date/time */
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

/** Format an ISO date string as relative time (e.g. "2 hours ago") */
function formatRelative(iso) {
  if (!iso) return '—';
  try {
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return 'just now';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
    if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
    return rtf.format(-Math.round(diff / 86400), 'day');
  } catch { return iso; }
}

/** Generate n skeleton loading blocks */
function skeleton(n = 3) {
  return Array.from({ length: n }, () =>
    `<div class="sc-skeleton" aria-hidden="true" style="
      height:4.5rem;border-radius:10px;
      background:linear-gradient(90deg,#e8ecf3 25%,#f4f6fa 50%,#e8ecf3 75%);
      background-size:200% 100%;animation:sc-shimmer 1.4s infinite;margin-bottom:.8rem;
    "></div>`
  ).join('');
}

/** KPI card HTML */
function renderKPI(label, value, sub = '', colorClass = 'sc-blue') {
  return `<div class="sc-kpi-card" role="article" aria-label="${esc(label)}: ${esc(value)}">
    <div class="sc-kpi-value ${esc(colorClass)}">${esc(String(value))}</div>
    <div class="sc-kpi-label">${esc(label)}</div>
    ${sub ? `<div class="sc-kpi-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

/**
 * Horizontal CSS bar chart HTML.
 * @param {Array<{label:string, value:number}>} data
 * @param {number} maxVal
 * @param {string} colorVar - CSS custom property name, e.g. '--sc-blue'
 */
function cssBars(data, maxVal, colorVar = '--sc-blue') {
  if (!data || !data.length) return `<p class="sc-muted">${esc(L.noData)}</p>`;
  const mx = maxVal || Math.max(1, ...data.map(d => d.value));
  return `<div class="sc-bars" role="list">
    ${data.map(d => `
      <div class="sc-bar-row" role="listitem">
        <span class="sc-bar-label" title="${esc(d.label)}">${esc(d.label)}</span>
        <div class="sc-bar-track" role="progressbar"
             aria-valuenow="${d.value}" aria-valuemin="0" aria-valuemax="${mx}"
             aria-label="${esc(d.label)}: ${d.value}">
          <div class="sc-bar-fill" style="width:${Math.round(d.value / mx * 100)}%;background:var(${esc(colorVar)})"></div>
        </div>
        <span class="sc-bar-val">${d.value}</span>
      </div>
    `).join('')}
  </div>`;
}

/**
 * Vertical timeline HTML.
 * @param {Array<{at:string, actor:string, action:string, note?:string}>} events
 */
function renderTimeline(events) {
  if (!events || !events.length) return `<p class="sc-muted">${esc(L.noData)}</p>`;
  return `<ol class="sc-timeline" aria-label="${esc(L.auditTimeline)}">
    ${events.map(ev => `
      <li class="sc-tl-item">
        <div class="sc-tl-dot" aria-hidden="true"></div>
        <div class="sc-tl-body">
          <div class="sc-tl-action">${esc(ev.action || ev.status || '')}</div>
          <div class="sc-tl-meta sc-muted">
            ${ev.actor ? `<span>${esc(ev.actor)}</span> · ` : ''}
            <time datetime="${esc(ev.at)}">${formatRelative(ev.at)}</time>
          </div>
          ${ev.note ? `<div class="sc-tl-note">${esc(ev.note)}</div>` : ''}
        </div>
      </li>
    `).join('')}
  </ol>`;
}

/** Priority → color mapping */
const PRIORITY_COLORS = {
  Critical: '#b91c1c',
  High: '#b45309',
  Medium: '#1D4ED8',
  Low: '#047857',
};

/** Priority badge HTML */
function priorityBadge(p) {
  const color = PRIORITY_COLORS[p] || '#5b6078';
  return `<span class="sc-badge" style="color:${color};border-color:${color}" aria-label="Priority: ${esc(p)}">${esc(p)}</span>`;
}

/** Status badge HTML */
function statusBadge(s) {
  const colorMap = {
    Received: '#1D4ED8', 'Under Review': '#7c3aed',
    Assigned: '#b45309', 'In Progress': '#047857', Resolved: '#374151',
  };
  const c = colorMap[s] || '#5b6078';
  return `<span class="sc-badge" style="color:${c};border-color:${c}" aria-label="Status: ${esc(s)}">${esc(s)}</span>`;
}

/* ─────────────────────────── Route state ───────────────────────────────── */

let _currentUser = null; // populated by /api/staff/me

/** Inject global styles once */
function injectStyles() {
  if ($('#sc-styles')) return;
  const style = document.createElement('style');
  style.id = 'sc-styles';
  style.textContent = `
    @keyframes sc-shimmer {
      0%{background-position:200% 0} 100%{background-position:-200% 0}
    }
    :root {
      --sc-blue:#1D4ED8;
      --sc-blue-lt:#EFF6FF;
      --sc-blue-dark:#1e40af;
      --sc-red:#b91c1c;
      --sc-orange:#b45309;
      --sc-green:#047857;
      --sc-purple:#7c3aed;
      --sc-bg:#F8FAFC;
      --sc-card:#ffffff;
      --sc-border:#E2E8F0;
      --sc-ink:#1E293B;
      --sc-muted:#64748B;
      --sc-radius:12px;
    }
    .sc-console-wrap { display:flex; height:100vh; overflow:hidden; background:var(--sc-bg); }
    .sc-sidebar {
      width:220px; flex-shrink:0; background:#fff; border-right:1px solid var(--sc-border);
      display:flex; flex-direction:column; overflow-y:auto;
    }
    .sc-sidebar-brand {
      padding:1.2rem 1.2rem .8rem; font-size:1.1rem; font-weight:800;
      color:var(--sc-blue); border-bottom:1px solid var(--sc-border); flex-shrink:0;
    }
    .sc-nav { list-style:none; margin:0; padding:.5rem 0; flex:1; }
    .sc-nav li a {
      display:flex; align-items:center; gap:.6rem; padding:.65rem 1.2rem;
      color:var(--sc-muted); text-decoration:none; font-weight:600; font-size:.93rem;
      border-left:3px solid transparent; transition:all .15s; min-height:44px;
      border-radius:0 8px 8px 0; margin:1px .5rem 1px 0;
    }
    .sc-nav li a:hover { background:var(--sc-blue-lt); color:var(--sc-blue); }
    .sc-nav li a[aria-current=page] {
      background:var(--sc-blue-lt); color:var(--sc-blue);
      border-left-color:var(--sc-blue);
    }
    .sc-nav-icon { width:18px; height:18px; flex-shrink:0; }
    .sc-sidebar-footer {
      padding:1rem 1.2rem; border-top:1px solid var(--sc-border);
      font-size:.85rem; color:var(--sc-muted);
    }
    .sc-main-wrap { flex:1; overflow-y:auto; display:flex; flex-direction:column; }
    .sc-topbar {
      background:#fff; border-bottom:1px solid var(--sc-border);
      padding:.75rem 1.5rem; display:flex; align-items:center;
      gap:.8rem; flex-shrink:0; min-height:56px;
    }
    .sc-topbar-title { font-size:1.15rem; font-weight:700; color:var(--sc-ink); flex:1; }
    #console-main { flex:1; padding:1.5rem; outline:none; }
    .sc-card {
      background:var(--sc-card); border:1px solid var(--sc-border);
      border-radius:var(--sc-radius); padding:1.25rem; margin-bottom:1rem;
    }
    .sc-card-title { font-size:1rem; font-weight:700; margin:0 0 .75rem; color:var(--sc-ink); }
    .sc-grid { display:grid; gap:1rem; }
    .sc-g4 { grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }
    .sc-g3 { grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); }
    .sc-g2 { grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); }
    .sc-kpi-card {
      background:var(--sc-card); border:1px solid var(--sc-border);
      border-radius:var(--sc-radius); padding:1.1rem 1.25rem;
    }
    .sc-kpi-value { font-size:2rem; font-weight:800; line-height:1; margin-bottom:.25rem; }
    .sc-kpi-label { font-size:.85rem; font-weight:600; color:var(--sc-muted); }
    .sc-kpi-sub { font-size:.8rem; color:var(--sc-muted); margin-top:.2rem; }
    .sc-blue { color:var(--sc-blue); }
    .sc-red { color:var(--sc-red); }
    .sc-orange { color:var(--sc-orange); }
    .sc-green { color:var(--sc-green); }
    .sc-muted { color:var(--sc-muted); font-size:.9rem; }
    .sc-badge {
      display:inline-block; font-size:.75rem; font-weight:700;
      border-radius:999px; padding:.18rem .6rem; border:1.5px solid currentColor;
    }
    .sc-btn {
      display:inline-flex; align-items:center; gap:.4rem; border:0;
      border-radius:8px; padding:.6rem 1.1rem; font:inherit; font-weight:700;
      cursor:pointer; text-decoration:none; min-height:44px;
      background:var(--sc-blue); color:#fff; transition:background .15s;
    }
    .sc-btn:hover { background:var(--sc-blue-dark); }
    .sc-btn:disabled { opacity:.55; cursor:wait; }
    .sc-btn.alt {
      background:transparent; color:var(--sc-blue); border:2px solid var(--sc-blue);
    }
    .sc-btn.alt:hover { background:var(--sc-blue-lt); }
    .sc-btn.sm { padding:.4rem .8rem; min-height:36px; font-size:.88rem; }
    .sc-btn.danger { background:var(--sc-red); }
    .sc-btn.danger:hover { background:#991b1b; }
    .sc-input-wrap { margin-bottom:.8rem; }
    .sc-input-wrap label { display:block; font-weight:600; font-size:.88rem; margin-bottom:.3rem; }
    .sc-input {
      width:100%; font:inherit; padding:.6rem .8rem; border:1.5px solid var(--sc-border);
      border-radius:8px; background:#fff; color:var(--sc-ink); min-height:44px;
    }
    .sc-input:focus { outline:3px solid #93C5FD; outline-offset:1px; }
    .sc-select { appearance:auto; }
    .sc-textarea { min-height:90px; resize:vertical; }
    .sc-table-wrap { overflow-x:auto; }
    table.sc-table { width:100%; border-collapse:collapse; font-size:.9rem; }
    table.sc-table th, table.sc-table td {
      text-align:left; padding:.6rem .75rem; border-bottom:1px solid var(--sc-border);
      vertical-align:middle;
    }
    table.sc-table th {
      font-weight:700; color:var(--sc-muted); font-size:.82rem;
      text-transform:uppercase; letter-spacing:.04em; white-space:nowrap;
      background:var(--sc-bg);
    }
    table.sc-table tr:last-child td { border-bottom:none; }
    table.sc-table tbody tr:hover { background:var(--sc-blue-lt); cursor:pointer; }
    table.sc-table th button.sort-btn {
      background:none; border:none; cursor:pointer; font:inherit;
      font-weight:700; color:inherit; padding:0; display:inline-flex; align-items:center; gap:.2rem;
    }
    .sc-toolbar {
      display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; margin-bottom:1rem;
    }
    .sc-toolbar > * { flex:1; min-width:140px; }
    .sc-toolbar > .sc-btn, .sc-toolbar > .sc-toolbar-fixed { flex:0 0 auto; }
    .sc-filter-panel {
      background:var(--sc-bg); border:1px solid var(--sc-border); border-radius:10px;
      padding:1rem; margin-bottom:1rem; display:grid; gap:.75rem;
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
    }
    .sc-filter-panel .sc-btn-row {
      grid-column:1/-1; display:flex; gap:.5rem; flex-wrap:wrap;
    }
    .sc-pagination {
      display:flex; align-items:center; gap:.5rem; flex-wrap:wrap;
      margin-top:1rem; font-size:.9rem; color:var(--sc-muted);
    }
    .sc-pagination > * { flex-shrink:0; }
    .sc-bars { display:flex; flex-direction:column; gap:.45rem; }
    .sc-bar-row { display:grid; grid-template-columns:130px 1fr 36px; gap:.6rem; align-items:center; }
    .sc-bar-label { font-size:.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sc-bar-track {
      height:9px; border-radius:9px; background:var(--sc-border); overflow:hidden;
    }
    .sc-bar-fill { height:100%; border-radius:9px; transition:width .4s; }
    .sc-bar-val { font-size:.82rem; font-weight:700; text-align:right; }
    .sc-timeline { list-style:none; padding:0; margin:0; position:relative; }
    .sc-timeline::before {
      content:''; position:absolute; top:0; bottom:0; left:7px;
      width:2px; background:var(--sc-border);
    }
    .sc-tl-item { display:flex; gap:.85rem; padding:.5rem 0; position:relative; }
    .sc-tl-dot {
      width:14px; height:14px; border-radius:50%; background:var(--sc-blue);
      flex-shrink:0; margin-top:.2rem; border:2px solid #fff;
      box-shadow:0 0 0 2px var(--sc-blue); z-index:1;
    }
    .sc-tl-action { font-weight:600; font-size:.9rem; }
    .sc-tl-meta { font-size:.82rem; }
    .sc-tl-note {
      font-size:.88rem; margin-top:.2rem; color:var(--sc-ink);
      background:var(--sc-bg); border-radius:6px; padding:.35rem .6rem;
    }
    .sc-detail-grid {
      display:grid; grid-template-columns:1fr 340px; gap:1.25rem;
    }
    @media(max-width:800px) {
      .sc-detail-grid { grid-template-columns:1fr; }
      .sc-sidebar { display:none; }
    }
    .sc-analysis-row { display:flex; justify-content:space-between; padding:.4rem 0;
      border-bottom:1px solid var(--sc-border); font-size:.9rem; }
    .sc-analysis-row:last-child { border-bottom:none; }
    .sc-analysis-key { font-weight:600; color:var(--sc-muted); }
    .sc-analysis-val { text-align:right; max-width:60%; }
    .sc-lightbox-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:9000;
      display:flex; align-items:center; justify-content:center; cursor:pointer;
    }
    .sc-lightbox-overlay img {
      max-width:92vw; max-height:92vh; border-radius:10px; object-fit:contain;
    }
    .sc-lightbox-close {
      position:fixed; top:1rem; right:1.2rem; color:#fff; font-size:2rem;
      background:none; border:none; cursor:pointer; line-height:1; z-index:9001;
    }
    .sc-gallery { display:flex; gap:.6rem; flex-wrap:wrap; margin:.5rem 0; }
    .sc-gallery img {
      width:90px; height:90px; object-fit:cover; border-radius:8px; cursor:zoom-in;
      border:2px solid transparent; transition:border-color .15s;
    }
    .sc-gallery img:hover { border-color:var(--sc-blue); }
    .sc-map-wrap iframe { width:100%; height:260px; border:0; border-radius:10px; margin-top:.5rem; }
    .sc-sparkline { display:flex; align-items:flex-end; gap:3px; height:48px; }
    .sc-spark-bar {
      flex:1; border-radius:3px 3px 0 0; background:var(--sc-blue); opacity:.8;
      transition:opacity .15s; min-width:4px;
    }
    .sc-spark-bar:hover { opacity:1; }
    .sc-row { display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; }
    .sc-row > * { flex:1; }
    .sc-row > .sc-btn, .sc-row > .sc-flex-none { flex:0 0 auto; }
    .sc-alert {
      border-radius:8px; padding:.7rem 1rem; font-size:.9rem;
      margin-bottom:1rem; border:1px solid;
    }
    .sc-alert.info { background:#EFF6FF; border-color:#BFDBFE; color:#1E40AF; }
    .sc-alert.error { background:#FEF2F2; border-color:#FECACA; color:#991B1B; }
    .sc-alert.success { background:#ECFDF5; border-color:#A7F3D0; color:#065F46; }
    .sc-checkbox-group { display:flex; gap:.4rem; flex-wrap:wrap; }
    .sc-checkbox-group label {
      display:inline-flex; align-items:center; gap:.35rem; font-size:.88rem;
      font-weight:400; cursor:pointer; padding:.3rem .5rem; border-radius:6px;
      border:1.5px solid var(--sc-border); background:#fff; min-height:36px;
    }
    .sc-checkbox-group label:hover { border-color:var(--sc-blue); }
    .sc-checkbox-group input[type=checkbox]:checked + span { color:var(--sc-blue); }
    .sc-saved-views { display:flex; gap:.4rem; flex-wrap:wrap; margin-bottom:.6rem; }
    .sc-saved-view-btn {
      font-size:.82rem; padding:.3rem .7rem; border-radius:999px;
      border:1.5px solid var(--sc-border); background:#fff; cursor:pointer;
      font-weight:600; color:var(--sc-muted); min-height:32px;
    }
    .sc-saved-view-btn:hover { border-color:var(--sc-blue); color:var(--sc-blue); }
    .sc-map-console-wrap { display:flex; height:100%; gap:1rem; }
    .sc-map-console-map { flex:1; min-height:500px; border-radius:12px; overflow:hidden; border:1px solid var(--sc-border); }
    .sc-map-sidebar { width:300px; flex-shrink:0; overflow-y:auto; }
    @media(max-width:700px) {
      .sc-map-console-wrap { flex-direction:column; }
      .sc-map-sidebar { width:100%; }
    }
    .sc-team-invite { display:flex; gap:.5rem; align-items:flex-end; margin-bottom:1rem; }
    .sc-team-invite .sc-input-wrap { flex:1; margin-bottom:0; }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
    #sc-global-loading {
      position:fixed; top:0; left:0; right:0; height:3px;
      background:var(--sc-blue); z-index:99999;
      transform:scaleX(0); transform-origin:left;
      transition:transform .3s;
    }
  `;
  document.head.appendChild(style);
}

/* ─────────────────────────── Loading bar ───────────────────────────────── */

let _loadingEl = null;
function showLoading() {
  if (!_loadingEl) {
    _loadingEl = document.createElement('div');
    _loadingEl.id = 'sc-global-loading';
    _loadingEl.setAttribute('role', 'progressbar');
    _loadingEl.setAttribute('aria-label', L.loading);
    document.body.prepend(_loadingEl);
  }
  _loadingEl.style.transform = 'scaleX(.4)';
}
function hideLoading() {
  if (_loadingEl) {
    _loadingEl.style.transform = 'scaleX(1)';
    setTimeout(() => { if (_loadingEl) { _loadingEl.style.transform = 'scaleX(0)'; } }, 300);
  }
}

/* ─────────────────────────── Shell ─────────────────────────────────────── */

/**
 * Builds the console shell (sidebar + topbar + main area) if not already present.
 */
function ensureShell() {
  if ($('#sc-shell')) return;
  injectStyles();

  const NAV_ITEMS = [
    { hash: 'overview',   label: L.overview,   icon: homeIcon() },
    { hash: 'reports',    label: L.reports,    icon: listIcon() },
    { hash: 'map',        label: L.map,        icon: mapIcon() },
    { hash: 'analytics',  label: L.analytics,  icon: chartIcon() },
    { hash: 'team',       label: L.team,       icon: teamIcon() },
    { hash: 'settings',   label: L.settings,   icon: gearIcon() },
  ];

  const shell = document.createElement('div');
  shell.id = 'sc-shell';
  shell.className = 'sc-console-wrap';
  shell.innerHTML = `
    <nav class="sc-sidebar" aria-label="Staff navigation">
      <div class="sc-sidebar-brand" aria-label="${esc(L.appTitle)}">${esc(L.appTitle)}</div>
      <ul class="sc-nav" role="list">
        ${NAV_ITEMS.map(n => `
          <li role="listitem">
            <a href="#${esc(n.hash)}" aria-label="${esc(n.label)}" data-nav="${esc(n.hash)}">
              ${n.icon}
              ${esc(n.label)}
            </a>
          </li>
        `).join('')}
      </ul>
      <div class="sc-sidebar-footer" id="sc-user-footer">
        <span id="sc-user-name">&nbsp;</span>
      </div>
    </nav>
    <div class="sc-main-wrap">
      <div class="sc-topbar" role="banner">
        <h1 class="sc-topbar-title" id="sc-view-title">${esc(L.overview)}</h1>
        <div id="sc-topbar-actions"></div>
      </div>
      <main id="console-main" tabindex="-1" aria-label="Main content"></main>
    </div>
  `;

  // Replace body content or append depending on page structure
  const existing = $('#console-main');
  if (existing) return; // already in DOM
  document.body.innerHTML = '';
  document.body.appendChild(shell);
}

/* ─────────────────────────── SVG icons ─────────────────────────────────── */
// Minimal inline SVG icons — no emojis in UI per design rules

const svgIcon = (paths, label = '') =>
  `<svg class="sc-nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false"><title>${esc(label)}</title>${paths}</svg>`;

const homeIcon  = () => svgIcon(`<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v7a1 1 0 001 1h4v-5h2v5h4a1 1 0 001-1v-7h1a1 1 0 00.707-1.707l-7-7z"/>`);
const listIcon  = () => svgIcon(`<path fill-rule="evenodd" d="M3 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clip-rule="evenodd"/>`);
const mapIcon   = () => svgIcon(`<path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>`);
const chartIcon = () => svgIcon(`<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-4a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1V3z"/>`);
const teamIcon  = () => svgIcon(`<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-2a4 4 0 00-8 0v2h8zM4 18v-1a3 3 0 015.07-2.17A5 5 0 004 18zM16 18a5 5 0 00-5.07-4.17A3 3 0 0116 17v1z"/>`);
const gearIcon  = () => svgIcon(`<path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>`);

/* ─────────────────────────── Nav helpers ───────────────────────────────── */

function setActiveNav(hash) {
  $$('[data-nav]').forEach(a => {
    const isCurrent = a.dataset.nav === hash;
    if (isCurrent) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const titleMap = {
    overview: L.overview, reports: L.reports, map: L.map,
    analytics: L.analytics, team: L.team, settings: L.settings,
  };
  const viewTitle = $('#sc-view-title');
  if (viewTitle) viewTitle.textContent = titleMap[hash] || hash;
  document.title = `${titleMap[hash] || hash} — ${L.appTitle}`;
}

/* ─────────────────────────── Lightbox ──────────────────────────────────── */

function openLightbox(src, alt = '') {
  const ov = document.createElement('div');
  ov.className = 'sc-lightbox-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', alt || 'Image');
  ov.innerHTML = `
    <button class="sc-lightbox-close" aria-label="${esc(L.close)}">&times;</button>
    <img src="${esc(src)}" alt="${esc(alt)}" />
  `;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('sc-lightbox-close')) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });
  $('button', ov).focus();
}

/* ════════════════════════════════════════════════════════════════════════
   VIEW: overview
   ════════════════════════════════════════════════════════════════════════ */

async function overview() {
  const main = $('#console-main');
  main.innerHTML = `
    <div class="sc-grid sc-g4" id="sc-kpi-grid">${skeleton(4)}</div>
    <div class="sc-grid sc-g2" style="margin-top:1rem">
      <div class="sc-card">
        <h2 class="sc-card-title">${esc(L.slaCompliance)}</h2>
        <div id="sc-sla-chart">${skeleton(1)}</div>
      </div>
      <div class="sc-card">
        <h2 class="sc-card-title">${esc(L.recentActivity)}</h2>
        <div id="sc-activity-feed">${skeleton(3)}</div>
      </div>
    </div>
    <div class="sc-card">
      <h2 class="sc-card-title">${esc(L.quickActions)}</h2>
      <div id="sc-quick-actions">${skeleton(1)}</div>
    </div>
  `;

  let statsData, activityData, unassignedCritical;

  try {
    [statsData, activityData, unassignedCritical] = await Promise.all([
      api('/staff/stats').catch(() => null),
      api('/staff/activity?limit=10').catch(() => ({ events: [] })),
      api('/staff/reports?priority=Critical&assignedTo=&limit=20').catch(() => ({ reports: [] })),
    ]);
  } catch (e) {
    main.innerHTML = `<div class="sc-alert error" role="alert">${esc(L.error)} ${esc(e.message)}</div>`;
    return;
  }

  // KPI cards
  const s = statsData || {};
  $('#sc-kpi-grid').innerHTML = [
    renderKPI(L.totalOpen,       s.totalOpen      ?? '—', '', 'sc-blue'),
    renderKPI(L.critical,        s.critical        ?? '—', '', 'sc-red'),
    renderKPI(L.overdue,         s.overdue         ?? '—', '', 'sc-orange'),
    renderKPI(L.avgResolution,   s.avgResolutionHours != null ? `${s.avgResolutionHours}${L.hours}` : '—', '', 'sc-green'),
  ].join('');

  // SLA compliance bar chart by priority
  const slaData = s.slaCompliance
    ? Object.entries(s.slaCompliance).map(([k, v]) => ({ label: k, value: Math.round(v) }))
    : [];
  $('#sc-sla-chart').innerHTML = slaData.length
    ? cssBars(slaData, 100, '--sc-blue') + `<p class="sc-muted" style="font-size:.8rem;margin-top:.5rem">% within SLA per priority</p>`
    : `<p class="sc-muted">${esc(L.noData)}</p>`;

  // Recent activity feed
  const events = activityData?.events ?? [];
  $('#sc-activity-feed').innerHTML = events.length
    ? `<ul style="list-style:none;padding:0;margin:0">
        ${events.map(ev => `
          <li style="padding:.5rem 0;border-bottom:1px solid var(--sc-border);font-size:.88rem">
            <span style="font-weight:600">${esc(ev.action || ev.status || '')}</span>
            ${ev.reportId ? ` — <a href="#report/${esc(ev.reportId)}" style="color:var(--sc-blue)">${esc(ev.reportId)}</a>` : ''}
            <span class="sc-muted"> · ${formatRelative(ev.at)}</span>
          </li>
        `).join('')}
      </ul>`
    : `<p class="sc-muted">${esc(L.noData)}</p>`;

  // Quick actions: assign unassigned critical
  const criticalReports = (unassignedCritical?.reports ?? []).filter(r => !r.assignedTo);
  $('#sc-quick-actions').innerHTML = criticalReports.length
    ? `<div class="sc-alert info">
        <strong>${criticalReports.length}</strong> unassigned critical report(s) need attention.
        <a href="#reports?priority=Critical&assignedTo=" class="sc-btn sm alt" style="margin-left:.8rem">${esc(L.assignUnassigned)}</a>
      </div>
      <div class="sc-grid sc-g3">
        ${criticalReports.slice(0, 3).map(r => `
          <div class="sc-card" style="padding:.8rem">
            <div style="font-weight:700;font-size:.92rem;margin-bottom:.3rem">${esc(r.title)}</div>
            <div class="sc-muted" style="font-size:.8rem">${esc(r.id)} · ${esc(r.ward || '—')}</div>
            <div style="margin-top:.5rem">${priorityBadge(r.priority)}</div>
            <a href="#report/${esc(r.id)}" class="sc-btn sm" style="margin-top:.6rem;width:100%;justify-content:center">View</a>
          </div>
        `).join('')}
      </div>`
    : `<p class="sc-muted">No unassigned critical reports.</p>`;
}

/* ════════════════════════════════════════════════════════════════════════
   VIEW: reports (server-side paginated, sortable, filterable, bulk actions)
   ════════════════════════════════════════════════════════════════════════ */

const REPORTS_PAGE_SIZE_OPTIONS = [10, 20, 50];

// Keep filter/sort state across renders within session
let _reportsState = {
  page: 1,
  pageSize: 20,
  sort: 'createdAt',
  sortDir: 'desc',
  filters: {
    status: [],
    priority: [],
    category: '',
    department: '',
    ward: '',
    dateFrom: '',
    dateTo: '',
    overdue: false,
    q: '',
  },
};

async function reports() {
  const main = $('#console-main');

  const STATUSES = ['Received', 'Under Review', 'Assigned', 'In Progress', 'Resolved'];
  const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

  // Load saved views from localStorage
  let savedViews = JSON.parse(localStorage.getItem('sc_saved_views') || '{}');

  function buildQueryParams() {
    const f = _reportsState.filters;
    const p = new URLSearchParams();
    p.set('page', _reportsState.page);
    p.set('pageSize', _reportsState.pageSize);
    p.set('sort', _reportsState.sort);
    p.set('sortDir', _reportsState.sortDir);
    if (f.status.length) p.set('status', f.status.join(','));
    if (f.priority.length) p.set('priority', f.priority.join(','));
    if (f.category) p.set('category', f.category);
    if (f.department) p.set('department', f.department);
    if (f.ward) p.set('ward', f.ward);
    if (f.dateFrom) p.set('dateFrom', f.dateFrom);
    if (f.dateTo) p.set('dateTo', f.dateTo);
    if (f.overdue) p.set('overdue', '1');
    if (f.q) p.set('q', f.q);
    return p.toString();
  }

  function renderSavedViewPills() {
    const keys = Object.keys(savedViews);
    if (!keys.length) return '';
    return `<div class="sc-saved-views" aria-label="Saved views">
      ${keys.map(k => `<button class="sc-saved-view-btn" data-load-view="${esc(k)}">${esc(k)}</button>`).join('')}
    </div>`;
  }

  function renderFilterPanel() {
    const f = _reportsState.filters;
    return `
      <div class="sc-filter-panel" id="sc-filter-panel" role="search" aria-label="${esc(L.filters)}">
        <div class="sc-input-wrap" style="grid-column:1/-1">
          <label for="sc-q">${esc(L.id)} / Keyword</label>
          <input id="sc-q" class="sc-input" type="search" value="${esc(f.q)}" placeholder="Search ID or keyword" aria-label="Search">
        </div>
        <div>
          <label>${esc(L.status)}</label>
          <div class="sc-checkbox-group">
            ${STATUSES.map(s => `
              <label>
                <input type="checkbox" value="${esc(s)}" ${f.status.includes(s) ? 'checked' : ''} data-filter-status>
                <span>${esc(s)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div>
          <label>${esc(L.priority)}</label>
          <div class="sc-checkbox-group">
            ${PRIORITIES.map(p => `
              <label>
                <input type="checkbox" value="${esc(p)}" ${f.priority.includes(p) ? 'checked' : ''} data-filter-priority>
                <span>${esc(p)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="sc-input-wrap">
          <label for="sc-f-cat">${esc(L.category)}</label>
          <input id="sc-f-cat" class="sc-input" value="${esc(f.category)}" placeholder="e.g. Roads">
        </div>
        <div class="sc-input-wrap">
          <label for="sc-f-dept">${esc(L.department)}</label>
          <input id="sc-f-dept" class="sc-input" value="${esc(f.department)}" placeholder="Department name">
        </div>
        <div class="sc-input-wrap">
          <label for="sc-f-ward">${esc(L.ward)}</label>
          <input id="sc-f-ward" class="sc-input" value="${esc(f.ward)}" placeholder="Ward number">
        </div>
        <div class="sc-input-wrap">
          <label for="sc-f-from">Date From</label>
          <input id="sc-f-from" class="sc-input" type="date" value="${esc(f.dateFrom)}">
        </div>
        <div class="sc-input-wrap">
          <label for="sc-f-to">Date To</label>
          <input id="sc-f-to" class="sc-input" type="date" value="${esc(f.dateTo)}">
        </div>
        <div class="sc-input-wrap" style="display:flex;align-items:center;gap:.5rem;margin-top:1rem">
          <input type="checkbox" id="sc-f-overdue" ${f.overdue ? 'checked' : ''} style="width:auto;min-height:0">
          <label for="sc-f-overdue" style="margin:0;font-weight:400">Overdue only</label>
        </div>
        <div class="sc-btn-row">
          <button class="sc-btn" id="sc-apply-filters">${esc(L.applyFilters)}</button>
          <button class="sc-btn alt" id="sc-clear-filters">${esc(L.clearFilters)}</button>
          <button class="sc-btn alt sm" id="sc-save-view">${esc(L.saveView)}</button>
        </div>
      </div>
    `;
  }

  function renderTable(data) {
    const rpts = data.reports || [];
    const total = data.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / _reportsState.pageSize));

    const sortBtn = (col, label) => {
      const isActive = _reportsState.sort === col;
      const dir = isActive ? _reportsState.sortDir : 'asc';
      const arrow = isActive ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<button class="sort-btn" data-sort="${esc(col)}" aria-label="${esc(L.sortAsc)}: ${esc(label)}">${esc(label)}${arrow}</button>`;
    };

    const cols = [
      { key: 'id',         label: L.id },
      { key: 'title',      label: L.title },
      { key: 'status',     label: L.status },
      { key: 'priority',   label: L.priority },
      { key: 'category',   label: L.category },
      { key: 'department', label: L.department },
      { key: 'ward',       label: L.ward },
      { key: 'createdAt',  label: L.submittedAt },
      { key: 'dueAt',      label: L.dueAt },
      { key: 'assignedTo', label: L.assignedTo },
    ];

    return `
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem;flex-wrap:wrap">
        <span class="sc-muted" style="flex:1">${total} report${total !== 1 ? 's' : ''}</span>
        <button class="sc-btn sm alt" id="sc-bulk-assign" disabled>${esc(L.bulkAssign)}</button>
        <button class="sc-btn sm alt" id="sc-bulk-status" disabled>${esc(L.bulkStatus)}</button>
        <a class="sc-btn sm" href="/api/staff/export?${esc(buildQueryParams())}"
           download="reports.csv" aria-label="${esc(L.exportCSV)}">${esc(L.exportCSV)}</a>
      </div>
      <div class="sc-table-wrap">
        <table class="sc-table" aria-label="Reports">
          <caption class="sr-only">Reports list, ${total} total</caption>
          <thead>
            <tr>
              <th><input type="checkbox" id="sc-select-all" aria-label="${esc(L.selectAll)}"></th>
              ${cols.map(c => `<th>${sortBtn(c.key, c.label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rpts.length ? rpts.map(r => `
              <tr data-id="${esc(r.id)}" style="cursor:pointer" role="row">
                <td><input type="checkbox" class="sc-row-check" value="${esc(r.id)}" aria-label="Select ${esc(r.id)}"></td>
                <td><code style="font-size:.8rem">${esc(r.id)}</code></td>
                <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.title)}">${esc(r.title)}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${priorityBadge(r.priority)}</td>
                <td>${esc(r.category || '—')}</td>
                <td>${esc(r.department || '—')}</td>
                <td>${esc(r.ward || '—')}</td>
                <td><time datetime="${esc(r.createdAt)}">${formatRelative(r.createdAt)}</time></td>
                <td><time datetime="${esc(r.dueAt)}">${r.dueAt ? formatDate(r.dueAt) : '—'}</time></td>
                <td>${esc(r.assignedTo || L.unassigned)}</td>
              </tr>
            `).join('') : `<tr><td colspan="11" style="text-align:center;padding:2rem" class="sc-muted">${esc(L.noReports)}</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="sc-pagination" aria-label="Pagination">
        <button class="sc-btn sm alt" id="sc-prev-page" ${_reportsState.page <= 1 ? 'disabled' : ''}>${esc(L.previous)}</button>
        <span>${esc(L.page)} <strong>${_reportsState.page}</strong> ${esc(L.of)} ${totalPages}</span>
        <button class="sc-btn sm alt" id="sc-next-page" ${_reportsState.page >= totalPages ? 'disabled' : ''}>${esc(L.next)}</button>
        <label for="sc-page-size" class="sr-only">${esc(L.perPage)}</label>
        <select id="sc-page-size" class="sc-input sc-select" style="width:auto;min-height:36px" aria-label="${esc(L.perPage)}">
          ${REPORTS_PAGE_SIZE_OPTIONS.map(n => `<option value="${n}" ${_reportsState.pageSize === n ? 'selected' : ''}>${n} / page</option>`).join('')}
        </select>
      </div>
    `;
  }

  async function loadAndRender() {
    const tableArea = $('#sc-reports-table');
    if (!tableArea) return;
    tableArea.innerHTML = skeleton(5);
    showLoading();
    try {
      const data = await api('/staff/reports?' + buildQueryParams());
      tableArea.innerHTML = renderTable(data);
      bindTableEvents(tableArea);
    } catch (e) {
      tableArea.innerHTML = `<div class="sc-alert error" role="alert">${esc(L.error)} ${esc(e.message)}
        <button class="sc-btn sm alt" id="sc-retry-reports" style="margin-left:.5rem">${esc(L.retry)}</button>
      </div>`;
      $('#sc-retry-reports')?.addEventListener('click', loadAndRender);
    } finally {
      hideLoading();
    }
  }

  function bindTableEvents(tableArea) {
    // Row click → detail
    $$('tbody tr[data-id]', tableArea).forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.type === 'checkbox') return;
        window.location.hash = '#report/' + row.dataset.id;
      });
    });

    // Sort
    $$('.sort-btn', tableArea).forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.dataset.sort;
        if (_reportsState.sort === col) {
          _reportsState.sortDir = _reportsState.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _reportsState.sort = col;
          _reportsState.sortDir = 'asc';
        }
        _reportsState.page = 1;
        loadAndRender();
      });
    });

    // Pagination
    $('#sc-prev-page', tableArea)?.addEventListener('click', () => { _reportsState.page--; loadAndRender(); });
    $('#sc-next-page', tableArea)?.addEventListener('click', () => { _reportsState.page++; loadAndRender(); });
    $('#sc-page-size', tableArea)?.addEventListener('change', e => {
      _reportsState.pageSize = Number(e.target.value);
      _reportsState.page = 1;
      loadAndRender();
    });

    // Select all / bulk
    const selectAll = $('#sc-select-all', tableArea);
    const checks = () => $$('.sc-row-check:checked', tableArea);
    const updateBulkBtns = () => {
      const n = checks().length;
      $('#sc-bulk-assign', tableArea).disabled = n === 0;
      $('#sc-bulk-status', tableArea).disabled = n === 0;
    };
    selectAll?.addEventListener('change', e => {
      $$('.sc-row-check', tableArea).forEach(c => { c.checked = e.target.checked; });
      updateBulkBtns();
    });
    $$('.sc-row-check', tableArea).forEach(c => c.addEventListener('change', updateBulkBtns));

    // Bulk assign
    $('#sc-bulk-assign', tableArea)?.addEventListener('click', async () => {
      const ids = checks().map(c => c.value);
      const officer = prompt('Officer email/ID to assign these reports to:');
      if (!officer) return;
      try {
        await api('/staff/reports/bulk-assign', {
          method: 'POST',
          body: JSON.stringify({ ids, officer }),
        });
        toast(`Assigned ${ids.length} report(s) to ${officer}`, 'success');
        loadAndRender();
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    // Bulk status change
    $('#sc-bulk-status', tableArea)?.addEventListener('click', async () => {
      const ids = checks().map(c => c.value);
      const statuses = ['Received', 'Under Review', 'Assigned', 'In Progress', 'Resolved'];
      const newStatus = prompt(`New status for ${ids.length} reports:\n${statuses.join(', ')}`);
      if (!newStatus || !statuses.includes(newStatus)) { toast('Invalid status', 'error'); return; }
      try {
        await api('/staff/reports/bulk-status', {
          method: 'POST',
          body: JSON.stringify({ ids, status: newStatus }),
        });
        toast(`Updated ${ids.length} report(s)`, 'success');
        loadAndRender();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  }

  // Initial render
  main.innerHTML = `
    ${renderSavedViewPills()}
    ${renderFilterPanel()}
    <div id="sc-reports-table">${skeleton(5)}</div>
  `;

  // Filter panel events
  function readFilters() {
    _reportsState.filters = {
      status: $$('[data-filter-status]:checked').map(c => c.value),
      priority: $$('[data-filter-priority]:checked').map(c => c.value),
      category: $('#sc-f-cat')?.value || '',
      department: $('#sc-f-dept')?.value || '',
      ward: $('#sc-f-ward')?.value || '',
      dateFrom: $('#sc-f-from')?.value || '',
      dateTo: $('#sc-f-to')?.value || '',
      overdue: $('#sc-f-overdue')?.checked || false,
      q: $('#sc-q')?.value || '',
    };
    _reportsState.page = 1;
  }

  $('#sc-apply-filters')?.addEventListener('click', () => { readFilters(); loadAndRender(); });
  $('#sc-clear-filters')?.addEventListener('click', () => {
    _reportsState.filters = { status: [], priority: [], category: '', department: '', ward: '', dateFrom: '', dateTo: '', overdue: false, q: '' };
    reports(); // re-render entire view to reset UI
  });
  $('#sc-save-view')?.addEventListener('click', () => {
    const name = prompt('Name for this saved view:');
    if (!name) return;
    readFilters();
    savedViews[name] = { ..._reportsState };
    localStorage.setItem('sc_saved_views', JSON.stringify(savedViews));
    toast(`View "${name}" saved`, 'success');
    reports();
  });

  // Saved view pills
  $$('[data-load-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sv = savedViews[btn.dataset.loadView];
      if (sv) { Object.assign(_reportsState, sv); reports(); }
    });
  });

  // Search on Enter
  $('#sc-q')?.addEventListener('keydown', e => { if (e.key === 'Enter') { readFilters(); loadAndRender(); } });

  loadAndRender();
}

/* ════════════════════════════════════════════════════════════════════════
   VIEW: reportDetail(id)
   ════════════════════════════════════════════════════════════════════════ */

async function reportDetail(id) {
  const main = $('#console-main');
  main.innerHTML = `
    <div style="margin-bottom:1rem">
      <button class="sc-btn alt sm" id="sc-back-btn">${esc(L.back)}</button>
    </div>
    <div id="sc-detail-loading">${skeleton(4)}</div>
  `;

  $('#sc-back-btn')?.addEventListener('click', () => history.back());

  let report;
  showLoading();
  try {
    report = await api('/staff/reports/' + encodeURIComponent(id));
  } catch (e) {
    main.innerHTML = `<div class="sc-alert error" role="alert">${esc(e.message)}</div>
      <button class="sc-btn alt sm" id="sc-back-btn2">${esc(L.back)}</button>`;
    $('#sc-back-btn2')?.addEventListener('click', () => history.back());
    hideLoading();
    return;
  }
  hideLoading();

  const ai = report.analysis || {};
  const imgs = report.imagePaths || report.images || [];
  const hasLocation = report.lat != null && report.lng != null;
  const timeline = report.auditLog || report.timeline || [];

  main.innerHTML = `
    <div style="margin-bottom:1rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
      <button class="sc-btn alt sm" id="sc-back-btn">${esc(L.back)}</button>
      <h2 style="margin:0;font-size:1.1rem;flex:1" id="sc-detail-title">${esc(report.title)}</h2>
      ${priorityBadge(report.priority)} ${statusBadge(report.status)}
    </div>
    <div class="sc-detail-grid">
      <!-- Left column -->
      <div>
        <!-- Original text + translation toggle -->
        <div class="sc-card">
          <h3 class="sc-card-title">${esc(L.originalText)}</h3>
          <p id="sc-original-text">${esc(report.description || report.text || '')}</p>
          ${report.englishTranslation ? `
            <button class="sc-btn alt sm" id="sc-toggle-translation">${esc(L.showTranslation)}</button>
            <p id="sc-translation" hidden style="margin-top:.6rem;border-top:1px solid var(--sc-border);padding-top:.6rem">
              ${esc(report.englishTranslation)}
            </p>
          ` : ''}
        </div>

        <!-- Image gallery -->
        <div class="sc-card">
          <h3 class="sc-card-title">${esc(L.imageGallery)}</h3>
          ${imgs.length
            ? `<div class="sc-gallery" role="list" aria-label="${esc(L.imageGallery)}">
                ${imgs.map((src, i) => `
                  <img src="${esc(src)}" alt="Report image ${i + 1}" role="listitem"
                       tabindex="0" style="cursor:zoom-in"
                       data-lightbox="${esc(src)}" data-alt="Report image ${i + 1}">
                `).join('')}
              </div>`
            : `<p class="sc-muted">${esc(L.noImages)}</p>`}
        </div>

        <!-- Location map -->
        <div class="sc-card">
          <h3 class="sc-card-title">${esc(L.locationMap)}</h3>
          ${hasLocation
            ? `<div class="sc-map-wrap">
                <iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade"
                  title="Location map for ${esc(report.title)}"
                  src="https://maps.google.com/maps?q=${+report.lat},${+report.lng}&z=16&output=embed"
                  aria-label="${esc(L.locationMap)}">
                </iframe>
               </div>`
            : `<p class="sc-muted">${esc(L.noLocation)}</p>`}
        </div>
      </div>

      <!-- Right column: Analysis + controls -->
      <div>
        <!-- Analysis panel -->
        <div class="sc-card" id="sc-analysis-panel">
          <h3 class="sc-card-title">${esc(L.analysis)}</h3>
          ${[
            [L.analysisCategory,   ai.category    || '—'],
            [L.analysisPriority,   ai.priority    || '—'],
            [L.analysisImpact,     ai.publicImpactScore != null ? `${ai.publicImpactScore}/10` : '—'],
            [L.analysisConfidence, ai.confidence  != null ? `${Math.round(ai.confidence * 100)}%` : '—'],
            [L.analysisRecommended,ai.suggestedAction || '—'],
            [L.analysisNotes,      ai.reasoning   || '—'],
          ].map(([k, v]) => `
            <div class="sc-analysis-row">
              <span class="sc-analysis-key">${esc(k)}</span>
              <span class="sc-analysis-val">${esc(v)}</span>
            </div>
          `).join('')}
          ${ai.perImageFindings?.length ? `
            <div style="margin-top:.6rem">
              <strong style="font-size:.85rem">${esc(L.analysisImageFindings)}</strong>
              <ul style="font-size:.85rem;padding-left:1.2rem;margin:.35rem 0">
                ${ai.perImageFindings.map(f => `<li>${esc(f)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${report.duplicates?.length ? `
            <div style="margin-top:.6rem">
              <strong style="font-size:.85rem">${esc(L.duplicateLinks)}</strong>
              <ul style="font-size:.85rem;padding-left:1.2rem;margin:.35rem 0">
                ${report.duplicates.map(d => `<li><a href="#report/${esc(d.id)}" style="color:var(--sc-blue)">${esc(d.id)}</a> — ${esc(d.title)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Override controls -->
        <div class="sc-card">
          <h3 class="sc-card-title">Override</h3>
          <form id="sc-override-form" novalidate>
            <div class="sc-input-wrap">
              <label for="sc-ov-category">${esc(L.overrideCategory)}</label>
              <input id="sc-ov-category" class="sc-input" value="${esc(ai.category || report.category || '')}" placeholder="Category">
            </div>
            <div class="sc-input-wrap">
              <label for="sc-ov-priority">${esc(L.overridePriority)}</label>
              <select id="sc-ov-priority" class="sc-input sc-select">
                ${['Critical','High','Medium','Low'].map(p =>
                  `<option value="${esc(p)}" ${(report.priority === p) ? 'selected' : ''}>${esc(p)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="sc-input-wrap">
              <label for="sc-ov-reason">${esc(L.overrideReason)} <span aria-hidden="true" style="color:var(--sc-red)">*</span></label>
              <textarea id="sc-ov-reason" class="sc-input sc-textarea" required aria-required="true"
                placeholder="Why are you overriding the analysis result?"></textarea>
            </div>
            <button type="submit" class="sc-btn sm">${esc(L.applyOverride)}</button>
            <span id="sc-override-err" role="alert" style="color:var(--sc-red);font-size:.85rem;margin-left:.5rem"></span>
          </form>
        </div>

        <!-- Status change -->
        <div class="sc-card">
          <h3 class="sc-card-title">${esc(L.changeStatus)}</h3>
          <form id="sc-status-form" novalidate>
            <div class="sc-input-wrap">
              <label for="sc-new-status">${esc(L.status)}</label>
              <select id="sc-new-status" class="sc-input sc-select">
                ${['Received','Under Review','Assigned','In Progress','Resolved'].map(s =>
                  `<option value="${esc(s)}" ${report.status === s ? 'selected' : ''}>${esc(s)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="sc-input-wrap">
              <label for="sc-internal-note">${esc(L.internalNote)}</label>
              <textarea id="sc-internal-note" class="sc-input sc-textarea" placeholder="Visible to staff only"></textarea>
            </div>
            <div class="sc-input-wrap">
              <label for="sc-public-note">${esc(L.publicNote)}</label>
              <textarea id="sc-public-note" class="sc-input sc-textarea" placeholder="Visible to citizen"></textarea>
            </div>
            <button type="submit" class="sc-btn sm">${esc(L.updateStatus)}</button>
          </form>
        </div>

        <!-- Assign officer -->
        <div class="sc-card">
          <h3 class="sc-card-title">${esc(L.assignTo)}</h3>
          <form id="sc-assign-form" novalidate>
            <div class="sc-input-wrap">
              <label for="sc-officer-select">${esc(L.assignOfficer)}</label>
              <select id="sc-officer-select" class="sc-input sc-select">
                <option value="">${esc(L.unassigned)}</option>
              </select>
            </div>
            <button type="submit" class="sc-btn sm">${esc(L.assignOfficer)}</button>
          </form>
        </div>

        <!-- Audit timeline -->
        <div class="sc-card">
          <h3 class="sc-card-title">${esc(L.auditTimeline)}</h3>
          <div id="sc-timeline-wrap">${renderTimeline(timeline)}</div>
        </div>
      </div>
    </div>
  `;

  // Translation toggle
  $('#sc-toggle-translation')?.addEventListener('click', function () {
    const trans = $('#sc-translation');
    if (!trans) return;
    const hidden = trans.hidden;
    trans.hidden = !hidden;
    this.textContent = hidden ? L.hideTranslation : L.showTranslation;
  });

  // Image lightbox — click and keyboard
  $$('[data-lightbox]', main).forEach(img => {
    img.addEventListener('click', () => openLightbox(img.dataset.lightbox, img.dataset.alt));
    img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(img.dataset.lightbox, img.dataset.alt); });
  });

  // Back button
  $('#sc-back-btn')?.addEventListener('click', () => history.back());

  // Load officer list for assignment
  api('/staff/officers').then(data => {
    const sel = $('#sc-officer-select');
    if (!sel || !data?.officers) return;
    data.officers.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.uid || o.email;
      opt.textContent = `${o.name} (${o.department || '—'})`;
      if (report.assignedTo === opt.value) opt.selected = true;
      sel.appendChild(opt);
    });
  }).catch(() => {});

  // Override form
  $('#sc-override-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const reason = $('#sc-ov-reason').value.trim();
    if (!reason) { $('#sc-override-err').textContent = L.overrideReason + ' is required.'; return; }
    $('#sc-override-err').textContent = '';
    try {
      await api('/staff/reports/' + encodeURIComponent(id) + '/override', {
        method: 'POST',
        body: JSON.stringify({
          category: $('#sc-ov-category').value,
          priority: $('#sc-ov-priority').value,
          reason,
        }),
      });
      toast(L.successSaved, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Status form
  $('#sc-status-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/staff/reports/' + encodeURIComponent(id) + '/status', {
        method: 'POST',
        body: JSON.stringify({
          status: $('#sc-new-status').value,
          internalNote: $('#sc-internal-note').value,
          publicNote: $('#sc-public-note').value,
        }),
      });
      toast(L.successSaved, 'success');
      // Refresh timeline
      api('/staff/reports/' + encodeURIComponent(id) + '/audit').then(d => {
        const wrap = $('#sc-timeline-wrap');
        if (wrap) wrap.innerHTML = renderTimeline(d?.events || []);
      }).catch(() => {});
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Assign form
  $('#sc-assign-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/staff/reports/' + encodeURIComponent(id) + '/assign', {
        method: 'POST',
        body: JSON.stringify({ officer: $('#sc-officer-select').value }),
      });
      toast(L.successSaved, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════
   VIEW: map — Google Maps with priority-colored markers + clustering
   ════════════════════════════════════════════════════════════════════════ */

let _mapInstance = null;

async function mapView() {
  const main = $('#console-main');
  main.innerHTML = `
    <div class="sc-map-console-wrap" style="height:70vh">
      <div id="sc-gmap" class="sc-map-console-map" aria-label="${esc(L.mapView)}"></div>
      <div class="sc-map-sidebar sc-card" style="padding:.8rem">
        <p class="sc-muted" id="sc-map-hint">${esc(L.clickMarker)}</p>
        <div id="sc-map-detail"></div>
      </div>
    </div>
  `;

  // Load reports for map
  let mapReports = [];
  showLoading();
  try {
    const data = await api('/staff/reports?pageSize=500&sort=priority&fields=id,title,priority,lat,lng,status,category,ward');
    mapReports = data.reports || [];
  } catch (e) {
    toast(L.error + ' ' + e.message, 'error');
  } finally { hideLoading(); }

  // Load Google Maps + MarkerClusterer from CDN
  await loadGoogleMaps();

  if (!window.google?.maps) {
    $('#sc-gmap').innerHTML = `<div class="sc-alert error">${esc(L.error)} Google Maps could not load.</div>`;
    return;
  }

  const map = new google.maps.Map($('#sc-gmap'), {
    zoom: 12,
    center: { lat: 13.0827, lng: 80.2707 }, // Chennai default; will fit bounds
    mapTypeControl: false,
    streetViewControl: false,
  });
  _mapInstance = map;

  const PRIORITY_MAP_COLORS = {
    Critical: '#b91c1c', High: '#b45309', Medium: '#1D4ED8', Low: '#047857',
  };

  const markers = mapReports
    .filter(r => r.lat != null && r.lng != null)
    .map(r => {
      const color = PRIORITY_MAP_COLORS[r.priority] || '#5b6078';
      const marker = new google.maps.Marker({
        position: { lat: +r.lat, lng: +r.lng },
        title: r.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      marker.addListener('click', () => {
        const detail = $('#sc-map-detail');
        const hint = $('#sc-map-hint');
        if (hint) hint.hidden = true;
        if (detail) {
          detail.innerHTML = `
            <div style="margin-bottom:.5rem">${priorityBadge(r.priority)} ${statusBadge(r.status)}</div>
            <div style="font-weight:700;margin-bottom:.3rem">${esc(r.title)}</div>
            <div class="sc-muted" style="font-size:.82rem">${esc(r.id)} · ${esc(r.category || '—')} · Ward ${esc(r.ward || '—')}</div>
            <a href="#report/${esc(r.id)}" class="sc-btn sm" style="margin-top:.6rem;display:inline-flex">View Detail</a>
          `;
        }
      });
      return marker;
    });

  // Fit map bounds to markers
  if (markers.length) {
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(m => bounds.extend(m.getPosition()));
    map.fitBounds(bounds);
  }

  // MarkerClusterer from CDN
  if (window.markerClusterer?.MarkerClusterer) {
    new markerClusterer.MarkerClusterer({ map, markers });
  } else {
    markers.forEach(m => m.setMap(map));
  }
}

/** Lazy-load Google Maps JS API */
async function loadGoogleMaps() {
  if (window.google?.maps) return;
  // Fetch API key from server config
  let apiKey = '';
  try {
    const cfg = await api('/config');
    apiKey = cfg.googleMapsApiKey || '';
  } catch {}

  await new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });

  // MarkerClusterer
  if (!window.markerClusterer) {
    await new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
      s.async = true;
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    });
  }
}

/* ════════════════════════════════════════════════════════════════════════
   VIEW: analytics
   ════════════════════════════════════════════════════════════════════════ */

async function analytics() {
  const main = $('#console-main');
  main.innerHTML = `
    <div class="sc-grid sc-g4" id="sc-analytics-kpi">${skeleton(4)}</div>
    <div class="sc-grid sc-g3" id="sc-analytics-charts" style="margin-top:1rem">${skeleton(3)}</div>
    <div class="sc-card" style="margin-top:1rem">
      <h3 class="sc-card-title">${esc(L.trend30d)}</h3>
      <div id="sc-sparkline-wrap">${skeleton(1)}</div>
    </div>
  `;

  showLoading();
  let data;
  try {
    data = await api('/staff/analytics');
  } catch (e) {
    main.innerHTML = `<div class="sc-alert error">${esc(L.error)} ${esc(e.message)}</div>`;
    hideLoading();
    return;
  }
  hideLoading();

  const d = data || {};

  // KPIs
  const resRate = d.totalReports > 0 ? Math.round(d.resolved / d.totalReports * 100) : 0;
  $('#sc-analytics-kpi').innerHTML = [
    renderKPI(L.resolutionRate,   resRate + '%',                             '', 'sc-green'),
    renderKPI(L.avgResolutionTime, d.avgResolutionHours != null ? d.avgResolutionHours + L.hours : '—', '', 'sc-blue'),
    renderKPI(L.slaComplianceRate, d.slaCompliance != null ? Math.round(d.slaCompliance) + '%' : '—',  '', 'sc-blue'),
    renderKPI(L.overrideRate,      d.overrideRate  != null ? Math.round(d.overrideRate)  + '%' : '—',  '', 'sc-orange'),
  ].join('');

  // Department, Ward, Category bar charts
  const deptData = objToBarData(d.byDepartment);
  const wardData = objToBarData(d.byWard);
  const catData  = objToBarData(d.byCategory);

  $('#sc-analytics-charts').innerHTML = `
    <div class="sc-card">
      <h3 class="sc-card-title">${esc(L.byDepartment)}</h3>
      ${cssBars(deptData, 0, '--sc-blue')}
    </div>
    <div class="sc-card">
      <h3 class="sc-card-title">${esc(L.byWard)}</h3>
      ${cssBars(wardData, 0, '--sc-purple')}
    </div>
    <div class="sc-card">
      <h3 class="sc-card-title">${esc(L.byCategory)}</h3>
      ${cssBars(catData, 0, '--sc-green')}
    </div>
  `;

  // 30-day trend sparkline (SVG or CSS bars)
  const trend = d.trend30d || [];
  const trendMax = Math.max(1, ...trend.map(t => t.count || 0));
  $('#sc-sparkline-wrap').innerHTML = trend.length
    ? `<div class="sc-sparkline" aria-label="30-day report trend" role="img">
        ${trend.map(t => `
          <div class="sc-spark-bar"
               style="height:${Math.round((t.count || 0) / trendMax * 100)}%"
               title="${esc(t.date)}: ${t.count} report(s)">
          </div>
        `).join('')}
      </div>
      <div class="sc-muted" style="font-size:.8rem;margin-top:.4rem;display:flex;justify-content:space-between">
        <span>${trend[0]?.date || ''}</span><span>${trend[trend.length - 1]?.date || ''}</span>
      </div>`
    : `<p class="sc-muted">${esc(L.noData)}</p>`;
}

function objToBarData(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k, value: v }));
}

/* ════════════════════════════════════════════════════════════════════════
   VIEW: team (admin only)
   ════════════════════════════════════════════════════════════════════════ */

async function team() {
  const main = $('#console-main');

  if (!isAdmin()) {
    main.innerHTML = `<div class="sc-alert error" role="alert">${esc(L.adminOnly)}</div>`;
    return;
  }

  main.innerHTML = `
    <div class="sc-card">
      <h2 class="sc-card-title">${esc(L.teamManagement)}</h2>
      <div class="sc-team-invite">
        <div class="sc-input-wrap" style="flex:1;margin-bottom:0">
          <label for="sc-invite-email">${esc(L.inviteByEmail)}</label>
          <input id="sc-invite-email" class="sc-input" type="email" placeholder="officer@municipality.gov.in" autocomplete="off">
        </div>
        <div class="sc-input-wrap" style="max-width:160px;margin-bottom:0">
          <label for="sc-invite-role">Role</label>
          <select id="sc-invite-role" class="sc-input sc-select">
            <option value="officer">Officer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button class="sc-btn" id="sc-invite-btn" style="margin-top:1.5rem;flex-shrink:0">${esc(L.invite)}</button>
      </div>
      <span id="sc-invite-msg" role="alert" style="font-size:.85rem;color:var(--sc-green)"></span>
    </div>
    <div class="sc-card">
      <div id="sc-team-table">${skeleton(4)}</div>
    </div>
  `;

  async function loadTeam() {
    showLoading();
    try {
      const data = await api('/staff/team');
      const members = data?.members || [];
      $('#sc-team-table').innerHTML = `
        <div class="sc-table-wrap">
          <table class="sc-table" aria-label="Team members">
            <caption class="sr-only">Staff team members</caption>
            <thead>
              <tr>
                <th>${esc(L.name)}</th>
                <th>${esc(L.email)}</th>
                <th>${esc(L.role)}</th>
                <th>${esc(L.department)}</th>
                <th>${esc(L.ticketCount)}</th>
                <th>${esc(L.actions)}</th>
              </tr>
            </thead>
            <tbody>
              ${members.length ? members.map(m => `
                <tr data-uid="${esc(m.uid)}">
                  <td>${esc(m.name || '—')}</td>
                  <td>${esc(m.email)}</td>
                  <td>
                    <select class="sc-input sc-select sc-edit-role" data-uid="${esc(m.uid)}" style="min-height:36px;padding:.3rem .5rem;width:auto">
                      <option value="officer" ${m.role === 'officer' ? 'selected' : ''}>Officer</option>
                      <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                  </td>
                  <td>
                    <input class="sc-input sc-edit-dept" data-uid="${esc(m.uid)}" value="${esc(m.department || '')}"
                           style="min-height:36px;padding:.3rem .5rem" placeholder="Department">
                  </td>
                  <td>${m.ticketCount ?? 0}</td>
                  <td style="display:flex;gap:.4rem;flex-wrap:wrap">
                    <button class="sc-btn sm" data-save-member="${esc(m.uid)}">${esc(L.save)}</button>
                    <button class="sc-btn sm danger" data-deactivate="${esc(m.uid)}">${esc(L.deactivate)}</button>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="6" style="text-align:center;padding:2rem" class="sc-muted">${esc(L.noData)}</td></tr>`}
            </tbody>
          </table>
        </div>
      `;

      // Save member
      $$('[data-save-member]', main).forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.dataset.saveMember;
          const role = $(`[data-uid="${uid}"].sc-edit-role`).value;
          const dept = $(`[data-uid="${uid}"].sc-edit-dept`).value;
          try {
            await api('/staff/team/' + encodeURIComponent(uid), {
              method: 'PATCH',
              body: JSON.stringify({ role, department: dept }),
            });
            toast(L.successSaved, 'success');
          } catch (e) { toast(e.message, 'error'); }
        });
      });

      // Deactivate
      $$('[data-deactivate]', main).forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(L.confirmDeactivate)) return;
          const uid = btn.dataset.deactivate;
          try {
            await api('/staff/team/' + encodeURIComponent(uid) + '/deactivate', { method: 'POST' });
            toast('Account deactivated', 'success');
            loadTeam();
          } catch (e) { toast(e.message, 'error'); }
        });
      });
    } catch (e) {
      $('#sc-team-table').innerHTML = `<div class="sc-alert error">${esc(e.message)}</div>`;
    } finally { hideLoading(); }
  }

  // Invite
  $('#sc-invite-btn')?.addEventListener('click', async () => {
    const email = $('#sc-invite-email').value.trim();
    const role  = $('#sc-invite-role').value;
    if (!email) { toast('Email required', 'error'); return; }
    try {
      await api('/staff/team/invite', { method: 'POST', body: JSON.stringify({ email, role }) });
      $('#sc-invite-msg').textContent = L.inviteSent;
      $('#sc-invite-email').value = '';
      setTimeout(() => { const m = $('#sc-invite-msg'); if (m) m.textContent = ''; }, 3000);
      loadTeam();
    } catch (e) { toast(e.message, 'error'); }
  });

  loadTeam();
}

/* ════════════════════════════════════════════════════════════════════════
   VIEW: settings (admin only)
   ════════════════════════════════════════════════════════════════════════ */

async function settings() {
  const main = $('#console-main');

  if (!isAdmin()) {
    main.innerHTML = `<div class="sc-alert error" role="alert">${esc(L.adminOnly)}</div>`;
    return;
  }

  main.innerHTML = `<div>${skeleton(4)}</div>`;

  showLoading();
  let cfg;
  try {
    cfg = await api('/staff/settings');
  } catch (e) {
    main.innerHTML = `<div class="sc-alert error">${esc(e.message)}</div>`;
    hideLoading();
    return;
  }
  hideLoading();

  const sla = cfg?.slaHours || { Critical: 4, High: 24, Medium: 72, Low: 168 };
  const departments = cfg?.departments || [];
  const catMapping = cfg?.categoryMapping || {};

  main.innerHTML = `
    <!-- SLA targets -->
    <div class="sc-card">
      <h2 class="sc-card-title">${esc(L.slaTargets)}</h2>
      <form id="sc-sla-form" novalidate>
        <div class="sc-grid sc-g4">
          ${['Critical','High','Medium','Low'].map(p => `
            <div class="sc-input-wrap">
              <label for="sc-sla-${p}">${esc(p)}</label>
              <input id="sc-sla-${p}" class="sc-input" type="number" min="1" step="1"
                     value="${sla[p] || ''}" data-sla-priority="${esc(p)}"
                     aria-label="SLA for ${esc(p)} priority in hours">
            </div>
          `).join('')}
        </div>
        <button type="submit" class="sc-btn sm">${esc(L.saveSLA)}</button>
      </form>
    </div>

    <!-- Departments -->
    <div class="sc-card">
      <h2 class="sc-card-title">${esc(L.departments)}</h2>
      <div id="sc-dept-list" style="margin-bottom:.8rem">
        ${departments.map((d, i) => `
          <div class="sc-row" style="margin-bottom:.4rem" data-dept-index="${i}">
            <input class="sc-input sc-dept-input" value="${esc(d)}" aria-label="Department ${i + 1}" style="max-width:300px">
            <button class="sc-btn sm danger sc-flex-none" data-remove-dept="${i}"
                    aria-label="Remove ${esc(d)}" style="flex:0 0 auto">Remove</button>
          </div>
        `).join('')}
      </div>
      <div class="sc-row" style="max-width:420px">
        <input id="sc-new-dept" class="sc-input" placeholder="New department name" aria-label="New department name">
        <button class="sc-btn sm sc-flex-none" id="sc-add-dept">${esc(L.addDepartment)}</button>
      </div>
      <button class="sc-btn sm" id="sc-save-depts" style="margin-top:.8rem">${esc(L.save)} Departments</button>
    </div>

    <!-- Category-to-department mapping -->
    <div class="sc-card">
      <h2 class="sc-card-title">${esc(L.categoryMapping)}</h2>
      <form id="sc-mapping-form" novalidate>
        <div class="sc-grid sc-g3" id="sc-cat-mapping-grid">
          ${Object.keys(catMapping).length
            ? Object.entries(catMapping).map(([cat, dept]) => `
                <div class="sc-input-wrap">
                  <label for="sc-map-${esc(cat)}">${esc(cat)}</label>
                  <select id="sc-map-${esc(cat)}" class="sc-input sc-select" data-map-cat="${esc(cat)}">
                    <option value="">—</option>
                    ${departments.map(d =>
                      `<option value="${esc(d)}" ${dept === d ? 'selected' : ''}>${esc(d)}</option>`
                    ).join('')}
                  </select>
                </div>
              `).join('')
            : `<p class="sc-muted">${esc(L.noData)}</p>`}
        </div>
        <button type="submit" class="sc-btn sm">${esc(L.saveMapping)}</button>
      </form>
    </div>
  `;

  // SLA form
  $('#sc-sla-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {};
    ['Critical','High','Medium','Low'].forEach(p => {
      payload[p] = Number($(`[data-sla-priority="${p}"]`).value);
    });
    try {
      await api('/staff/settings/sla', { method: 'PUT', body: JSON.stringify(payload) });
      toast(L.successSaved, 'success');
    } catch (err) { toast(err.message, 'error'); }
  });

  // Departments — dynamic add/remove
  function getDeptValues() {
    return $$('.sc-dept-input', main).map(i => i.value.trim()).filter(Boolean);
  }

  $('#sc-add-dept')?.addEventListener('click', () => {
    const val = $('#sc-new-dept').value.trim();
    if (!val) return;
    const list = $('#sc-dept-list');
    const idx = $$('[data-dept-index]', list).length;
    const row = document.createElement('div');
    row.className = 'sc-row';
    row.style.marginBottom = '.4rem';
    row.dataset.deptIndex = idx;
    row.innerHTML = `
      <input class="sc-input sc-dept-input" value="${esc(val)}" aria-label="Department ${idx + 1}" style="max-width:300px">
      <button class="sc-btn sm danger sc-flex-none" data-remove-dept="${idx}"
              aria-label="Remove ${esc(val)}" style="flex:0 0 auto">Remove</button>
    `;
    list.appendChild(row);
    $('#sc-new-dept').value = '';
    bindDeptRemove();
  });

  function bindDeptRemove() {
    $$('[data-remove-dept]', main).forEach(btn => {
      btn.onclick = () => btn.closest('[data-dept-index]').remove();
    });
  }
  bindDeptRemove();

  $('#sc-save-depts')?.addEventListener('click', async () => {
    const depts = getDeptValues();
    try {
      await api('/staff/settings/departments', { method: 'PUT', body: JSON.stringify({ departments: depts }) });
      toast(L.successSaved, 'success');
    } catch (e) { toast(e.message, 'error'); }
  });

  // Mapping form
  $('#sc-mapping-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const mapping = {};
    $$('[data-map-cat]', main).forEach(sel => {
      mapping[sel.dataset.mapCat] = sel.value;
    });
    try {
      await api('/staff/settings/mapping', { method: 'PUT', body: JSON.stringify({ mapping }) });
      toast(L.successSaved, 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* ─────────────────────────── Auth helpers ──────────────────────────────── */

function isAdmin() {
  return _currentUser?.role === 'admin';
}

async function loadCurrentUser() {
  try {
    _currentUser = await api('/staff/me');
    const nameEl = $('#sc-user-name');
    if (nameEl) nameEl.textContent = _currentUser?.name || _currentUser?.email || '';
  } catch {}
}

/* ─────────────────────────── Router ────────────────────────────────────── */

const VIEWS = {
  overview,
  reports,
  report: (id) => reportDetail(id),
  map: mapView,
  analytics,
  team,
  settings,
};

let _lastHash = '';

async function route() {
  ensureShell();

  const rawHash = location.hash.slice(1) || 'overview';
  const [name, ...rest] = rawHash.split('/');
  const arg = rest.join('/');

  // Avoid double-renders of same view when hash hasn't changed
  if (rawHash === _lastHash) return;
  _lastHash = rawHash;

  setActiveNav(name);
  const main = $('#console-main');
  if (main) { main.innerHTML = ''; main.focus(); }
  window.scrollTo(0, 0);

  const viewFn = VIEWS[name] || VIEWS.overview;
  showLoading();
  try {
    await viewFn(arg || undefined);
  } catch (e) {
    if (main) main.innerHTML = `<div class="sc-alert error" role="alert">Could not load view: ${esc(e.message)}</div>`;
  } finally {
    hideLoading();
  }
}

/* ─────────────────────────── Boot ──────────────────────────────────────── */

(async function init() {
  ensureShell();
  await loadCurrentUser();

  window.addEventListener('hashchange', () => {
    _lastHash = '';
    route();
  });

  // Handle #reports?... query params from quick-action links
  if (location.hash.startsWith('#reports?')) {
    const [, qs] = location.hash.split('?');
    const params = new URLSearchParams(qs);
    if (params.has('priority')) {
      _reportsState.filters.priority = params.get('priority').split(',');
    }
    if (params.get('assignedTo') === '') {
      // filter unassigned handled in reports view
    }
    location.hash = '#reports';
    return;
  }

  route();
})();
