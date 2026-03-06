/**
 * detector.js - AI Detection Engine for Humanify AI
 *
 * Performs local heuristic analysis and optionally deep AI analysis via Puter.js.
 */

// AI-typical transitional phrases and buzzwords
const AI_PHRASES = [
  'moreover', 'furthermore', 'additionally', 'in conclusion', 'in summary',
  'it is important to note', "it's important to note", 'it is worth noting',
  "it's worth noting", 'delve', 'delves', 'delving', 'landscape', 'arguably',
  'undoubtedly', 'certainly', 'notably', 'importantly', 'significantly',
  'in the realm of', 'it is crucial', "it's crucial", 'key takeaway',
  'at the end of the day', 'moving forward', 'going forward', 'leverage',
  'leveraging', 'utilize', 'utilizing', 'facilitate', 'implementation',
  'synergy', 'paradigm', 'holistic', 'robust', 'seamless', 'innovative',
  'cutting-edge', 'state-of-the-art', 'game-changer', 'revolutionize',
  'transformative', 'comprehensive', 'in-depth', 'multifaceted',
  'it is essential', "it's essential", 'plays a crucial role',
  'plays a vital role', 'as mentioned', 'as discussed', 'as noted',
];

// Common human words / contractions AI tends to avoid
const HUMAN_MARKERS = [
  "i've", "i'm", "i'll", "i'd", "we've", "we're", "we'll", "we'd",
  "you've", "you're", "you'll", "you'd", "they've", "they're", "they'll",
  "they'd", "it's", "that's", "there's", "here's", "don't", "won't",
  "can't", "shouldn't", "wouldn't", "couldn't", "didn't", "isn't",
  "aren't", "wasn't", "weren't", "kind of", "sort of", "pretty much",
  "basically", "honestly", "actually", "literally", "tbh",
];

/**
 * Heuristic analysis: perplexity-like score based on word predictability.
 * Measures how "surprising" each word is given a simple unigram model.
 * @param {string[]} tokens
 * @returns {number} 0–100 (higher = more human-like variety)
 */
function scorePerplexity(tokens) {
  if (tokens.length < 5) return 50;
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  const total = tokens.length;
  // Calculate entropy
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(total);
  const normalised = maxEntropy > 0 ? entropy / maxEntropy : 0;
  // High entropy (variety) → more human
  return Math.round(normalised * 100);
}

/**
 * Burstiness: measure sentence length variance.
 * AI text tends to have uniform sentence lengths; humans vary wildly.
 * @param {string[]} sentences
 * @returns {number} 0–100 (higher = more human-like variation)
 */
function scoreBurstiness(sentences) {
  if (sentences.length < 2) return 50;
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0; // coefficient of variation
  // CV > 0.5 is very bursty (human); < 0.2 is AI-like
  const score = Math.min(cv / 0.6, 1) * 100;
  return Math.round(score);
}

/**
 * Vocabulary richness: type-token ratio + hapax legomena ratio.
 * @param {string[]} tokens
 * @returns {number} 0–100
 */
function scoreVocabulary(tokens) {
  if (!tokens.length) return 50;
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  const unique = Object.keys(freq).length;
  const hapax = Object.values(freq).filter(c => c === 1).length;
  const ttr = unique / tokens.length;
  const hlr = hapax / tokens.length;
  // Combine: higher = richer vocabulary = more human
  const score = (ttr * 0.6 + hlr * 0.4) * 100;
  return Math.round(Math.min(score * 1.2, 100));
}

/**
 * Repetitive AI patterns: detect typical AI phrases.
 * @param {string} text
 * @returns {number} 0–100 (higher = fewer AI phrases = more human)
 */
function scorePatterns(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).length;
  let aiCount = 0;
  for (const phrase of AI_PHRASES) {
    const re = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    const matches = lower.match(re);
    if (matches) aiCount += matches.length;
  }
  // Penalise AI phrases per 100 words
  const penaltyPer100 = words > 0 ? (aiCount / words) * 100 : 0;
  const score = Math.max(0, 100 - penaltyPer100 * 30);
  return Math.round(score);
}

/**
 * Sentence structure uniformity: detect SVO monotony.
 * AI tends to use Subject-Verb-Object with similar starting patterns.
 * @param {string[]} sentences
 * @returns {number} 0–100 (higher = more varied = more human)
 */
function scoreStructure(sentences) {
  if (sentences.length < 3) return 60;
  const starters = sentences.map(s => {
    const words = s.split(/\s+/);
    return words.slice(0, 2).join(' ').toLowerCase();
  });
  const unique = new Set(starters).size;
  const ratio = unique / starters.length;
  // Also check for human markers
  const fullText = sentences.join(' ').toLowerCase();
  let humanMarkerCount = 0;
  for (const marker of HUMAN_MARKERS) {
    if (fullText.includes(marker)) humanMarkerCount++;
  }
  const markerBonus = Math.min(humanMarkerCount * 3, 20);
  return Math.round(Math.min(ratio * 80 + markerBonus, 100));
}

/**
 * Score a single sentence heuristically.
 * @param {string} sentence
 * @param {string[]} docTokens - all tokens in the document (for context)
 * @returns {{ score: number, reasons: string[] }}
 */
function scoreSentence(sentence, docTokens) {
  const tokens = (sentence.toLowerCase().match(/\b[a-z']+\b/g) || []);
  const reasons = [];
  let score = 60; // neutral start

  // Check for AI phrases in this sentence
  const lower = sentence.toLowerCase();
  let aiPhraseFound = false;
  for (const phrase of AI_PHRASES) {
    const re = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    if (re.test(lower)) {
      aiPhraseFound = true;
      reasons.push(`Contains AI phrase: "${phrase}"`);
      score -= 20;
    }
  }

  // Check for human markers
  let humanFound = false;
  for (const marker of HUMAN_MARKERS) {
    if (lower.includes(marker)) {
      humanFound = true;
      score += 8;
    }
  }
  if (humanFound) reasons.push('Contains human-like language');

  // Sentence length check
  const wordCount = tokens.length;
  if (wordCount >= 5 && wordCount <= 15) {
    score += 5; // Short-medium sentences are more natural
  } else if (wordCount > 30) {
    score -= 10; // Very long sentences are AI-like
    reasons.push('Unusually long sentence');
  }

  // Vocabulary diversity in sentence
  if (tokens.length > 3) {
    const unique = new Set(tokens).size;
    if (unique / tokens.length > 0.85) score += 5;
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    reasons,
  };
}

/**
 * Perform full local heuristic analysis on a document.
 * @param {string} text - full document text
 * @returns {{ overallScore: number, breakdown: Object, sentences: Array }}
 */
function analyzeLocally(text) {
  const sentences = splitSentences(text);
  const tokens = (text.toLowerCase().match(/\b[a-z']+\b/g) || []);

  const perplexityScore = scorePerplexity(tokens);
  const burstinessScore = scoreBurstiness(sentences);
  const vocabularyScore = scoreVocabulary(tokens);
  const patternScore = scorePatterns(text);
  const structureScore = scoreStructure(sentences);

  // Weighted average: patterns matter most, then structure, then burstiness
  const overallScore = Math.round(
    perplexityScore * 0.15 +
    burstinessScore * 0.25 +
    vocabularyScore * 0.20 +
    patternScore * 0.25 +
    structureScore * 0.15
  );

  const sentenceResults = sentences.map((sentence, index) => {
    const result = scoreSentence(sentence, tokens);
    return {
      id: index,
      text: sentence,
      score: result.score,
      color: scoreToColor(result.score),
      reasons: result.reasons,
    };
  });

  return {
    overallScore,
    breakdown: {
      perplexity: perplexityScore,
      burstiness: burstinessScore,
      vocabulary: vocabularyScore,
      patterns: patternScore,
      structure: structureScore,
    },
    sentences: sentenceResults,
    totalSentences: sentences.length,
    flaggedSentences: sentenceResults.filter(s => s.score < 80).length,
  };
}

/**
 * Perform deep AI analysis via Puter.js.
 * @param {string} text
 * @param {string} model
 * @returns {Promise<{ overallScore: number, sentences: Array }>}
 */
async function analyzeWithAI(text, model = 'gpt-4o-mini') {
  const truncated = text.length > 4000 ? text.slice(0, 4000) + '...' : text;
  const prompt = `Analyze the following text and determine if it was written by AI or a human.
Score each sentence from 0 (definitely AI) to 100 (definitely human).
Look for: uniform sentence structure, predictable word choices, lack of personal voice,
overuse of transitional phrases, absence of colloquialisms, and overly formal tone.
Return ONLY valid JSON in this exact format:
{"overall_score": <number 0-100>, "sentences": [{"text": "<sentence>", "score": <number 0-100>, "reason": "<brief reason>"}]}

TEXT: ${truncated}`;

  try {
    const response = await puter.ai.chat(prompt, { model });
    let raw = typeof response === 'string' ? response : (response.message?.content || response.content || '');
    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      overallScore: Math.round(parsed.overall_score || 50),
      sentences: (parsed.sentences || []).map((s, i) => ({
        id: i,
        text: s.text || '',
        score: Math.round(s.score || 50),
        color: scoreToColor(Math.round(s.score || 50)),
        reasons: s.reason ? [s.reason] : [],
      })),
    };
  } catch (err) {
    console.warn('Puter.js AI analysis failed, using local only:', err);
    return null;
  }
}

/**
 * Combine local and AI scores (weighted blend).
 * @param {Object} localResult
 * @param {Object|null} aiResult
 * @returns {Object}
 */
function combineResults(localResult, aiResult) {
  if (!aiResult) return localResult;

  const combinedOverall = Math.round(
    localResult.overallScore * 0.4 + aiResult.overallScore * 0.6
  );

  // Merge sentence scores where possible
  const combinedSentences = localResult.sentences.map(localSentence => {
    const aiSentence = aiResult.sentences.find(
      s => s.text.trim() === localSentence.text.trim()
    ) || aiResult.sentences[localSentence.id];

    if (aiSentence) {
      const blended = Math.round(localSentence.score * 0.4 + aiSentence.score * 0.6);
      return {
        ...localSentence,
        score: blended,
        color: scoreToColor(blended),
        reasons: [...(localSentence.reasons || []), ...(aiSentence.reasons || [])],
        aiScore: aiSentence.score,
        localScore: localSentence.score,
      };
    }
    return localSentence;
  });

  return {
    ...localResult,
    overallScore: combinedOverall,
    sentences: combinedSentences,
    flaggedSentences: combinedSentences.filter(s => s.score < 80).length,
    aiAnalyzed: true,
  };
}

/**
 * Main analysis entry point.
 * @param {string} text
 * @param {{ useAI?: boolean, model?: string }} options
 * @returns {Promise<Object>}
 */
async function analyze(text, options = {}) {
  const { useAI = true, model = 'gpt-4o-mini' } = options;
  const localResult = analyzeLocally(text);

  if (!useAI) return localResult;

  try {
    const aiResult = await analyzeWithAI(text, model);
    return combineResults(localResult, aiResult);
  } catch {
    return localResult;
  }
}

// ---- helpers (inline to avoid module import issues in extension context) ----
function splitSentences(text) {
  if (!text || !text.trim()) return [];
  const raw = text.match(/[^.!?]*[.!?]+(\s|$)|[^.!?]+$/g) || [];
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

function scoreToColor(score) {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

// Expose globally for extension context
if (typeof window !== 'undefined') {
  window.HumanifyDetector = { analyze, analyzeLocally, analyzeWithAI };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analyze, analyzeLocally, analyzeWithAI };
}
