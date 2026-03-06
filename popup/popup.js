/**
 * popup.js - Humanify AI Extension Popup Logic
 */

// Popup gauge arc circumference: approximate path length for the SVG half-arc
// SVG path: "M 20 100 A 80 80 0 0 1 180 100" → semicircle r=80 → π*80 ≈ 251
const GAUGE_CIRCUMFERENCE = 251;

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const gaugeSection = document.getElementById('gaugeSection');
  const gaugeFill = document.getElementById('gaugeFill');
  const scoreNumber = document.getElementById('scoreNumber');
  const scoreLabel = document.getElementById('scoreLabel');
  const statsRow = document.getElementById('statsRow');
  const statTotal = document.getElementById('statTotal');
  const statFlagged = document.getElementById('statFlagged');
  const statClean = document.getElementById('statClean');
  const notGdocMessage = document.getElementById('notGdocMessage');
  const btnFullAnalysis = document.getElementById('btnFullAnalysis');
  const btnQuickScan = document.getElementById('btnQuickScan');
  const btnSettings = document.getElementById('btnSettings');

  // Check if we're on a Google Doc
  const tabInfo = await getTabInfo();
  const isGoogleDoc = tabInfo?.isGoogleDoc;

  if (!isGoogleDoc) {
    showNotGoogleDocState();
  } else {
    showGoogleDocState();
    await loadCachedScore(tabInfo.tabId);
  }

  // Button handlers
  btnFullAnalysis.addEventListener('click', async () => {
    if (!isGoogleDoc) return;
    setStatus('active', 'Opening analysis panel...');
    await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    // Post a message to side panel to trigger analysis
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_ANALYSIS', mode: 'full' }).catch(() => {});
      }
    });
    window.close();
  });

  btnQuickScan.addEventListener('click', async () => {
    if (!isGoogleDoc) return;
    setStatus('active', 'Scanning...');
    btnQuickScan.disabled = true;

    try {
      const textData = await chrome.runtime.sendMessage({ type: 'EXTRACT_TEXT' });
      if (!textData?.text) {
        setStatus('error', 'No text found in document');
        btnQuickScan.disabled = false;
        return;
      }

      // Load detector script and run local analysis
      const result = runLocalAnalysis(textData.text);
      displayScore(result.overallScore, result.totalSentences, result.flaggedSentences);
      setStatus('active', 'Google Doc detected ✓');

      // Cache the score
      chrome.storage.session.set({
        [`score_${tabInfo.tabId}`]: result.overallScore,
        [`stats_${tabInfo.tabId}`]: {
          total: result.totalSentences,
          flagged: result.flaggedSentences,
          clean: result.totalSentences - result.flaggedSentences,
        }
      });
    } catch (err) {
      setStatus('error', 'Scan failed: ' + err.message);
    }

    btnQuickScan.disabled = false;
  });

  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() :
      chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  });

  // ---- Helpers ----------------------------------------------------------------

  function showNotGoogleDocState() {
    setStatus('inactive', 'Not a Google Doc');
    gaugeSection.style.opacity = '0.3';
    statsRow.style.opacity = '0.3';
    notGdocMessage.style.display = 'flex';
    btnFullAnalysis.disabled = true;
    btnQuickScan.disabled = true;
  }

  function showGoogleDocState() {
    setStatus('active', 'Google Doc detected ✓');
    notGdocMessage.style.display = 'none';
    btnFullAnalysis.disabled = false;
    btnQuickScan.disabled = false;
  }

  function setStatus(type, text) {
    statusDot.className = 'status-dot ' + type;
    statusText.textContent = text;
  }

  function displayScore(score, total, flagged) {
    const roundedScore = Math.round(score);
    const clean = total - flagged;

    // Animate gauge
    const progress = roundedScore / 100;
    const offset = GAUGE_CIRCUMFERENCE - (GAUGE_CIRCUMFERENCE * progress * 0.75);
    gaugeFill.style.strokeDashoffset = offset;

    // Colour the gauge
    if (roundedScore >= 80) {
      gaugeFill.style.stroke = '#00B894';
      scoreLabel.className = 'score-label human';
      scoreLabel.textContent = 'Human';
    } else if (roundedScore >= 50) {
      gaugeFill.style.stroke = '#FDCB6E';
      scoreLabel.className = 'score-label suspicious';
      scoreLabel.textContent = 'Suspicious';
    } else {
      gaugeFill.style.stroke = '#E17055';
      scoreLabel.className = 'score-label ai';
      scoreLabel.textContent = 'AI-Generated';
    }

    // Animate number
    animateNumber(scoreNumber, 0, roundedScore, 800);

    // Stats
    statTotal.textContent = total || '--';
    statFlagged.textContent = flagged || '--';
    statClean.textContent = clean || '--';
  }

  async function loadCachedScore(tabId) {
    try {
      const data = await chrome.storage.session.get([`score_${tabId}`, `stats_${tabId}`]);
      const score = data[`score_${tabId}`];
      const stats = data[`stats_${tabId}`];
      if (score !== undefined && stats) {
        displayScore(score, stats.total, stats.flagged);
      }
    } catch (e) {
      // No cached score
    }
  }

  async function getTabInfo() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_TAB_INFO' }, response => {
        resolve(response || {});
      });
    });
  }

  function animateNumber(el, from, to, duration) {
    const start = performance.now();
    const update = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
      el.textContent = Math.round(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }
});

/**
 * Inline local analysis (heuristic only, no Puter.js in popup).
 * Mirrors the logic from lib/detector.js for the popup context.
 */
function runLocalAnalysis(text) {
  const sentences = text.match(/[^.!?]*[.!?]+(\s|$)|[^.!?]+$/g) || [];
  const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 0);
  const tokens = (text.toLowerCase().match(/\b[a-z']+\b/g) || []);

  const AI_PHRASES = [
    'moreover', 'furthermore', 'additionally', 'in conclusion',
    'it is important to note', 'delve', 'landscape', 'arguably',
    'leverage', 'utilize', 'synergy', 'holistic', 'robust', 'seamless',
  ];

  // Simple pattern score
  const lower = text.toLowerCase();
  let aiCount = 0;
  AI_PHRASES.forEach(phrase => {
    const re = new RegExp('\\b' + phrase + '\\b', 'gi');
    const m = lower.match(re);
    if (m) aiCount += m.length;
  });

  const words = tokens.length;
  const patternScore = Math.max(0, 100 - (words > 0 ? (aiCount / words) * 100 * 30 : 0));

  // Burstiness
  const lengths = cleanSentences.map(s => s.split(/\s+/).length);
  const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 10;
  const variance = lengths.length ? lengths.reduce((s, l) => s + (l - mean) ** 2, 0) / lengths.length : 0;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const burstinessScore = Math.min(cv / 0.6, 1) * 100;

  const overallScore = Math.round(patternScore * 0.4 + burstinessScore * 0.35 + 60 * 0.25);

  const flaggedSentences = cleanSentences.filter(s => {
    const sl = s.toLowerCase();
    return AI_PHRASES.some(p => sl.includes(p)) || s.split(/\s+/).length > 25;
  }).length;

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    totalSentences: cleanSentences.length,
    flaggedSentences,
  };
}
