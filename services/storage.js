'use strict';
/**
 * @file services/storage.js
 * Google Cloud Storage abstraction for image uploads.
 * Generates signed URLs for uploads and viewing, with local fallback for dev/emulator.
 */

const { getBucket, IS_EMULATOR, isMemoryMode, PROJECT_ID, BUCKET_NAME } = require('../config/firebase-admin');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');

// Ensure local upload dir exists for dev/test fallback
if (IS_EMULATOR || isMemoryMode()) {
  try {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  } catch { /* ignore */ }
}

/**
 * Validate image MIME type and file extension.
 * @param {string} mimeType
 * @returns {boolean}
 */
function isValidImageType(mimeType) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  return allowed.includes(mimeType.toLowerCase());
}

/**
 * Generate a unique object path for an image.
 * @param {string} reportId
 * @param {string} filename
 * @returns {string}
 */
function generateObjectPath(reportId, filename = 'photo.jpg') {
  const ext = path.extname(filename) || '.jpg';
  const rand = crypto.randomBytes(8).toString('hex');
  return `reports/${reportId}/${Date.now()}-${rand}${ext}`;
}

/**
 * Generate a signed upload URL (PUT) for Google Cloud Storage.
 * @param {string} reportId
 * @param {string} mimeType
 * @param {string} [filename]
 * @returns {Promise<{ uploadUrl: string, objectPath: string }>}
 */
async function getSignedUploadUrl(reportId, mimeType, filename) {
  if (!isValidImageType(mimeType)) {
    throw new Error(`Invalid image type: ${mimeType}. Allowed: JPEG, PNG, WebP, HEIC.`);
  }

  const objectPath = generateObjectPath(reportId, filename);

  // If in emulator or test memory mode without real credentials
  if ((IS_EMULATOR || isMemoryMode()) && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_PRIVATE_KEY) {
    // Local dev endpoint
    return {
      uploadUrl: `/api/reports/${reportId}/images/upload-direct?path=${encodeURIComponent(objectPath)}`,
      objectPath
    };
  }

  try {
    const bucket = getBucket();
    const file = bucket.file(objectPath);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: mimeType
    });
    return { uploadUrl, objectPath };
  } catch (err) {
    console.warn('[storage] getSignedUrl failed, falling back to direct upload URL:', err.message);
    return {
      uploadUrl: `/api/reports/${reportId}/images/upload-direct?path=${encodeURIComponent(objectPath)}`,
      objectPath
    };
  }
}

/**
 * Generate a signed read URL for staff to view an image.
 * @param {string} objectPath
 * @returns {Promise<string>}
 */
async function getSignedReadUrl(objectPath) {
  if (!objectPath) return '';
  if (objectPath.startsWith('data:image/') || objectPath.startsWith('http://') || objectPath.startsWith('https://')) {
    return objectPath;
  }

  if ((IS_EMULATOR || isMemoryMode()) && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_PRIVATE_KEY) {
    return `/api/reports/images/view?path=${encodeURIComponent(objectPath)}`;
  }

  try {
    const bucket = getBucket();
    const file = bucket.file(objectPath);
    const [readUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000 // 1 hour
    });
    return readUrl;
  } catch (err) {
    return `/api/reports/images/view?path=${encodeURIComponent(objectPath)}`;
  }
}

/**
 * Validate magic bytes for image buffer.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function validateMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WebP: RIFF ... WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
  return false;
}

module.exports = {
  isValidImageType,
  generateObjectPath,
  getSignedUploadUrl,
  getSignedReadUrl,
  validateMagicBytes,
  LOCAL_UPLOAD_DIR
};
