'use strict';
/**
 * @file services/queue.js
 * Background job queue.
 * In prod (CLOUD_TASKS_QUEUE set): submit to Cloud Tasks.
 * In dev: run job in background with setImmediate, retry up to 3x with exponential backoff.
 */

const IN_PROD = !!process.env.CLOUD_TASKS_QUEUE;

// Job handler registry (populated by services that need to handle jobs)
const handlers = new Map();

/**
 * Register a job handler function for a job type.
 * @param {string} jobType
 * @param {Function} handler - async (payload) => void
 */
function registerHandler(jobType, handler) {
  handlers.set(jobType, handler);
}

/**
 * Run a job in-process with retry (dev mode).
 * @param {string} jobType
 * @param {Object} payload
 * @param {number} attempt
 */
async function runLocal(jobType, payload, attempt = 1) {
  const handler = handlers.get(jobType);
  if (!handler) {
    console.warn(`[queue] No handler registered for job type: ${jobType}`);
    return;
  }
  try {
    await handler(payload);
  } catch (err) {
    if (attempt >= 3) {
      console.error(`[queue] Job ${jobType} failed after 3 attempts:`, err.message);
      return;
    }
    const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
    console.warn(`[queue] Job ${jobType} failed (attempt ${attempt}), retrying in ${delay}ms:`, err.message);
    setTimeout(() => runLocal(jobType, payload, attempt + 1), delay);
  }
}

/**
 * Submit a job to Cloud Tasks (prod).
 * @param {string} jobType
 * @param {Object} payload
 */
async function submitToCloudTasks(jobType, payload) {
  const { CloudTasksClient } = require('@google-cloud/tasks');
  const client = new CloudTasksClient();
  const queue  = process.env.CLOUD_TASKS_QUEUE;
  const url    = process.env.CLOUD_TASKS_HANDLER_URL || `${process.env.SERVICE_URL}/api/tasks/run`;

  const task = {
    httpRequest: {
      httpMethod: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ jobType, payload })).toString('base64'),
      oidcToken: { serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL }
    }
  };

  try {
    await client.createTask({ parent: queue, task });
  } catch (err) {
    console.error('[queue] Cloud Tasks submission failed:', err.message);
    // Fallback to local execution
    setImmediate(() => runLocal(jobType, payload));
  }
}

/**
 * Enqueue a background job.
 * @param {'triage'|'embeddings'|'notify'} jobType
 * @param {Object} payload
 * @returns {Promise<void>}
 */
async function enqueue(jobType, payload) {
  if (IN_PROD) {
    await submitToCloudTasks(jobType, payload);
  } else {
    setImmediate(() => runLocal(jobType, payload));
  }
}

module.exports = { enqueue, registerHandler };
