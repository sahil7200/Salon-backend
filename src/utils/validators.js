const mongoose = require('mongoose');

/**
 * Centralized input validation utilities (§25, §26, §45, §76).
 * Used by controllers to validate inputs before processing.
 */

/**
 * Validate YYYY-MM-DD date string. Rejects invalid/impossible dates (§25).
 */
const isValidDateString = (str) => {
  if (!str || typeof str !== 'string') return false;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

/**
 * Validate HH:mm time string (24h, strict) (§26).
 */
const isValidTimeString = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(str);
};

/**
 * Validate MongoDB ObjectId string.
 */
const isValidObjectId = (str) => {
  return mongoose.Types.ObjectId.isValid(str) && String(new mongoose.Types.ObjectId(str)) === str;
};

/**
 * Extract only permitted fields from req.body (§72 mass assignment protection).
 * @param {Object} body - req.body
 * @param {string[]} allowedFields - list of permitted field names
 * @returns {Object} sanitized object containing only allowed keys
 */
const sanitizeFields = (body, allowedFields) => {
  const sanitized = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      sanitized[field] = body[field];
    }
  }
  return sanitized;
};

/**
 * Validate that a string is within acceptable length limits (§76).
 */
const isWithinLength = (str, min = 1, max = 500) => {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  return trimmed.length >= min && trimmed.length <= max;
};

module.exports = {
  isValidDateString,
  isValidTimeString,
  isValidObjectId,
  sanitizeFields,
  isWithinLength,
};
