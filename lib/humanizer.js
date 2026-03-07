/**
 * humanizer.js - AI Humanization Engine for Humanify AI
 *
 * Uses Puter.js (free, no API key) to rewrite text to sound human-written.
 */

/** Patterns that identify a Puter API gateway / maintenance outage. */
const GATEWAY_ERROR_PATTERNS = [
  /we'?ll be right back/i,
  /upgrading our services/i,
  /service\s+unavailable/i,
  /bad\s+gateway/i,
  /gateway\s+timeout/i,
  /\b50[234]\b/,
];

/**
 * Return true if the error looks like a Puter gateway / maintenance outage.
 * @param {Error} err
 * @returns {boolean}
 */
function isGatewayError(err) {
  if (!err) return false;
  if (err.isGatewayError) return true;
  const msg = err.message || '';
  return GATEWAY_ERROR_PATTERNS.some(p => p.test(msg));
}

const AGGRESSIVENESS_LEVELS = {
  light: {
    label: 'Light',
    description: 'Minimal changes — fix obvious AI patterns while preserving style',
  },
  medium: {
    label: 'Medium',
    description: 'Balanced — vary structure, add contractions, improve natural flow',
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Thorough rewrite — dramatic style changes, strong personal voice',
  },
};

/**
 * Build the humanization prompt.
 * @param {string} text
 * @param {string} level - 'light' | 'medium' | 'aggressive'
 * @returns {string}
 */
function buildHumanizationPrompt(text, level) {
  const levelDesc = AGGRESSIVENESS_LEVELS[level]?.description || AGGRESSIVENESS_LEVELS.medium.description;
  return `Rewrite the following text to sound 100% human-written and undetectable by AI detectors.
Aggressiveness level: ${level.toUpperCase()} — ${levelDesc}

Rules:
- Vary sentence lengths dramatically (mix 5-word sentences with 25+ word ones)
- Use contractions naturally (don't, won't, it's, they're)
- Add occasional colloquialisms and informal transitions (sure, look, honestly, basically)
- Include subtle imperfections that humans naturally make
- Use diverse vocabulary; avoid AI-typical words (delve, landscape, moreover, furthermore, utilize, leverage, synergy, paradigm, robust, seamless, transformative, holistic, multifaceted)
- Add personal voice and occasional hedging (I think, probably, kind of, pretty much)
- Break overly structured paragraph patterns
- Use varied sentence starters (not all "The", "This", "It")
- Maintain ALL original meaning and key information
- Do NOT add new facts or remove important content
- Return ONLY the rewritten text, no explanations or commentary

TEXT TO REWRITE:
${text}`;
}

/**
 * Humanize text using Puter.js AI.
 * @param {string} text
 * @param {{ level?: string, model?: string, onProgress?: Function }} options
 * @returns {Promise<string>}
 */
async function humanize(text, options = {}) {
  const { level = 'medium', model = 'gpt-4o-mini', onProgress } = options;

  if (!text || !text.trim()) return text;

  const prompt = buildHumanizationPrompt(text, level);

  try {
    if (typeof puter === 'undefined' || !puter.ai || puter.__isStub) {
      throw new Error('Puter.js AI service is not available. Please check your connection.');
    }

    if (onProgress) onProgress({ stage: 'calling_ai', progress: 20 });

    const response = await puter.ai.chat(prompt, { model });
    if (onProgress) onProgress({ stage: 'processing', progress: 80 });

    const result = typeof response === 'string'
      ? response
      : (response.message?.content || response.content || text);

    if (onProgress) onProgress({ stage: 'complete', progress: 100 });
    return result.trim();
  } catch (err) {
    console.error('Humanization failed:', err);
    if (isGatewayError(err)) {
      const outageErr = new Error(
        'Humanize AI is temporarily unavailable due to maintenance. Please try again later.'
      );
      outageErr.isGatewayError = true;
      throw outageErr;
    }
    throw new Error('Humanization failed: ' + (err.message || 'Unknown error'));
  }
}

/**
 * Humanize only the flagged (AI-detected) sentences.
 * @param {string} fullText - complete document text
 * @param {Array} sentences - array of sentence objects with score property
 * @param {{ level?: string, model?: string, onProgress?: Function }} options
 * @returns {Promise<string>} - full text with flagged sentences replaced
 */
async function humanizeFlagged(fullText, sentences, options = {}) {
  const { level = 'medium', model = 'gpt-4o-mini', onProgress } = options;
  const flagged = sentences.filter(s => s.score < 80);

  if (!flagged.length) return fullText;

  // Build a single prompt for all flagged sentences to minimize API calls
  const flaggedText = flagged.map((s, i) => `[${i + 1}] ${s.text}`).join('\n');
  const prompt = `Rewrite ONLY the numbered sentences below to sound human-written.
Aggressiveness: ${level.toUpperCase()}
Rules: vary lengths, use contractions, add natural voice, avoid AI phrases, maintain meaning.
Return ONLY the rewritten sentences in the same numbered format: [1] rewritten text\n[2] rewritten text etc.

SENTENCES TO REWRITE:
${flaggedText}`;

  try {
    if (typeof puter === 'undefined' || !puter.ai || puter.__isStub) {
      throw new Error('Puter.js AI service is not available. Please check your connection.');
    }

    if (onProgress) onProgress({ stage: 'calling_ai', progress: 20 });
    const response = await puter.ai.chat(prompt, { model });
    const raw = typeof response === 'string'
      ? response
      : (response.message?.content || response.content || '');

    if (onProgress) onProgress({ stage: 'processing', progress: 70 });

    // Parse numbered responses
    const rewritten = {};
    const matches = raw.matchAll(/\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g);
    for (const match of matches) {
      const idx = parseInt(match[1]) - 1;
      if (idx >= 0 && idx < flagged.length) {
        rewritten[flagged[idx].text] = match[2].trim();
      }
    }

    // Replace flagged sentences in full text
    let result = fullText;
    for (const [original, replacement] of Object.entries(rewritten)) {
      if (replacement) {
        result = result.replace(original, replacement);
      }
    }

    if (onProgress) onProgress({ stage: 'complete', progress: 100 });
    return result;
  } catch (err) {
    console.error('Partial humanization failed:', err);
    if (isGatewayError(err)) {
      const outageErr = new Error(
        'Humanize AI is temporarily unavailable due to maintenance. Please try again later.'
      );
      outageErr.isGatewayError = true;
      throw outageErr;
    }
    throw new Error('Humanization failed: ' + (err.message || 'Unknown error'));
  }
}

/**
 * Humanize selected text only.
 * @param {string} selectedText
 * @param {{ level?: string, model?: string }} options
 * @returns {Promise<string>}
 */
async function humanizeSelected(selectedText, options = {}) {
  return humanize(selectedText, options);
}

// Expose globally for extension context
if (typeof window !== 'undefined') {
  window.HumanifyHumanizer = {
    humanize,
    humanizeFlagged,
    humanizeSelected,
    AGGRESSIVENESS_LEVELS,
    isGatewayError,
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { humanize, humanizeFlagged, humanizeSelected, AGGRESSIVENESS_LEVELS, isGatewayError };
}
