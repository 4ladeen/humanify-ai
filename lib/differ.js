/**
 * differ.js - Text Diff/Comparison Engine for Humanify AI
 *
 * Generates a word-level diff between original and humanized text.
 */

/**
 * Tokenize text into comparable units (words + whitespace/punctuation).
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeForDiff(text) {
  // Split on word boundaries but keep delimiters
  return text.split(/(\s+|[.,!?;:'"()\[\]{}])/g).filter(t => t !== '');
}

/**
 * Compute the Longest Common Subsequence between two arrays.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number[][]} LCS table
 */
function lcs(a, b) {
  const m = a.length;
  const n = b.length;
  const table = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }
  return table;
}

/**
 * Backtrack the LCS table to produce diff operations.
 * @param {number[][]} table
 * @param {string[]} a - original tokens
 * @param {string[]} b - new tokens
 * @returns {Array<{type: 'equal'|'insert'|'delete', value: string}>}
 */
function backtrack(table, a, b) {
  const ops = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'equal', value: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      ops.unshift({ type: 'insert', value: b[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'delete', value: a[i - 1] });
      i--;
    }
  }
  return ops;
}

/**
 * Compute a word-level diff between two strings.
 * @param {string} original
 * @param {string} humanized
 * @returns {Array<{type: 'equal'|'insert'|'delete', value: string}>}
 */
function diff(original, humanized) {
  const tokensA = tokenizeForDiff(original);
  const tokensB = tokenizeForDiff(humanized);
  const table = lcs(tokensA, tokensB);
  return backtrack(table, tokensA, tokensB);
}

/**
 * Render a diff as HTML with colour-coded additions and deletions.
 * @param {Array<{type: string, value: string}>} ops
 * @returns {string} HTML string
 */
function renderDiffHtml(ops) {
  return ops.map(op => {
    const escaped = escapeHtml(op.value);
    switch (op.type) {
      case 'insert':
        return `<ins class="diff-insert">${escaped}</ins>`;
      case 'delete':
        return `<del class="diff-delete">${escaped}</del>`;
      default:
        return `<span class="diff-equal">${escaped}</span>`;
    }
  }).join('');
}

/**
 * Compute a simple similarity percentage between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–100
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  const tokA = tokenizeForDiff(a);
  const tokB = tokenizeForDiff(b);
  const table = lcs(tokA, tokB);
  const lcsLen = table[tokA.length][tokB.length];
  return Math.round((2 * lcsLen / (tokA.length + tokB.length)) * 100);
}

/**
 * Count the number of changes in a diff.
 * @param {Array<{type: string}>} ops
 * @returns {{ insertions: number, deletions: number, unchanged: number }}
 */
function countChanges(ops) {
  return ops.reduce((acc, op) => {
    if (op.type === 'insert') acc.insertions++;
    else if (op.type === 'delete') acc.deletions++;
    else acc.unchanged++;
    return acc;
  }, { insertions: 0, deletions: 0, unchanged: 0 });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Expose globally for extension context
if (typeof window !== 'undefined') {
  window.HumanifyDiffer = { diff, renderDiffHtml, similarity, countChanges };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { diff, renderDiffHtml, similarity, countChanges };
}
