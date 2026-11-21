/**
 * CivicResolve — Citizen SPA Application
 * Vanilla JS, Government-Grade, Accessible (WCAG 2.2 AA), Multilingual (23 languages)
 * Client-side only. No AI exposure in public interface.
 */

'use strict';

(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const main = $('#main');
  const toastEl = $('#toast');
  const langSelect = $('#lang-select');

  // ── State ───────────────────────────────────────────────────────────────────
  let currentLocale = 'en';
  let translations = {};
  let enFallback = {};
  let appConfig = { categories: [], priorities: [], statuses: [], slaHours: {} };
  let currentUser = null;

  // Image upload state for report form
  let attachedImages = []; // Array of { id, file, dataUrl, name, size }

  // ── RTL & BCP-47 Mapping ───────────────────────────────────────────────────
  const RTL_LANGUAGES = ['ur', 'ks', 'sd'];

  const SPEECH_LOCALES = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    bn: 'bn-IN',
    pa: 'pa-IN',
    or: 'or-IN',
    ur: 'ur-IN',
    ne: 'ne-NP',
    as: 'as-IN',
    mai: 'hi-IN',
    kok: 'kok-IN',
    sa: 'sa-IN',
    doi: 'doi-IN',
    brx: 'brx-IN'
  };

  // ── Utilities ───────────────────────────────────────────────────────────────
  const esc = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function toast(message, duration = 3500) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  const api = async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed.');
      err.code = data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  };

  // ── i18n Engine ─────────────────────────────────────────────────────────────
  function t(key, params = {}) {
    const getNested = (obj, path) => path.split('.').reduce((prev, curr) => prev && prev[curr], obj);
    let str = getNested(translations, key);
    if (!str && translations !== enFallback) {
      str = getNested(enFallback, key);
    }
    if (!str) return key;

    // Parameter interpolation: {{count}} or {count}
    return str.replace(/\{\{?(\w+)\}?\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
  }

  async function loadLocale(langCode) {
    currentLocale = langCode;
    const isRtl = RTL_LANGUAGES.includes(langCode);
    document.documentElement.lang = langCode;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';

    try {
      if (!Object.keys(enFallback).length) {
        enFallback = await fetch('locales/en.json').then(r => r.json());
      }
      if (langCode === 'en') {
        translations = enFallback;
      } else {
        const res = await fetch(`locales/${langCode}.json`);
        translations = await res.json();
      }
    } catch {
      translations = enFallback;
    }

    // Persist
    try { localStorage.setItem('cr_lang', langCode); } catch { /* ignore */ }
    if (langSelect) langSelect.value = langCode;

    // Update static DOM elements with data-i18n
    $$('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (k) el.textContent = t(k);
    });
  }

  // ── Time & Date Formatting ──────────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(currentLocale, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toLocaleString();
    }
  }

  function formatRelative(iso) {
    if (!iso) return '';
    const diffHours = (Date.now() - new Date(iso).getTime()) / 3600000;
    if (diffHours < 1) return t('common.justNow');
    if (diffHours < 24) return `${Math.round(diffHours)} ${t('common.hours')} ${t('common.ago')}`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} ${t('common.days')} ${t('common.ago')}`;
  }

  // ── Client-side Image Compression ───────────────────────────────────────────
  async function compressImageFile(file, maxWidth = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Stepper Component Renderer ──────────────────────────────────────────────
  function renderStepper(currentStatus) {
    const steps = [
      { id: 'Received', label: t('status.Received') },
      { id: 'UnderReview', label: t('status.UnderReview') },
      { id: 'Assigned', label: t('status.Assigned') },
      { id: 'InProgress', label: t('status.InProgress') },
      { id: 'Resolved', label: t('status.Resolved') }
    ];

    const statusMap = {
      'Reported': 0,
      'Received': 0,
      'Under Review': 1,
      'UnderReview': 1,
      'Assigned': 2,
      'In Progress': 3,
      'InProgress': 3,
      'Resolved': 4
    };

    const currentIndex = statusMap[currentStatus] ?? 0;

    return `
      <ol class="stepper" aria-label="Official grievance progress">
        ${steps.map((st, i) => {
          let cls = 'step-item';
          if (i < currentIndex) cls += ' completed';
          else if (i === currentIndex) cls += ' current';
          return `<li class="${cls}"><span class="step-title">${esc(st.label)}</span></li>`;
        }).join('')}
      </ol>
    `;
  }

  // ── Views ───────────────────────────────────────────────────────────────────

  const views = {
    // ── 1. HOME VIEW ──────────────────────────────────────────────────────────
    async home() {
      let stats = { total: 0, resolved: 0, criticalOpen: 0 };
      try {
        stats = await api('/api/stats');
      } catch { /* use defaults */ }

      main.innerHTML = `
        <section class="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">${esc(t('home.hero.headline'))}</h1>
          <p>${esc(t('home.hero.subheadline'))}</p>
          <div class="hero-actions">
            <a href="#report" class="btn btn-primary">${esc(t('home.hero.ctaReport'))}</a>
            <a href="#track" class="btn btn-secondary">${esc(t('home.hero.ctaTrack'))}</a>
          </div>
        </section>

        <section class="grid grid-3" aria-label="Municipal grievance statistics">
          <div class="stat-card">
            <div class="stat-value">${stats.total || 0}</div>
            <div class="stat-label">${esc(t('home.stats.total'))}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--status-green);">${stats.resolved || 0}</div>
            <div class="stat-label">${esc(t('home.stats.resolved'))}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--priority-critical);">${stats.criticalOpen || 0}</div>
            <div class="stat-label">${esc(t('home.stats.criticalOpen'))}</div>
          </div>
        </section>

        <section style="margin-top:var(--space-10);" aria-labelledby="process-title">
          <h2 id="process-title">${esc(t('home.howItWorks.title'))}</h2>
          <div class="grid grid-3" style="margin-top:var(--space-4);">
            <div class="card">
              <h3>${esc(t('home.step1.title'))}</h3>
              <p>${esc(t('home.step1.desc'))}</p>
            </div>
            <div class="card">
              <h3>${esc(t('home.step2.title'))}</h3>
              <p>${esc(t('home.step2.desc'))}</p>
            </div>
            <div class="card">
              <h3>${esc(t('home.step3.title'))}</h3>
              <p>${esc(t('home.step3.desc'))}</p>
            </div>
          </div>
        </section>
      `;
    },

    // ── 2. REPORT GRIEVANCE VIEW ──────────────────────────────────────────────
    async report() {
      // Check authentication first: anonymous users cannot submit reports
      if (!currentUser && window.AuthClient && !window.AuthClient.getUser()) {
        main.innerHTML = `
          <div class="card" style="max-width:560px;margin:var(--space-8) auto;text-align:center;">
            <h2>Citizen Authentication Required</h2>
            <p>To register a formal grievance with the municipality and receive official status notifications, please sign in with your Google account or phone number OTP.</p>
            <div style="display:flex;gap:var(--space-3);justify-content:center;margin-top:var(--space-6);">
              <a href="login.html" class="btn btn-primary">Sign In to Continue</a>
              <a href="#track" class="btn btn-secondary">Track Existing Issue</a>
            </div>
          </div>
        `;
        return;
      }

      attachedImages = [];

      const categoryOptions = (appConfig.categories || [
        'Roads & Potholes', 'Garbage & Sanitation', 'Streetlights & Electrical',
        'Water & Drainage', 'Parks & Trees', 'Traffic & Signals'
      ]).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

      main.innerHTML = `
        <div style="max-width:760px;margin:0 auto;">
          <h2>${esc(t('report.title'))}</h2>
          <p style="color:var(--text-muted);margin-bottom:var(--space-6);">
            All submissions are officially routed to the responsible city authority according to municipal service targets.
          </p>

          <form id="grievance-form" class="card" novalidate>
            <div class="form-group">
              <label class="form-label" for="report-title">
                ${esc(t('report.form.title'))} <span class="required" aria-hidden="true">*</span>
              </label>
              <input type="text" id="report-title" class="form-input" maxlength="120" placeholder="${esc(t('report.form.titlePlaceholder'))}" required>
              <span id="err-title" class="form-error" role="alert"></span>
            </div>

            <div class="form-group">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);">
                <label class="form-label" for="report-desc" style="margin-bottom:0;">
                  ${esc(t('report.form.description'))} <span class="required" aria-hidden="true">*</span>
                </label>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-voice-input" aria-label="Dictate grievance using voice">
                  ${esc(t('report.form.voiceInput'))}
                </button>
              </div>
              <textarea id="report-desc" class="form-textarea" maxlength="2000" placeholder="${esc(t('report.form.descPlaceholder'))}" required></textarea>
              <span id="err-desc" class="form-error" role="alert"></span>
            </div>

            <div class="form-group">
              <label class="form-label" for="report-loc">
                ${esc(t('report.form.location'))} <span class="required" aria-hidden="true">*</span>
              </label>
              <div style="display:flex;gap:var(--space-2);">
                <input type="text" id="report-loc" class="form-input" maxlength="200" placeholder="${esc(t('report.form.locationPlaceholder'))}" required style="flex:1;">
                <button type="button" class="btn btn-secondary" id="btn-gps" aria-label="Use device GPS location">
                  ${esc(t('report.form.useMyLocation'))}
                </button>
              </div>
              <span id="err-loc" class="form-error" role="alert"></span>
              <input type="hidden" id="report-lat">
              <input type="hidden" id="report-lng">
            </div>

            <div class="form-group">
              <label class="form-label" for="report-category">
                ${esc(t('report.form.category'))}
              </label>
              <select id="report-category" class="form-select">
                <option value="">${esc(t('report.form.categoryDefault'))}</option>
                ${categoryOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">
                ${esc(t('report.form.addPhoto'))} (${t('report.form.maxPhotos', { count: 5 })})
              </label>
              <div class="dropzone" id="image-dropzone" tabindex="0" role="button" aria-label="${esc(t('report.form.dragDrop'))}">
                <p style="margin-bottom:var(--space-2);color:var(--text-secondary);font-weight:600;">
                  ${esc(t('report.form.dragDrop'))}
                </p>
                <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0;">
                  Supports JPEG, PNG, WebP up to 5 MB each.
                </p>
                <input type="file" id="file-input" accept="image/*" multiple style="display:none;">
              </div>
              <div id="image-previews" class="image-preview-grid" aria-live="polite"></div>
            </div>

            <div class="form-group" style="margin-top:var(--space-6);">
              <label style="display:flex;align-items:flex-start;gap:var(--space-2);cursor:pointer;font-size:0.95rem;">
                <input type="checkbox" id="contact-consent" checked style="width:auto;margin-top:4px;">
                <span>${esc(t('report.form.contactConsent'))}</span>
              </label>
            </div>

            <div id="form-general-error" class="form-error" style="margin-bottom:var(--space-4);" role="alert"></div>

            <button type="submit" class="btn btn-primary" id="btn-submit-report" style="width:100%;">
              ${esc(t('report.form.submit'))}
            </button>
          </form>
        </div>
      `;

      // Wire events for voice, gps, dropzone, submission
      initReportForm();
    },

    // ── 3. TRACK ISSUE VIEW ───────────────────────────────────────────────────
    async track(ticketId) {
      main.innerHTML = `
        <div style="max-width:760px;margin:0 auto;">
          <h2>${esc(t('track.title'))}</h2>
          <div class="card" style="margin-bottom:var(--space-6);">
            <form id="track-search-form" style="display:flex;gap:var(--space-2);">
              <label for="track-query" class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">${esc(t('track.searchLabel'))}</label>
              <input type="text" id="track-query" class="form-input" placeholder="${esc(t('track.searchPlaceholder'))}" value="${esc(ticketId || '')}" required style="flex:1;">
              <button type="submit" class="btn btn-primary">${esc(t('button.submit'))}</button>
            </form>
          </div>
          <div id="track-result" aria-live="polite"></div>
        </div>
      `;

      const searchForm = $('#track-search-form');
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = $('#track-query').value.trim();
        if (q) loadTicketStatus(q);
      });

      if (ticketId) {
        loadTicketStatus(ticketId);
      }
    },

    // ── 4. MY REPORTS VIEW ────────────────────────────────────────────────────
    async myReports() {
      if (!currentUser && window.AuthClient && !window.AuthClient.getUser()) {
        main.innerHTML = `
          <div class="card" style="max-width:560px;margin:var(--space-8) auto;text-align:center;">
            <h2>Citizen Authentication Required</h2>
            <p>Please sign in to view your submitted grievances and follow resolution updates.</p>
            <a href="login.html" class="btn btn-primary" style="margin-top:var(--space-4);">Sign In</a>
          </div>
        `;
        return;
      }

      main.innerHTML = `
        <h2>${esc(t('myReports.title'))}</h2>
        <div id="my-reports-list" class="grid" style="margin-top:var(--space-6);" aria-live="polite">
          <div class="skeleton" style="height:120px;"></div>
        </div>
      `;

      try {
        const res = await api('/api/reports/mine');
        const list = res.reports || [];
        const container = $('#my-reports-list');

        if (!list.length) {
          container.innerHTML = `
            <div class="card empty-state">
              <h3>${esc(t('myReports.noReports'))}</h3>
              <p>You can report any civic issue in your neighborhood in seconds.</p>
              <a href="#report" class="btn btn-primary" style="margin-top:var(--space-4);">${esc(t('home.hero.ctaReport'))}</a>
            </div>
          `;
          return;
        }

        container.innerHTML = list.map(r => `
          <article class="card" aria-labelledby="r-${esc(r.id)}">
            <div class="card-header">
              <div>
                <span class="badge badge-${esc(r.status.replace(/\s+/g, ''))}">${esc(r.status)}</span>
                <span style="font-size:0.85rem;color:var(--text-muted);margin-inline-start:8px;">${esc(r.id)}</span>
              </div>
              <span style="font-size:0.85rem;color:var(--text-muted);">${formatRelative(r.createdAt)}</span>
            </div>
            <h3 id="r-${esc(r.id)}">${esc(r.title)}</h3>
            <p style="margin-bottom:var(--space-2);">${esc(r.description)}</p>
            <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:var(--space-4);">
              <strong>${esc(t('track.department'))}:</strong> ${esc(r.department)} | 
              <strong>Location:</strong> ${esc(r.location)}
            </p>
            ${renderStepper(r.status)}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid var(--border-light);">
              <span style="font-size:0.9rem;color:var(--text-muted);">
                ${r.supporters || 1} ${esc(t('myReports.affected'))}
              </span>
              <div style="display:flex;gap:var(--space-2);">
                <a href="#track/${esc(r.id)}" class="btn btn-secondary btn-sm">Details &amp; Timeline</a>
                ${r.status !== 'Resolved' ? `<button type="button" class="btn btn-quiet btn-sm btn-escalate" data-id="${esc(r.id)}">${esc(t('myReports.escalate'))}</button>` : ''}
              </div>
            </div>
          </article>
        `).join('');

        // Wire escalation buttons
        $$('.btn-escalate', container).forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            btn.disabled = true;
            try {
              await api(`/api/reports/${id}/escalate`, { method: 'POST' });
              toast('Escalation request submitted to municipal nodal officer.');
              btn.textContent = 'Escalated';
            } catch (err) {
              toast(err.message || 'Could not escalate.');
              btn.disabled = false;
            }
          });
        });

      } catch (err) {
        $('#my-reports-list').innerHTML = `
          <div class="card form-error" role="alert">Could not load reports: ${esc(err.message)}</div>
        `;
      }
    },

    // ── 5. HOW IT WORKS VIEW ──────────────────────────────────────────────────
    async howItWorks() {
      main.innerHTML = `
        <div style="max-width:820px;margin:0 auto;">
          <h2>${esc(t('howItWorks.title'))}</h2>
          <p style="font-size:1.1rem;color:var(--text-secondary);margin-bottom:var(--space-8);">
            CivicResolve connects citizens directly to municipal field units. Every report is recorded in the official grievance ledger with an SLA response window.
          </p>

          <div class="card">
            <h3>Lifecycle of a Civic Grievance</h3>
            <ol style="margin-inline-start:var(--space-5);line-height:1.8;color:var(--text-secondary);">
              <li><strong>${esc(t('howItWorks.step1.title'))}:</strong> ${esc(t('howItWorks.step1.desc'))}</li>
              <li><strong>${esc(t('howItWorks.step2.title'))}:</strong> ${esc(t('howItWorks.step2.desc'))}</li>
              <li><strong>${esc(t('howItWorks.step3.title'))}:</strong> ${esc(t('howItWorks.step3.desc'))}</li>
              <li><strong>${esc(t('howItWorks.step4.title'))}:</strong> ${esc(t('howItWorks.step4.desc'))}</li>
              <li><strong>${esc(t('howItWorks.step5.title'))}:</strong> ${esc(t('howItWorks.step5.desc'))}</li>
            </ol>
          </div>

          <div class="card">
            <h3>${esc(t('howItWorks.expectedTimes'))}</h3>
            <p>Target completion timelines established under municipal citizen charters:</p>
            <ul style="margin-inline-start:var(--space-5);line-height:1.8;color:var(--text-secondary);">
              <li><strong>Critical (immediate hazard to life/health):</strong> 24 hours</li>
              <li><strong>High (major disruption or sanitation risk):</strong> 72 hours (3 days)</li>
              <li><strong>Medium (routine road or lighting maintenance):</strong> 168 hours (7 days)</li>
              <li><strong>Low (aesthetic or minor improvement):</strong> 336 hours (14 days)</li>
            </ul>
          </div>

          <div class="card">
            <h3>Citizen Confidentiality</h3>
            <p>${esc(t('howItWorks.privacyInfo'))}</p>
            <p>${esc(t('howItWorks.tips'))}</p>
          </div>
        </div>
      `;
    },

    // ── 6. PRIVACY VIEW ───────────────────────────────────────────────────────
    async privacy() {
      main.innerHTML = `
        <div style="max-width:760px;margin:0 auto;">
          <h2>${esc(t('privacy.title'))}</h2>
          <div class="card">
            <h3>${esc(t('privacy.dataCollected'))}</h3>
            <p>When you submit a civic report, we store the problem title, description, attached photos, and geographical coordinates. If signed in, your account UID is linked to allow tracking.</p>
            
            <h3>${esc(t('privacy.howUsed'))}</h3>
            <p>Your grievance information is provided exclusively to municipal field officers, engineers, and authorized sanitary supervisors responsible for rectifying the issue.</p>

            <h3>Automated Data Processing</h3>
            <p>${esc(t('privacy.automatedTools'))}</p>

            <h3>Data Retention &amp; Rights</h3>
            <p>${esc(t('privacy.deleteContact'))}</p>
          </div>
        </div>
      `;
    }
  };

  // ── Helper: Report Form Initialization ──────────────────────────────────────
  function initReportForm() {
    const form = $('#grievance-form');
    const dropzone = $('#image-dropzone');
    const fileInput = $('#file-input');
    const previews = $('#image-previews');
    const btnVoice = $('#btn-voice-input');
    const btnGps = $('#btn-gps');
    const errGen = $('#form-general-error');

    // Dropzone click & drag
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
      handleFiles(fileInput.files);
      fileInput.value = '';
    });

    async function handleFiles(files) {
      if (!files || !files.length) return;
      const remainingSlots = 5 - attachedImages.length;
      if (remainingSlots <= 0) {
        toast('Maximum 5 photos allowed per report.');
        return;
      }

      for (const file of Array.from(files).slice(0, remainingSlots)) {
        if (!file.type.startsWith('image/')) continue;
        try {
          const dataUrl = await compressImageFile(file, 1600, 0.85);
          attachedImages.push({
            id: 'img_' + Math.random().toString(36).slice(2, 9),
            file,
            dataUrl,
            name: file.name
          });
        } catch (err) {
          console.warn('Image compression failed:', err);
        }
      }
      renderPreviews();
    }

    function renderPreviews() {
      previews.innerHTML = attachedImages.map((img, idx) => `
        <div class="image-preview-item" data-id="${esc(img.id)}">
          <img src="${img.dataUrl}" alt="Attached photo ${idx + 1}">
          <button type="button" class="image-preview-remove" aria-label="Remove photo" data-idx="${idx}">&times;</button>
        </div>
      `).join('');

      $$('.image-preview-remove', previews).forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const i = parseInt(b.getAttribute('data-idx'), 10);
          attachedImages.splice(i, 1);
          renderPreviews();
        });
      });
    }

    // Voice recognition
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      btnVoice.style.display = 'none';
    } else {
      btnVoice.addEventListener('click', () => {
        const recognition = new SR();
        recognition.lang = SPEECH_LOCALES[currentLocale] || 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          btnVoice.textContent = 'Listening…';
          btnVoice.disabled = true;
          toast('Listening… speak your grievance clearly.');
        };
        recognition.onresult = (e) => {
          const speechResult = e.results[0][0].transcript;
          const desc = $('#report-desc');
          desc.value = (desc.value ? desc.value + ' ' : '') + speechResult;
        };
        recognition.onerror = () => {
          toast(t('error.voiceUnsupported'));
        };
        recognition.onend = () => {
          btnVoice.textContent = t('report.form.voiceInput');
          btnVoice.disabled = false;
        };
        recognition.start();
      });
    }

    // GPS location
    btnGps.addEventListener('click', () => {
      if (!navigator.geolocation) {
        toast('Geolocation not supported on this device.');
        return;
      }
      btnGps.disabled = true;
      btnGps.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          $('#report-lat').value = lat;
          $('#report-lng').value = lng;
          const locInput = $('#report-loc');
          if (!locInput.value) {
            locInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          }
          btnGps.disabled = false;
          btnGps.textContent = t('report.form.useMyLocation');
          toast('GPS coordinates captured.');
        },
        () => {
          btnGps.disabled = false;
          btnGps.textContent = t('report.form.useMyLocation');
          toast(t('error.locationDenied'));
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errGen.textContent = '';
      $('#err-title').textContent = '';
      $('#err-desc').textContent = '';
      $('#err-loc').textContent = '';

      const title = $('#report-title').value.trim();
      const description = $('#report-desc').value.trim();
      const location = $('#report-loc').value.trim();
      const category = $('#report-category').value;
      const lat = $('#report-lat').value ? parseFloat($('#report-lat').value) : null;
      const lng = $('#report-lng').value ? parseFloat($('#report-lng').value) : null;

      let valid = true;
      if (title.length < 3) {
        $('#err-title').textContent = t('validation.titleTooShort');
        valid = false;
      }
      if (description.length < 10) {
        $('#err-desc').textContent = t('validation.descRequired');
        valid = false;
      }
      if (location.length < 3) {
        $('#err-loc').textContent = t('validation.locationRequired');
        valid = false;
      }

      if (!valid) return;

      const btnSubmit = $('#btn-submit-report');
      btnSubmit.disabled = true;
      btnSubmit.textContent = t('button.loading');

      try {
        const payload = {
          title,
          description,
          location,
          category: category || undefined,
          lat,
          lng,
          language: currentLocale
        };

        const res = await api('/api/reports', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        const reportId = res.ticketId || (res.issue && res.issue.id);

        // Upload any attached images
        if (attachedImages.length > 0 && reportId) {
          try {
            const confirmedPaths = [];
            for (const img of attachedImages) {
              const urlRes = await api(`/api/reports/${reportId}/images/upload-url`, {
                method: 'POST',
                body: JSON.stringify({ mimeType: 'image/jpeg', filename: img.name })
              });

              if (urlRes.uploadUrl) {
                // If it's a direct local upload or GCS signed URL
                if (urlRes.uploadUrl.startsWith('/api/')) {
                  await fetch(urlRes.uploadUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: img.dataUrl
                  });
                } else {
                  // GCS Signed PUT
                  const byteString = atob(img.dataUrl.split(',')[1]);
                  const ab = new ArrayBuffer(byteString.length);
                  const ia = new Uint8Array(ab);
                  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                  await fetch(urlRes.uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: ab
                  });
                }
                confirmedPaths.push(urlRes.objectPath);
              }
            }

            if (confirmedPaths.length > 0) {
              await api(`/api/reports/${reportId}/images/confirm`, {
                method: 'POST',
                body: JSON.stringify({ imagePaths: confirmedPaths })
              });
            }
          } catch (uploadErr) {
            console.warn('Image upload confirmation failed:', uploadErr);
          }
        }

        // Show citizen confirmation view
        renderSuccessConfirmation(res);

      } catch (err) {
        errGen.textContent = err.message || t('error.serverError');
        btnSubmit.disabled = false;
        btnSubmit.textContent = t('report.form.submit');
      }
    });
  }

  function renderSuccessConfirmation(res) {
    const isDup = res.duplicate;
    const issue = res.issue || {};
    const ticketId = res.ticketId || issue.id;
    const dept = res.department || issue.department || 'Municipal Helpline';
    const hrs = res.expectedResponseHours || 72;

    main.innerHTML = `
      <div class="card" style="max-width:640px;margin:var(--space-8) auto;text-align:center;">
        <div style="font-size:3rem;margin-bottom:var(--space-2);color:var(--status-green);">&check;</div>
        <h2>${isDup ? esc(t('report.success.duplicate')) : esc(t('report.success.title'))}</h2>
        <p style="color:var(--text-secondary);">
          ${isDup ? 'Your grievance has been consolidated with existing reports for this location to accelerate action.' : 'Your complaint has been formally registered in the city portal.'}
        </p>

        <div style="background:var(--surface-alt);border:1px solid var(--border-medium);border-radius:var(--radius-md);padding:var(--space-5);margin:var(--space-6) 0;text-align:start;">
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
            <span style="font-size:0.9rem;color:var(--text-muted);">${esc(t('report.success.ticketId'))}:</span>
            <strong style="font-size:1.15rem;color:var(--civic-blue);">${esc(ticketId)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
            <span style="font-size:0.9rem;color:var(--text-muted);">${esc(t('report.success.department'))}:</span>
            <strong>${esc(dept)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:0.9rem;color:var(--text-muted);">${esc(t('report.success.expectedHours'))}:</span>
            <strong>${hrs} hours</strong>
          </div>
        </div>

        <div style="display:flex;gap:var(--space-3);justify-content:center;">
          <a href="#track/${esc(ticketId)}" class="btn btn-primary">${esc(t('report.success.track'))}</a>
          <a href="#report" class="btn btn-secondary">Submit Another</a>
        </div>
      </div>
    `;
    main.focus();
  }

  async function loadTicketStatus(id) {
    const container = $('#track-result');
    if (!container) return;
    container.innerHTML = `<div class="skeleton" style="height:180px;"></div>`;

    try {
      const issue = await api(`/api/issues/${encodeURIComponent(id)}`);
      let statusMsg = '';
      try {
        const msgRes = await api(`/api/issues/${encodeURIComponent(id)}/status-message?lang=${currentLocale}`);
        statusMsg = msgRes.message || '';
      } catch { /* ignore */ }

      container.innerHTML = `
        <article class="card" aria-labelledby="t-title">
          <div class="card-header">
            <div>
              <span class="badge badge-${esc((issue.status || 'Received').replace(/\s+/g, ''))}">${esc(issue.status || 'Received')}</span>
              <span style="font-size:0.9rem;color:var(--text-muted);margin-inline-start:8px;">${esc(issue.id)}</span>
            </div>
            <span style="font-size:0.85rem;color:var(--text-muted);">${formatRelative(issue.createdAt)}</span>
          </div>

          <h3 id="t-title">${esc(issue.title)}</h3>
          <p>${esc(issue.description)}</p>

          ${statusMsg ? `
            <div style="background:var(--civic-blue-light);border-left:4px solid var(--civic-blue);padding:var(--space-3) var(--space-4);border-radius:var(--radius-sm);margin:var(--space-4) 0;font-size:0.95rem;">
              <strong>Official Update:</strong> ${esc(statusMsg)}
            </div>
          ` : ''}

          <div style="margin:var(--space-6) 0;">
            ${renderStepper(issue.status || 'Received')}
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3);background:var(--surface-alt);padding:var(--space-4);border-radius:var(--radius-md);margin-bottom:var(--space-4);">
            <div>
              <div style="font-size:0.85rem;color:var(--text-muted);">${esc(t('track.department'))}</div>
              <strong>${esc(issue.department || 'Municipal Helpline')}</strong>
            </div>
            <div>
              <div style="font-size:0.85rem;color:var(--text-muted);">Location</div>
              <strong>${esc(issue.location)}</strong>
            </div>
            <div>
              <div style="font-size:0.85rem;color:var(--text-muted);">Affected Citizens</div>
              <strong id="support-count">${issue.supporters || 1}</strong>
            </div>
          </div>

          <div style="display:flex;gap:var(--space-3);align-items:center;margin-bottom:var(--space-4);">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-me-too" data-id="${esc(issue.id)}">
              I am affected too (${issue.supporters || 1})
            </button>
          </div>

          ${issue.timeline && issue.timeline.length ? `
            <details style="margin-top:var(--space-4);">
              <summary style="font-weight:600;cursor:pointer;color:var(--civic-blue);">${esc(t('track.timeline'))} (${issue.timeline.length} updates)</summary>
              <ul style="list-style:none;margin-top:var(--space-3);padding-inline-start:var(--space-3);border-inline-start:2px solid var(--border-medium);">
                ${issue.timeline.map(e => `
                  <li style="margin-bottom:var(--space-3);padding-inline-start:var(--space-3);">
                    <div style="font-size:0.8rem;color:var(--text-muted);">${formatDate(e.at)}</div>
                    <div><strong>${esc(e.status)}:</strong> ${esc(e.note)}</div>
                  </li>
                `).join('')}
              </ul>
            </details>
          ` : ''}
        </article>
      `;

      $('#btn-me-too').addEventListener('click', async () => {
        const btn = $('#btn-me-too');
        btn.disabled = true;
        try {
          const sup = await api(`/api/issues/${encodeURIComponent(issue.id)}/support`, { method: 'POST' });
          btn.textContent = `I am affected too (${sup.supporters})`;
          $('#support-count').textContent = sup.supporters;
          toast('Your voice has been added to this report.');
        } catch {
          btn.disabled = false;
        }
      });

    } catch (err) {
      container.innerHTML = `
        <div class="card empty-state" role="alert">
          <h3>${esc(t('track.noResults'))}</h3>
          <p>Please check the reference ID and try again.</p>
        </div>
      `;
    }
  }

  // ── Router ──────────────────────────────────────────────────────────────────
  async function route() {
    const hash = location.hash.slice(1) || 'home';
    const [name, arg] = hash.split('/');

    const viewFn = views[name] || views.home;

    // Update nav active states
    $$('#nav a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === '#' + name) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });

    try {
      await viewFn(arg);
    } catch (err) {
      main.innerHTML = `<div class="card form-error" role="alert">Could not load view: ${esc(err.message)}</div>`;
    }

    document.title = `CivicResolve — ${t('nav.' + (name === 'my-reports' ? 'myReports' : name === 'how-it-works' ? 'howItWorks' : name)) || 'Citizen Portal'}`;
  }

  // ── Initialization ──────────────────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', async () => {
    // 1. Determine language (saved preference -> browser language -> English)
    let initialLang = 'en';
    try {
      const saved = localStorage.getItem('cr_lang');
      if (saved) initialLang = saved;
      else {
        const browser = (navigator.language || 'en').split('-')[0].toLowerCase();
        if (SPEECH_LOCALES[browser]) initialLang = browser;
      }
    } catch { /* ignore */ }

    await loadLocale(initialLang);

    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        loadLocale(e.target.value);
        route();
      });
    }

    // 2. Fetch config
    try {
      appConfig = await api('/api/config');
    } catch { /* fallback to defaults */ }

    // 3. Listen to auth state
    document.addEventListener('authStateChanged', (e) => {
      currentUser = e.detail;
      const authBtn = $('#btn-login-nav');
      if (authBtn) {
        if (currentUser) {
          authBtn.textContent = t('nav.signOut');
          authBtn.href = '#sign-out';
          authBtn.onclick = async (ev) => {
            ev.preventDefault();
            if (window.AuthClient) await window.AuthClient.signOut();
            window.location.reload();
          };
        } else {
          authBtn.textContent = t('nav.signIn');
          authBtn.href = 'login.html';
          authBtn.onclick = null;
        }
      }
    });

    // 4. Initial route
    window.addEventListener('hashchange', () => {
      route();
      window.scrollTo(0, 0);
      main.focus();
    });

    route();
  });

})();
