/**
 * utils.js - Shared utilities for Humanify AI
 */

/**
 * Split text into sentences using a robust sentence splitter.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoSentences(text) {
  if (!text || !text.trim()) return [];
  // Split on sentence-ending punctuation followed by whitespace/end
  const raw = text.match(/[^.!?]*[.!?]+(\s|$)|[^.!?]+$/g) || [];
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Split text into words (lowercase, stripped of punctuation).
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return (text.toLowerCase().match(/\b[a-z']+\b/g) || []);
}

/**
 * Compute the type-token ratio (vocabulary richness).
 * @param {string[]} tokens
 * @returns {number} 0–1
 */
function typeTokenRatio(tokens) {
  if (!tokens.length) return 0;
  const unique = new Set(tokens);
  return unique.size / tokens.length;
}

/**
 * Clamp a number between min and max.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Format a score (0–100) as a colour class.
 * @param {number} score percentage human (0–100)
 * @returns {'green'|'yellow'|'red'}
 */
function scoreToColor(score) {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

/**
 * Format a score for display.
 * @param {number} score 0–100
 * @returns {string}
 */
function formatScore(score) {
  return Math.round(score) + '%';
}

/**
 * Get a human-readable label for a score.
 */
function scoreLabel(score) {
  if (score >= 80) return 'Human';
  if (score >= 50) return 'Suspicious';
  return 'AI-Generated';
}

/**
 * Deep merge two plain objects.
 */
function deepMerge(target, source) {
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Load settings from Chrome storage.
 * @returns {Promise<Object>}
 */
async function loadSettings() {
  const defaults = {
    model: 'gpt-4o-mini',
    sensitivity: 50,
    humanizationStyle: 'medium',
    theme: 'dark',
    useAIAnalysis: true,
  };
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(defaults, items => resolve(items));
    } else {
      resolve(defaults);
    }
  });
}

/**
 * Save settings to Chrome storage.
 * @param {Object} settings
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set(settings, resolve);
    } else {
      resolve();
    }
  });
}

/**
 * Truncate text to a maximum number of characters, adding ellipsis.
 */
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate a unique ID.
 */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Expose globally for extension context
if (typeof window !== 'undefined') {
  window.HumanifyUtils = {
    splitIntoSentences,
    tokenize,
    typeTokenRatio,
    clamp,
    lerp,
    scoreToColor,
    formatScore,
    scoreLabel,
    deepMerge,
    loadSettings,
    saveSettings,
    truncate,
    escapeHtml,
    uid,
  };
}

// Export for both module and browser contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    splitIntoSentences,
    tokenize,
    typeTokenRatio,
    clamp,
    lerp,
    scoreToColor,
    formatScore,
    scoreLabel,
    deepMerge,
    loadSettings,
    saveSettings,
    truncate,
    escapeHtml,
    uid,
  };
}
