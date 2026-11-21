'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = $('#main');
let token = sessionStorage.getItem('cr_admin') || '', config = { ai: false, categories: [] }, imageData = '', coords = {};
const api = async (p, o = {}) => {
  const r = await fetch('/api' + p, { ...o, headers: { 'Content-Type': 'application/json', ...(token && p.startsWith('/admin') ? { Authorization: 'Bearer ' + token } : {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
};
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); };
const ago = iso => { const h = (Date.now() - new Date(iso)) / 36e5; return h < 1 ? 'just now' : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };
const sla = i => { if (i.status === 'Resolved') return '✅ Resolved'; const h = (new Date(i.dueAt) - Date.now()) / 36e5; return h < 0 ? `⚠️ Overdue by ${Math.round(-h)}h` : `⏱ SLA: ${Math.round(h)}h left`; };
const opts = (arr, sel) => arr.map(c => `<option${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join('');
const steps = s => `<ol class="steps" aria-label="Status: ${esc(s)}">${['Reported', 'In Progress', 'Resolved'].map((x, n) => `<li class="${n <= ['Reported', 'In Progress', 'Resolved'].indexOf(s) ? 'on' : ''}">${x}</li>`).join('')}</ol>`;
const aiBox = a => `<div class="card ai" aria-live="polite"><h3>🤖 ${a.source === 'gemini' ? 'Gemini' : 'Smart-rules'} triage</h3>
 <p><span class="badge ${esc(a.priority)}">${esc(a.priority)} priority</span> · <b>${esc(a.category)}</b> → <b>${esc(a.department)}</b></p>
 <p>${esc(a.summary)}</p><p class="mute">Suggested action: ${esc(a.suggestedAction)}</p>
 <label for="m">Public impact ${a.publicImpact}/10 · confidence ${Math.round(a.confidence * 100)}%</label><div class="meter" id="m"><i style="width:${a.publicImpact * 10}%"></i></div></div>`;
const timeline = t => `<ul class="tl">${t.map(e => `<li><b>${esc(e.status)}</b> · ${ago(e.at)} — ${esc(e.note)}</li>`).join('')}</ul>`;
const card = (i, admin) => `<article class="card" aria-labelledby="t-${esc(i.id)}">
 <div class="row"><h3 id="t-${esc(i.id)}" style="flex:1">${esc(i.title)}</h3><span class="badge ${esc(i.priority)}">${esc(i.priority)}</span></div>
 <p class="mute">${esc(i.id)} · ${esc(i.category)} · ${esc(i.location)}<br>Routed to <b>${esc(i.department)}</b> · ${ago(i.createdAt)} · ${esc(sla(i))}</p>
 ${steps(i.status)}
 <div class="row"><button class="btn alt sm" data-support="${esc(i.id)}" aria-label="I am affected too: ${esc(i.title)}">🙋 Me too (${i.supporters})</button>
 <select data-lang="${esc(i.id)}" aria-label="Language for AI update" style="max-width:110px"><option>English</option><option value="Tamil">தமிழ்</option><option value="Hindi">हिन्दी</option></select><button class="btn alt sm" data-explain="${esc(i.id)}">✨ Explain status</button></div><p class="ai" data-out="${esc(i.id)}" hidden style="padding:.6rem;border-radius:10px"></p>
 <details><summary>Details &amp; timeline</summary><p>${esc(i.description)}</p>${timeline(i.timeline)}
 ${i.lat != null ? `<iframe loading="lazy" title="Map of ${esc(i.title)}" src="https://maps.google.com/maps?q=${+i.lat},${+i.lng}&z=16&output=embed"></iframe>` : ''}</details></article>`;

const views = {
  async home() {
    const s = await api('/stats');
    main.innerHTML = `<section class="hero"><p>Report. Track. Resolve.</p><h1>Fix your city in 60 seconds.</h1>
     <p>Describe a problem in any language, add a photo, and Gemini instantly categorises it, judges urgency and routes it to the right department, with a public SLA clock.</p>
     <div class="row" style="margin-top:1rem"><a class="btn light" href="#report">Report an issue</a><a class="btn light" href="#track">Track a ticket</a></div></section>
     <div class="grid g3"><div class="card"><div class="big">${s.total}</div><p class="mute">Issues reported</p></div><div class="card"><div class="big">${s.resolved}</div><p class="mute">Resolved</p></div><div class="card"><div class="big">${s.criticalOpen}</div><p class="mute">Critical open</p></div></div>
     <div class="grid g3" style="margin-top:1rem">${[['🧠', 'Gemini triage', 'Category, priority and impact score from text and photo.'], ['🗣', 'Any language', 'Tamil, Hindi or English, plus voice input.'], ['📍', 'Duplicate guard', 'Nearby reports merge so crews are not flooded.']].map(([e, t, d]) => `<div class="card"><h3><span aria-hidden="true">${e}</span> ${t}</h3><p class="mute">${d}</p></div>`).join('')}</div>`;
  },
  report() {
    imageData = ''; coords = {};
    main.innerHTML = `<div class="grid g2"><form class="card" id="f" novalidate><h2>Report a civic issue</h2>
     <label for="title">Title *</label><input id="title" required maxlength="120" placeholder="e.g. Deep pothole near bus stop">
     <label for="desc">Description * <button type="button" class="btn alt sm" id="mic" aria-label="Dictate description">🎤 Speak</button></label>
     <textarea id="desc" required maxlength="2000" placeholder="What is wrong? Any language works."></textarea>
     <label for="loc">Location *</label><div class="row"><input id="loc" required maxlength="200" placeholder="Street, landmark, area"><button type="button" class="btn alt" id="gps">📍 Use my location</button></div>
     <div class="row"><div><label for="cat">Category</label><select id="cat"><option value="">Let AI decide</option>${opts(config.categories)}</select></div><div><label for="photo">Photo (optional)</label><input id="photo" type="file" accept="image/*"></div></div>
     <label for="name">Your name (optional, never shown publicly)</label><input id="name" maxlength="60" autocomplete="name">
     <p id="err" role="alert" style="color:var(--bad)"></p>
     <div class="row"><button type="button" class="btn alt" id="prev">🤖 Preview AI triage</button><button class="btn" id="go">Submit report</button></div></form>
     <div id="side"><div class="card"><h3>What happens next</h3><ol><li>Gemini reads your report${config.ai ? '' : ' (demo rules mode: add GEMINI_API_KEY for full AI)'}</li><li>It is prioritised and routed</li><li>You get a ticket ID and an SLA clock</li><li>Track it until it is resolved</li></ol></div></div></div>`;
    const body = () => ({ title: $('#title').value, description: $('#desc').value, location: $('#loc').value, category: $('#cat').value, name: $('#name').value, image: imageData, ...coords });
    const busy = (b, on) => { $('#prev').disabled = $('#go').disabled = on; };
    $('#prev').onclick = async () => { $('#err').textContent = ''; busy(0, true); try { $('#side').innerHTML = aiBox(await api('/analyze', { method: 'POST', body: JSON.stringify(body()) })); } catch (e) { $('#err').textContent = e.message; } busy(0, false); };
    $('#f').onsubmit = async e => {
      e.preventDefault(); $('#err').textContent = ''; busy(0, true);
      try {
        const r = await api('/issues', { method: 'POST', body: JSON.stringify(body()) }), i = r.issue;
        main.innerHTML = `<div class="card" style="max-width:640px;margin:auto"><h2>${r.duplicate ? '🤝 Already reported nearby' : '🎉 Report submitted'}</h2>
         <p>${r.duplicate ? 'We added your voice to an existing open ticket.' : 'Save your ticket ID:'} <b style="font-size:1.4rem">${esc(i.id)}</b></p>${aiBox(i)}<p>${esc(sla(i))}</p>
         <div class="row"><a class="btn" href="#track/${esc(i.id)}">Track this ticket</a><a class="btn alt" href="#report">Report another</a></div></div>`;
        main.focus();
      } catch (er) { $('#err').textContent = er.message; busy(0, false); }
    };
    $('#photo').onchange = e => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, 900 / img.width); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); imageData = c.toDataURL('image/jpeg', .7); toast('Photo attached'); URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); };
    $('#gps').onclick = () => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => { coords = { lat: p.coords.latitude, lng: p.coords.longitude }; if (!$('#loc').value) $('#loc').value = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`; toast('Location captured'); }, () => toast('Location permission denied')) : toast('Geolocation unsupported');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) $('#mic').hidden = true; else $('#mic').onclick = () => { const r = new SR(); r.lang = navigator.language || 'en-IN'; r.onresult = e => { $('#desc').value += ' ' + e.results[0][0].transcript; }; r.onerror = () => toast('Voice input failed'); r.start(); toast('Listening…'); };
  },
  async track(id) {
    main.innerHTML = `<h2>Track issues</h2><div class="toolbar"><div><label class="sr" for="q">Ticket ID</label><input id="q" placeholder="Search ticket ID or keyword" value="${esc(id || '')}"></div>
     <div><label class="sr" for="fs">Status</label><select id="fs"><option value="">All statuses</option>${opts(['Reported', 'In Progress', 'Resolved'])}</select></div>
     <div><label class="sr" for="fc">Category</label><select id="fc"><option value="">All categories</option>${opts(config.categories)}</select></div></div><div id="list" class="grid g2" aria-live="polite"></div>`;
    const all = await api('/issues');
    const draw = () => { const q = $('#q').value.toLowerCase(), s = $('#fs').value, c = $('#fc').value; const l = all.filter(i => (!s || i.status === s) && (!c || i.category === c) && (!q || (i.id + i.title + i.location).toLowerCase().includes(q))); $('#list').innerHTML = l.map(i => card(i)).join('') || '<p class="mute">No matching issues.</p>'; };
    ['q', 'fs', 'fc'].forEach(x => $('#' + x).addEventListener('input', draw)); draw();
    if (id) $('#list details')?.setAttribute('open', '');
  },
  async impact() {
    const s = await api('/stats'), max = o => Math.max(1, ...Object.values(o));
    const bars = o => Object.entries(o).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><div class="meter"><i style="width:${v / max(o) * 100}%"></i></div><b>${v}</b></div>`).join('');
    main.innerHTML = `<h2>Transparency dashboard</h2><div class="grid g3"><div class="card"><div class="big">${Math.round(s.resolved / Math.max(1, s.total) * 100)}%</div><p class="mute">Resolution rate</p></div><div class="card"><div class="big">${s.avgResolutionHours ?? '–'}h</div><p class="mute">Avg. time to resolve</p></div><div class="card"><div class="big">${s.overdue}</div><p class="mute">Past SLA</p></div></div>
     <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>By category</h3>${bars(s.byCategory)}</div><div class="card"><h3>By priority</h3>${bars(s.byPriority)}<h3>By status</h3>${bars(s.byStatus)}</div></div>`;
  },
  async admin() {
    if (!token) {
      main.innerHTML = `<form class="card" id="lf" style="max-width:420px;margin:auto"><h2>Admin sign in</h2><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required><p id="err" role="alert" style="color:var(--bad)"></p><button class="btn">Sign in</button></form>`;
      $('#lf').onsubmit = async e => { e.preventDefault(); try { token = (await api('/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value }) })).token; sessionStorage.setItem('cr_admin', token); route(); } catch (er) { $('#err').textContent = er.message; } };
      return;
    }
    const all = await api('/issues');
    main.innerHTML = `<div class="row"><h2 style="flex:1">Admin dashboard</h2><button class="btn alt sm" id="out">Sign out</button></div><div class="card ai"><div class="row"><h3 style="flex:1">🤖 AI dispatch briefing</h3><button class="btn sm" id="brief">Generate with Gemini</button></div><p id="bout" aria-live="polite" style="white-space:pre-wrap" class="mute">Summarises hotspots, today's priorities and SLA risks.</p></div><div class="card" style="overflow:auto;margin-top:1rem"><table><caption class="sr">All issues, most urgent first</caption><thead><tr><th>Issue</th><th>Priority</th><th>SLA</th><th>Status &amp; note</th></tr></thead><tbody>${all.map(i => `<tr><td><b>${esc(i.title)}</b><br><span class="mute">${esc(i.id)} · ${esc(i.department)} · 👥${i.supporters}</span></td><td><span class="badge ${esc(i.priority)}">${esc(i.priority)}</span></td><td>${esc(sla(i))}</td>
     <td><label class="sr" for="s-${esc(i.id)}">Status for ${esc(i.id)}</label><select id="s-${esc(i.id)}">${opts(['Reported', 'In Progress', 'Resolved'], i.status)}</select><input id="n-${esc(i.id)}" placeholder="Note (optional)" aria-label="Note for ${esc(i.id)}"><button class="btn sm" data-save="${esc(i.id)}">Save</button></td></tr>`).join('')}</tbody></table></div>`;
    $('#brief').onclick = async e => { e.target.disabled = true; $('#bout').textContent = 'Thinking…'; try { const r = await api('/admin/briefing'); $('#bout').textContent = r.text + (r.source === 'gemini' ? '' : '\n(Rules mode: set GEMINI_API_KEY for Gemini analysis)'); } catch (er) { $('#bout').textContent = er.message; } e.target.disabled = false; };
    $('#out').onclick = () => { token = ''; sessionStorage.removeItem('cr_admin'); route(); };
  }
};
main.addEventListener('click', async e => {
  const ex = e.target.closest('[data-explain]');
  if (ex) { const id = ex.dataset.explain, o = $(`[data-out="${id}"]`); o.hidden = false; o.textContent = '✨ Asking Gemini…'; try { const r = await api(`/issues/${id}/explain?lang=${encodeURIComponent($(`[data-lang="${id}"]`).value)}`); o.textContent = r.text; } catch (er) { o.textContent = er.message; } return; }
  const sup = e.target.closest('[data-support]'), sv = e.target.closest('[data-save]');
  try {
    if (sup) { const r = await api(`/issues/${sup.dataset.support}/support`, { method: 'POST' }); sup.textContent = `🙋 Me too (${r.supporters})`; toast('Thanks, your voice was added'); }
    if (sv) { const id = sv.dataset.save; await api('/admin/issues/' + id, { method: 'PATCH', body: JSON.stringify({ status: $('#s-' + id).value, note: $('#n-' + id).value }) }); toast('Updated ' + id); route(); }
  } catch (er) { toast(er.message); if (/login/i.test(er.message)) { token = ''; route(); } }
});
async function route() {
  const [name, arg] = (location.hash.slice(1) || 'home').split('/');
  const v = views[name] || views.home;
  document.querySelectorAll('#nav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + name) || a.removeAttribute('aria-current'));
  document.querySelectorAll('#nav a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
  try { await v(arg); } catch (e) { main.innerHTML = `<div class="card" role="alert">Could not load: ${esc(e.message)}</div>`; }
  document.title = `CivicResolve · ${name}`;
}
addEventListener('hashchange', () => { route(); main.focus(); window.scrollTo(0, 0); });
api('/config').then(c => { config = c; }).finally(route);
