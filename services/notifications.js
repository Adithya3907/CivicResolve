'use strict';
/**
 * @file services/notifications.js
 * Status-change notifications for citizens.
 * Generates plain-language messages via Gemini in the citizen's chosen language.
 */

const { getTranslationCache, setTranslationCache } = require('./store');

/**
 * Generate and cache a status update message.
 * @param {Object} report - full report object
 * @param {string} targetLang - BCP-47 language code (e.g. 'ta', 'hi', 'en')
 * @returns {Promise<{ text: string, source: 'gemini'|'cache'|'template' }>}
 */
async function generateStatusMessage(report, targetLang = 'en') {
  const cacheKey = `${report.id}:${report.status}:${targetLang}`;
  const cached = await getTranslationCache(cacheKey);
  if (cached) return { text: cached, source: 'cache' };

  const { translateNotification } = require('./ai');
  const timeline = report.timeline || [];
  const lastNote = timeline.length ? timeline[timeline.length - 1].note : 'Status updated.';
  const text = await translateNotification(
    `Your report (${report.id}) is now "${report.status}". ${lastNote}`,
    targetLang,
    report.id,
    report.status
  );

  await setTranslationCache(cacheKey, text);
  return { text, source: 'gemini' };
}

/**
 * Send a push/email notification (stub — extend later).
 * @param {string} uid
 * @param {string} message
 * @returns {Promise<void>}
 */
async function sendPushNotification(uid, message) {
  // TODO: integrate Firebase Cloud Messaging or email provider
  console.log(`[notify] uid=${uid} message="${message.slice(0, 60)}"`);
}

module.exports = { generateStatusMessage, sendPushNotification };
