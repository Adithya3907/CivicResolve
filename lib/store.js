'use strict';
const fs = require('fs'), path = require('path');
const FILE = () => process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'issues.json');
let issues = new Map(), timer;
const ago = h => new Date(Date.now() - h * 36e5).toISOString();
const SLA = { Critical: 24, High: 72, Medium: 168, Low: 336 };
function seed() {
  const mk = (id, title, category, priority, department, status, hrs, lat, lng, loc, impact) => ({
    id, title, description: title + ' reported by residents in the area.', location: loc, lat, lng, name: 'Demo citizen', image: '',
    category, priority, department, publicImpact: impact, confidence: 0.9, summary: title, suggestedAction: 'Dispatch field team.', reasoning: 'Seed data', language: 'en', source: 'seed', supporters: 1,
    createdAt: ago(hrs), dueAt: new Date(Date.now() - hrs * 36e5 + SLA[priority] * 36e5).toISOString(), status,
    timeline: [{ status: 'Reported', at: ago(hrs), note: 'Complaint received and triaged by AI' }].concat(status !== 'Reported' ? [{ status: 'In Progress', at: ago(hrs / 2), note: 'Crew assigned' }] : [], status === 'Resolved' ? [{ status: 'Resolved', at: ago(1), note: 'Fixed and verified' }] : [])
  });
  return [
    mk('CR-1A2B3C', 'Deep pothole near bus stop', 'Roads & Potholes', 'High', 'Public Works Department', 'In Progress', 30, 11.0252, 76.9961, 'Avinashi Road, Coimbatore', 7),
    mk('CR-4D5E6F', 'Open manhole on school route', 'Water & Drainage', 'Critical', 'Water Supply & Drainage Board', 'Reported', 5, 11.0183, 76.9725, 'RS Puram, Coimbatore', 10),
    mk('CR-7A8B9C', 'Streetlight not working for a week', 'Streetlights & Electrical', 'Medium', 'Electricity Board', 'Resolved', 60, 11.0067, 76.9558, 'Race Course Road, Coimbatore', 5),
    mk('CR-0D1E2F', 'Overflowing garbage bin', 'Garbage & Sanitation', 'High', 'Solid Waste Management', 'Reported', 14, 11.0305, 76.9427, 'Saibaba Colony, Coimbatore', 6)
  ];
}
function load() {
  let list;
  try { list = JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { list = seed(); }
  issues = new Map(list.map(i => [i.id, i]));
}
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { fs.mkdirSync(path.dirname(FILE()), { recursive: true }); fs.writeFileSync(FILE(), JSON.stringify([...issues.values()])); } catch (e) { console.warn('persist failed', e.message); } }, 300);
  timer.unref();
}
module.exports = { load, all: () => [...issues.values()], get: id => issues.get(id), set: i => { issues.set(i.id, i); save(); } };
