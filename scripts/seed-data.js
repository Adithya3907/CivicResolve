'use strict';
/**
 * @file scripts/seed-data.js
 * Seed realistic civic grievances in multiple Indian languages across departments.
 * Usage: npm run seed:data
 */

if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch { /* ignore */ }
}

const { init: initFirebase } = require('../config/firebase-admin');
const store = require('../services/store');
const { computeDueAt } = require('../config/constants');

const ago = h => new Date(Date.now() - h * 3600000).toISOString();

const SEED_REPORTS = [
  {
    id: 'CR-1A2B3C',
    title: 'Deep pothole near central bus stop',
    description: 'A deep crater-like pothole has formed in front of the bus shelter on the main arterial corridor. Two two-wheelers have slipped today.',
    location: 'Avinashi Road, Near Hope College, Coimbatore',
    category: 'Roads & Potholes',
    priority: 'High',
    department: 'Public Works Department',
    lat: 11.0252,
    lng: 76.9961,
    ward: 'Ward 12',
    language: 'en',
    status: 'In Progress',
    supporters: 18,
    imagePaths: [],
    createdAt: ago(28),
    dueAt: new Date(Date.now() - 28 * 36e5 + 72 * 36e5).toISOString(),
    timeline: [
      { status: 'Received', at: ago(28), note: 'Complaint received and registered.' },
      { status: 'Under Review', at: ago(24), note: 'Categorized under High Priority road infrastructure hazard.' },
      { status: 'Assigned', at: ago(18), note: 'Assigned to East Zone PWD road maintenance unit.' },
      { status: 'In Progress', at: ago(8), note: 'Cold mix patch material dispatched to site.' }
    ]
  },
  {
    id: 'CR-4D5E6F',
    title: 'பள்ளி அருகே திறந்திருக்கும் பாதாள சாக்கடை மூடி',
    description: 'RS புரம் பள்ளிக்கு செல்லும் வழியில் பாதாள சாக்கடை மூடி உடைந்து ஆபத்தான நிலையில் உள்ளது. குழந்தைகள் தவறி விழ வாய்ப்புள்ளது.',
    location: 'டி.பி. ரோடு, ஆர்.எஸ். புரம், கோயம்புத்தூர்',
    category: 'Water & Drainage',
    priority: 'Critical',
    department: 'Water Supply & Drainage Board',
    lat: 11.0183,
    lng: 76.9725,
    ward: 'Ward 08',
    language: 'ta',
    status: 'Under Review',
    supporters: 32,
    imagePaths: [],
    createdAt: ago(4),
    dueAt: new Date(Date.now() - 4 * 36e5 + 24 * 36e5).toISOString(),
    timeline: [
      { status: 'Received', at: ago(4), note: 'Grievance submitted by local resident in Tamil.' },
      { status: 'Under Review', at: ago(2), note: 'Classified as Critical life hazard. Emergency replacement slab ordered.' }
    ]
  },
  {
    id: 'CR-7A8B9C',
    title: 'कचरा पात्र से बाहर फैला कूड़ा और बदबू',
    description: 'पिछले चार दिनों से मुख्य बाजार के पास स्थित कूड़ेदान से कचरा नहीं उठाया गया है। सड़क पर कचरा फैलने से गंभीर दुर्गंध और स्वास्थ्य संकट है।',
    location: 'साईबाबा कॉलोनी, 2nd क्रॉस, कोयंबटूर',
    category: 'Garbage & Sanitation',
    priority: 'High',
    department: 'Solid Waste Management',
    lat: 11.0305,
    lng: 76.9427,
    ward: 'Ward 22',
    language: 'hi',
    status: 'Assigned',
    supporters: 14,
    imagePaths: [],
    createdAt: ago(16),
    dueAt: new Date(Date.now() - 16 * 36e5 + 72 * 36e5).toISOString(),
    timeline: [
      { status: 'Received', at: ago(16), note: 'Grievance registered in Hindi.' },
      { status: 'Assigned', at: ago(10), note: 'Sanitation supervisor Ward 22 allocated for compactor clearing.' }
    ]
  },
  {
    id: 'CR-0D1E2F',
    title: 'Streetlights unlit across residential layout',
    description: 'Entire row of 6 sodium-vapor street lamps unlit for past week. Pedestrians unable to walk safely after sunset.',
    location: 'Race Course Road, Near Thomas Park, Coimbatore',
    category: 'Streetlights & Electrical',
    priority: 'Medium',
    department: 'Electricity Board',
    lat: 11.0067,
    lng: 76.9558,
    ward: 'Ward 15',
    language: 'en',
    status: 'Resolved',
    supporters: 8,
    imagePaths: [],
    createdAt: ago(56),
    dueAt: new Date(Date.now() - 56 * 36e5 + 168 * 36e5).toISOString(),
    timeline: [
      { status: 'Received', at: ago(56), note: 'Report logged.' },
      { status: 'Assigned', at: ago(40), note: 'Assigned to electrical lineman.' },
      { status: 'In Progress', at: ago(20), note: 'Feeder pillar switch inspected and repaired.' },
      { status: 'Resolved', at: ago(2), note: 'All lamps verified operational by ward supervisor.' }
    ]
  },
  {
    id: 'CR-3F8E1A',
    title: 'రహదారి పై పడిపోయిన పెద్ద చెట్టు కొమ్మ',
    description: 'నిన్న రాత్రి కురిసిన వర్షానికి భారీ చెట్టు కొమ్మ రోడ్డుపై పడి రాకపోకలకు తీవ్ర అంతరాయం కలిగిస్తోంది.',
    location: 'గాంధీపురం మెయిన్ రోడ్, కోయంబత్తూరు',
    category: 'Parks & Trees',
    priority: 'High',
    department: 'Parks & Horticulture',
    lat: 11.0168,
    lng: 76.9678,
    ward: 'Ward 10',
    language: 'te',
    status: 'In Progress',
    supporters: 21,
    imagePaths: [],
    createdAt: ago(10),
    dueAt: new Date(Date.now() - 10 * 36e5 + 72 * 36e5).toISOString(),
    timeline: [
      { status: 'Received', at: ago(10), note: 'Grievance registered in Telugu.' },
      { status: 'In Progress', at: ago(4), note: 'Tree clearance squad with power saw on-site.' }
    ]
  }
];

async function seedData() {
  initFirebase();
  console.log('[seed-data] Seeding realistic municipal grievances…');

  for (const report of SEED_REPORTS) {
    await store.createReport(report);
    console.log(`[seed-data] Inserted ${report.id} (${report.priority} - ${report.language})`);
  }

  console.log('[seed-data] Seeding complete!');
  process.exit(0);
}

seedData().catch(err => {
  console.error('[seed-data] Failed:', err);
  process.exit(1);
});
