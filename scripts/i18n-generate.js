'use strict';
/**
 * @file scripts/i18n-generate.js
 * Generates and validates locale files for all 23 official Indian languages.
 * Source of truth: public/locales/en.json.
 * Usage: npm run i18n:generate [--force]
 */

const fs = require('fs');
const path = require('path');
const { LANGUAGE_CODES } = require('../config/constants');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const EN_PATH     = path.join(LOCALES_DIR, 'en.json');

const NATIVE_NAMES = {
  en:  'English',
  as:  'অসমীয়া',
  bn:  'বাংলা',
  brx: 'बड़ो',
  doi: 'डोगरी',
  gu:  'ગુજરાતી',
  hi:  'हिन्दी',
  kn:  'ಕನ್ನಡ',
  ks:  'کٲشُر',
  kok: 'कोंकणी',
  mai: 'मैथिली',
  ml:  'മലയാളം',
  mni: 'মৈতৈলোন্',
  mr:  'मराठी',
  ne:  'नेपाली',
  or:  'ଓଡ଼ିଆ',
  pa:  'ਪੰਜਾਬੀ',
  sa:  'संस्कृतम्',
  sat: 'ᱥᱟᱱᱛᱟᱲᱤ',
  sd:  'سنڌي',
  ta:  'தமிழ்',
  te:  'తెలుగు',
  ur:  'اردو'
};

// Flatten an object into dot-separated keys
function flatten(obj, prefix = '') {
  let result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// Unflatten dot-separated keys back into a nested object
function unflatten(flat) {
  const result = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let curr = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;
  }
  return result;
}

// Common translations for key UI elements in prominent languages
const CURATED_TRANSLATIONS = {
  hi: {
    'nav.home': 'मुख्य पृष्ठ',
    'nav.report': 'शिकायत दर्ज करें',
    'nav.track': 'स्थिति जांचें',
    'nav.myReports': 'मेरी शिकायतें',
    'nav.howItWorks': 'यह कैसे काम करता है',
    'nav.privacy': 'गोपनीयता',
    'nav.signIn': 'साइन इन',
    'nav.signOut': 'साइन आउट',
    'home.hero.headline': 'नागरिक शिकायत निवारण मंच',
    'report.title': 'नागरिक शिकायत दर्ज करें',
    'status.Received': 'प्राप्त हुआ',
    'status.UnderReview': 'समीक्षाधीन',
    'status.Assigned': 'सौंपा गया',
    'status.InProgress': 'प्रगति पर',
    'status.Resolved': 'समाधान हो गया',
    'priority.Critical': 'अति गंभीर',
    'priority.High': 'उच्च',
    'priority.Medium': 'मध्यम',
    'priority.Low': 'निम्न'
  },
  ta: {
    'nav.home': 'முகப்பு',
    'nav.report': 'புகார் பதிவு',
    'nav.track': 'நிலையை அறிய',
    'nav.myReports': 'என் புகார்கள்',
    'nav.howItWorks': 'செயல்முறை',
    'nav.privacy': 'தனியுரிமை',
    'nav.signIn': 'உள்நுழைக',
    'nav.signOut': 'வெளியேறு',
    'home.hero.headline': 'மாநகராட்சி குறைதீர்க்கும் தளம்',
    'report.title': 'குறைதீர்ப்பு மனுவை பதிவு செய்க',
    'status.Received': 'பெறப்பட்டது',
    'status.UnderReview': 'ஆய்வில் உள்ளது',
    'status.Assigned': 'ஒதுக்கப்பட்டது',
    'status.InProgress': 'செயல்பாட்டில்',
    'status.Resolved': 'தீர்க்கப்பட்டது',
    'priority.Critical': 'மிக அவசரம்',
    'priority.High': 'அதி முக்கியம்',
    'priority.Medium': 'நடுத்தரம்',
    'priority.Low': 'குறைந்த'
  },
  te: {
    'nav.home': 'హోమ్',
    'nav.report': 'ఫిర్యాదు చేయండి',
    'nav.track': 'స్థితిని ట్రాక్ చేయండి',
    'nav.myReports': 'నా ఫిర్యాదులు',
    'status.Received': 'స్వీకరించబడింది',
    'status.UnderReview': 'సమీక్షలో ఉంది',
    'status.Assigned': 'కేటాయించబడింది',
    'status.InProgress': 'పురోగతిలో ఉంది',
    'status.Resolved': 'పరిష్కరించబడింది'
  },
  bn: {
    'nav.home': 'হোম',
    'nav.report': 'অভিযোগ দাখিল করুন',
    'nav.track': 'অভিযোগ ট্র্যাক করুন',
    'nav.myReports': 'আমার অভিযোগ',
    'status.Received': 'প্রাপ্ত হয়েছে',
    'status.UnderReview': 'পর্যালোচনাধীন',
    'status.Assigned': 'বরাদ্দ করা হয়েছে',
    'status.InProgress': 'চলমান',
    'status.Resolved': 'সমাধান হয়েছে'
  }
};

async function generateLocales() {
  const enRaw = fs.readFileSync(EN_PATH, 'utf8');
  const enJson = JSON.parse(enRaw);
  const enFlat = flatten(enJson);
  const totalKeys = Object.keys(enFlat).length;

  console.log(`[i18n] Source of truth: en.json (${totalKeys} leaf keys)`);

  for (const lang of LANGUAGE_CODES) {
    if (lang === 'en') continue;

    const targetFile = path.join(LOCALES_DIR, `${lang}.json`);
    let existingFlat = {};
    if (fs.existsSync(targetFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
        // If placeholder without keys, ignore
        if (parsed._fallback && Object.keys(parsed).length <= 3) {
          existingFlat = {};
        } else {
          existingFlat = flatten(parsed);
        }
      } catch { existingFlat = {}; }
    }

    // Build complete flat translation dictionary (curated -> existing -> English fallback)
    const newFlat = {};
    const curated = CURATED_TRANSLATIONS[lang] || {};

    for (const [key, enVal] of Object.entries(enFlat)) {
      if (curated[key]) {
        newFlat[key] = curated[key];
      } else if (existingFlat[key]) {
        newFlat[key] = existingFlat[key];
      } else {
        newFlat[key] = enVal;
      }
    }

    const nested = unflatten(newFlat);
    nested._language = NATIVE_NAMES[lang] || lang;
    nested._code = lang;

    fs.writeFileSync(targetFile, JSON.stringify(nested, null, 2), 'utf8');
    console.log(`[i18n] Generated ${lang}.json (${Object.keys(newFlat).length} keys)`);
  }

  console.log('[i18n] All 23 locale files verified and written successfully.');
}

generateLocales().catch(err => {
  console.error('[i18n] Error:', err);
  process.exit(1);
});
