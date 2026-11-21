'use strict';
const CATEGORIES = ['Roads & Potholes', 'Garbage & Sanitation', 'Streetlights & Electrical', 'Water & Drainage', 'Parks & Trees', 'Traffic & Signals', 'Other'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['Reported', 'In Progress', 'Resolved'];
const DEPARTMENTS = {
  'Roads & Potholes': 'Public Works Department',
  'Garbage & Sanitation': 'Solid Waste Management',
  'Streetlights & Electrical': 'Electricity Board',
  'Water & Drainage': 'Water Supply & Drainage Board',
  'Parks & Trees': 'Parks & Horticulture',
  'Traffic & Signals': 'Traffic Police',
  Other: 'Municipal Helpline'
};
const SLA_HOURS = { Critical: 24, High: 72, Medium: 168, Low: 336 };
const RULES = [
  ['Roads & Potholes', /pothole|road|crack|asphalt|footpath|pavement|bridge|speed ?breaker/i],
  ['Garbage & Sanitation', /garbage|trash|waste|dustbin|bin|litter|dump|stink/i],
  ['Streetlights & Electrical', /street ?light|lamp|electric|wire|pole|transformer|power|dark/i],
  ['Water & Drainage', /water|leak|pipe|drain|sewer|manhole|flood|overflow|tap/i],
  ['Parks & Trees', /park|tree|branch|garden|playground/i],
  ['Traffic & Signals', /traffic|signal|junction|parking|jam|zebra/i]
];
const URGENT = /open manhole|live wire|fallen (wire|pole|tree)|flood|accident|collapsed|gas leak|fire|injur|hospital|school|child|elderly|sparking/i;
const HIGH = /overflow|burst|blocked|no water|sewage|hazard|danger|night|main road|highway/i;

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const num = (v, lo, hi) => (v !== '' && v !== null && v !== undefined && Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : null);

function validate(b = {}, preview = false) {
  const v = {
    title: clean(b.title, 120), description: clean(b.description, 2000), location: clean(b.location, 200),
    category: CATEGORIES.includes(b.category) ? b.category : '', name: clean(b.name, 60),
    lat: num(b.lat, -90, 90), lng: num(b.lng, -180, 180), image: ''
  };
  if (v.title.length < 3) return { error: 'Title must be at least 3 characters.' };
  if (v.description.length < 10) return { error: 'Please describe the issue in at least 10 characters.' };
  if (!preview && v.location.length < 3) return { error: 'Location is required.' };
  if (b.image) {
    if (typeof b.image !== 'string' || b.image.length > 1_500_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image)) return { error: 'Image must be a JPEG/PNG/WebP under ~1MB.' };
    v.image = b.image;
  }
  return { value: v };
}

function fallbackAnalyze(v) {
  const text = `${v.title} ${v.description}`;
  const hit = RULES.find(([, re]) => re.test(text));
  const category = v.category || (hit ? hit[0] : 'Other');
  const priority = URGENT.test(text) ? 'Critical' : HIGH.test(text) ? 'High' : /small|minor|paint|faded/i.test(text) ? 'Low' : 'Medium';
  return { category, priority, confidence: hit ? 0.6 : 0.3, publicImpact: { Critical: 9, High: 7, Medium: 5, Low: 2 }[priority], summary: clean(v.title, 100), suggestedAction: 'Dispatch field team to inspect and report.', reasoning: 'Keyword-based triage (AI unavailable).', language: 'en', source: 'rules' };
}

function normalize(a, v) {
  const category = CATEGORIES.includes(a.category) ? a.category : v.category || 'Other';
  const priority = PRIORITIES.includes(a.priority) ? a.priority : 'Medium';
  return {
    category, priority, department: DEPARTMENTS[category],
    confidence: Math.min(1, Math.max(0, Number(a.confidence) || 0)),
    publicImpact: Math.min(10, Math.max(1, Math.round(Number(a.publicImpact) || 5))),
    summary: clean(a.summary, 160), suggestedAction: clean(a.suggestedAction, 240),
    reasoning: clean(a.reasoning, 300), language: clean(a.language, 20) || 'en', source: a.source || 'gemini'
  };
}

const distM = (a, b, c, d) => {
  const R = 6371000, r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r;
  return Math.hypot(x, y) * R;
};
module.exports = { CATEGORIES, PRIORITIES, STATUSES, DEPARTMENTS, SLA_HOURS, validate, fallbackAnalyze, normalize, distM, clean };
