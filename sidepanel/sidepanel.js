/**
 * sidepanel.js - Humanify AI Side Panel Logic
 *
 * Handles detection, humanization, diff view, and settings.
 */

// ---- State ---------------------------------------------------------------
let currentAnalysis = null;      // Latest analysis result
let currentText = '';            // Extracted document text
let humanizedText = '';          // Humanized version
let settings = {};               // Loaded settings
let activeFilter = 'all';        // Current sentence filter
let humanizeLevel = 'medium';    // Aggressiveness level

const AGG_DESCRIPTIONS = {
  light: 'Minimal changes — fix obvious AI patterns while preserving style',
  medium: 'Balanced — vary structure, add contractions, improve natural flow',
  aggressive: 'Thorough rewrite — dramatic style changes, strong personal voice',
};

// ---- DOM References -------------------------------------------------------
const els = {};
document.addEventListener('DOMContentLoaded', async () => {
  // Cache DOM elements
  Object.assign(els, {
    gaugeRing: document.getElementById('gaugeRing'),
    overallScoreText: document.getElementById('overallScoreText'),
    scoreLabelMain: document.getElementById('scoreLabelMain'),
    chipTotal: document.getElementById('chipTotal'),
    chipFlagged: document.getElementById('chipFlagged'),
    btnAnalyze: document.getElementById('btnAnalyze'),
    breakdownSection: document.getElementById('breakdownSection'),
    sentencesSection: document.getElementById('sentencesSection'),
    sentencesList: document.getElementById('sentencesList'),
    emptyState: document.getElementById('emptyState'),
    onlineBadge: document.getElementById('onlineBadge'),

    // Humanize tab
    btnHumanize: document.getElementById('btnHumanize'),
    humanizeBtnText: document.getElementById('humanizeBtnText'),
    humanizeProgress: document.getElementById('humanizeProgress'),
    progressBar: document.getElementById('progressBar'),
    progressLabel: document.getElementById('progressLabel'),
    diffSection: document.getElementById('diffSection'),
    diffView: document.getElementById('diffView'),
    sideView: document.getElementById('sideView'),
    sideOriginal: document.getElementById('sideOriginal'),
    sideHumanized: document.getElementById('sideHumanized'),
    diffStats: document.getElementById('diffStats'),
    btnApply: document.getElementById('btnApply'),
    btnReject: document.getElementById('btnReject'),

    // Settings tab
    settingModel: document.getElementById('settingModel'),
    settingSensitivity: document.getElementById('settingSensitivity'),
    sensitivityHint: document.getElementById('sensitivityHint'),
    settingStyle: document.getElementById('settingStyle'),
    settingUseAI: document.getElementById('settingUseAI'),
    settingDarkMode: document.getElementById('settingDarkMode'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    saveFeedback: document.getElementById('saveFeedback'),

    errorToast: document.getElementById('errorToast'),
  });

  // Load settings
  settings = await loadSettingsFromStorage();
  applySettingsToUI(settings);

  // Check Puter.js availability
  checkPuterAvailability();

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Refresh button
  document.getElementById('btnRefresh').addEventListener('click', () => {
    if (currentAnalysis) runAnalysis();
  });

  // Analyze button
  els.btnAnalyze.addEventListener('click', runAnalysis);

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      filterSentences(activeFilter);
    });
  });

  // Aggressiveness buttons
  document.querySelectorAll('.agg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.agg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      humanizeLevel = btn.dataset.level;
      document.getElementById('aggDescription').textContent = AGG_DESCRIPTIONS[humanizeLevel];
    });
  });

  // Humanize button
  els.btnHumanize.addEventListener('click', runHumanization);

  // Diff view tabs
  document.querySelectorAll('.diff-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.view === 'diff') {
        els.diffView.style.display = 'block';
        els.sideView.style.display = 'none';
      } else {
        els.diffView.style.display = 'none';
        els.sideView.style.display = 'flex';
      }
    });
  });

  // Apply/Reject diff
  els.btnApply.addEventListener('click', applyHumanizedText);
  els.btnReject.addEventListener('click', rejectHumanizedText);

  // Settings
  els.settingSensitivity.addEventListener('input', () => {
    const v = els.settingSensitivity.value;
    els.sensitivityHint.textContent = v < 30 ? 'Lenient' : v < 70 ? 'Medium' : 'Strict';
  });

  els.btnSaveSettings.addEventListener('click', saveSettingsHandler);

  // Listen for messages from background / content
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
});

// ---- Tab Switching --------------------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));
}

// ---- Analysis ---------------------------------------------------------------
async function runAnalysis() {
  setAnalyzing(true);

  try {
    // Extract text from Google Doc
    const textData = await sendMessage({ type: 'EXTRACT_TEXT' });
    if (!textData?.text?.trim()) {
      showError('No text found in document. Make sure you are on a Google Doc with content.');
      setAnalyzing(false);
      return;
    }

    currentText = textData.text;

    // Run analysis (local + optional AI)
    const analysisOptions = {
      useAI: settings.useAIAnalysis !== false,
      model: settings.model || 'gpt-4o-mini',
    };

    currentAnalysis = await window.HumanifyDetector.analyze(currentText, analysisOptions);

    // Display results
    displayAnalysisResults(currentAnalysis);

    // Send highlights to content script
    sendMessage({
      type: 'HIGHLIGHT_SENTENCES',
      sentences: currentAnalysis.sentences,
    });

    // Update badge
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', score: currentAnalysis.overallScore });

  } catch (err) {
    showError('Analysis failed: ' + err.message);
  }

  setAnalyzing(false);
}

function setAnalyzing(analyzing) {
  const btnText = els.btnAnalyze.querySelector('.btn-text');
  const btnSpinner = els.btnAnalyze.querySelector('.btn-spinner');
  els.btnAnalyze.disabled = analyzing;
  if (btnText) btnText.style.display = analyzing ? 'none' : '';
  if (btnSpinner) btnSpinner.style.display = analyzing ? 'flex' : 'none';
}

// ---- Display Analysis Results -----------------------------------------------
function displayAnalysisResults(result) {
  // Side panel gauge ring circumference: 2 * π * r = 2 * π * 32 ≈ 201
  // (matches the SVG circle: cx=40,cy=40,r=32 in sidepanel.html gauge)
  const GAUGE_CIRCUMFERENCE = 201;

  // Score gauge
  const progress = result.overallScore / 100;
  const offset = GAUGE_CIRCUMFERENCE * (1 - progress);
  els.gaugeRing.style.strokeDashoffset = offset;

  // Colour gauge
  const color = result.overallScore >= 80 ? '#00B894' : result.overallScore >= 50 ? '#FDCB6E' : '#E17055';
  els.gaugeRing.style.stroke = color;

  // Animate score
  animateNumber(els.overallScoreText, 0, result.overallScore, 800);

  // Score label
  if (result.overallScore >= 80) {
    els.scoreLabelMain.className = 'score-label-main human';
    els.scoreLabelMain.textContent = 'Human Written';
  } else if (result.overallScore >= 50) {
    els.scoreLabelMain.className = 'score-label-main suspicious';
    els.scoreLabelMain.textContent = 'Suspicious';
  } else {
    els.scoreLabelMain.className = 'score-label-main ai';
    els.scoreLabelMain.textContent = 'AI-Generated';
  }

  // Stats chips
  els.chipTotal.textContent = `${result.totalSentences} sentences`;
  els.chipFlagged.textContent = `${result.flaggedSentences} flagged`;

  // Breakdown
  if (result.breakdown) {
    els.breakdownSection.style.display = 'flex';
    setBreakdownBar('Perplexity', result.breakdown.perplexity);
    setBreakdownBar('Burstiness', result.breakdown.burstiness);
    setBreakdownBar('Vocabulary', result.breakdown.vocabulary);
    setBreakdownBar('Patterns', result.breakdown.patterns);
    setBreakdownBar('Structure', result.breakdown.structure);
  }

  // Sentences list
  if (result.sentences && result.sentences.length) {
    els.sentencesSection.style.display = 'flex';
    els.emptyState.style.display = 'none';
    renderSentences(result.sentences);
  }
}

function setBreakdownBar(name, value) {
  const id = name.toLowerCase();
  const bar = document.getElementById(`bar${name}`);
  const val = document.getElementById(`val${name}`);
  if (!bar || !val) return;
  const color = value >= 80 ? '#00B894' : value >= 50 ? '#FDCB6E' : '#E17055';
  bar.style.width = value + '%';
  bar.style.background = color;
  val.textContent = Math.round(value) + '%';
}

// ---- Sentences List ---------------------------------------------------------
function renderSentences(sentences) {
  els.sentencesList.innerHTML = '';
  sentences.forEach(sentence => {
    const item = document.createElement('div');
    item.className = `sentence-item color-${sentence.color}`;
    item.dataset.color = sentence.color;
    item.dataset.id = sentence.id;

    const reasonsHtml = (sentence.reasons || []).slice(0, 2).map(r =>
      `<span class="sentence-reason-tag">${escapeHtml(r)}</span>`
    ).join('');

    item.innerHTML = `
      <div class="sentence-header">
        <span class="sentence-score-badge ${sentence.color}">${sentence.score}% Human</span>
      </div>
      <div class="sentence-text">${escapeHtml(sentence.text)}</div>
      ${reasonsHtml ? `<div class="sentence-reasons">${reasonsHtml}</div>` : ''}
    `;

    item.addEventListener('click', () => {
      sendMessage({ type: 'SCROLL_TO_SENTENCE', sentenceId: sentence.id });
    });

    els.sentencesList.appendChild(item);
  });

  filterSentences(activeFilter);
}

function filterSentences(filter) {
  document.querySelectorAll('.sentence-item').forEach(item => {
    if (filter === 'all' || item.dataset.color === filter) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
}

// ---- Humanization -----------------------------------------------------------
async function runHumanization() {
  if (!currentText) {
    // Try to extract text first
    try {
      const textData = await sendMessage({ type: 'EXTRACT_TEXT' });
      if (!textData?.text?.trim()) {
        showError('No document text found. Please analyze the document first.');
        return;
      }
      currentText = textData.text;
    } catch {
      showError('Please analyze the document first.');
      return;
    }
  }

  const targetValue = document.querySelector('input[name="humanizeTarget"]:checked')?.value || 'all';
  setHumanizing(true);
  showProgress(0, 'Starting humanization...');

  try {
    const options = {
      level: humanizeLevel,
      model: settings.model || 'gpt-4o-mini',
      onProgress: (p) => {
        showProgress(p.progress, getProgressLabel(p.stage));
      },
    };

    if (targetValue === 'all') {
      humanizedText = await window.HumanifyHumanizer.humanize(currentText, options);
    } else if (targetValue === 'flagged' && currentAnalysis?.sentences) {
      humanizedText = await window.HumanifyHumanizer.humanizeFlagged(
        currentText, currentAnalysis.sentences, options
      );
    } else if (targetValue === 'selected') {
      // Get selected text from the document
      const selectedData = await sendMessage({ type: 'GET_SELECTED_TEXT' });
      const selectedText = selectedData?.text || currentText;
      humanizedText = await window.HumanifyHumanizer.humanizeSelected(selectedText, options);
    }

    showProgress(100, 'Complete!');
    displayDiff(currentText, humanizedText);

    // Switch to diff section
    setTimeout(() => {
      els.humanizeProgress.style.display = 'none';
    }, 800);

  } catch (err) {
    showError('Humanization failed: ' + err.message);
    els.humanizeProgress.style.display = 'none';
  }

  setHumanizing(false);
}

function setHumanizing(isHumanizing) {
  els.btnHumanize.disabled = isHumanizing;
  els.humanizeBtnText.textContent = isHumanizing ? 'Humanizing...' : 'Humanize Text';
}

function showProgress(pct, label) {
  els.humanizeProgress.style.display = 'flex';
  els.progressBar.style.width = pct + '%';
  els.progressLabel.textContent = label;
}

function getProgressLabel(stage) {
  const labels = {
    calling_ai: 'Calling AI...',
    processing: 'Processing...',
    complete: 'Complete!',
  };
  return labels[stage] || stage;
}

// ---- Diff View ---------------------------------------------------------------
function displayDiff(original, humanized) {
  const ops = window.HumanifyDiffer.diff(original, humanized);
  const stats = window.HumanifyDiffer.countChanges(ops);
  const simPct = window.HumanifyDiffer.similarity(original, humanized);

  // Diff HTML
  els.diffView.innerHTML = window.HumanifyDiffer.renderDiffHtml(ops);

  // Side by side
  els.sideOriginal.textContent = original;
  els.sideHumanized.textContent = humanized;

  // Stats
  els.diffStats.textContent = `+${stats.insertions} / -${stats.deletions} · ${simPct}% similar`;

  els.diffSection.style.display = 'flex';
}

async function applyHumanizedText() {
  if (!humanizedText) return;
  try {
    const result = await sendMessage({ type: 'INJECT_TEXT', text: humanizedText });
    if (result?.success) {
      showError('✓ Applied to document!', 'success');
      currentText = humanizedText;
      humanizedText = '';
      els.diffSection.style.display = 'none';
      // Re-analyze
      setTimeout(runAnalysis, 500);
    } else {
      showError('Failed to apply text: ' + (result?.error || 'Unknown error'));
    }
  } catch (err) {
    showError('Failed to apply: ' + err.message);
  }
}

function rejectHumanizedText() {
  humanizedText = '';
  els.diffSection.style.display = 'none';
}

// ---- Settings ---------------------------------------------------------------
async function loadSettingsFromStorage() {
  const defaults = {
    model: 'gpt-4o-mini',
    sensitivity: 50,
    humanizationStyle: 'natural',
    useAIAnalysis: true,
    theme: 'dark',
  };
  return new Promise(resolve => {
    chrome.storage.sync.get(defaults, resolve);
  });
}

function applySettingsToUI(s) {
  if (els.settingModel) els.settingModel.value = s.model || 'gpt-4o-mini';
  if (els.settingSensitivity) {
    els.settingSensitivity.value = s.sensitivity || 50;
    const v = s.sensitivity || 50;
    els.sensitivityHint.textContent = v < 30 ? 'Lenient' : v < 70 ? 'Medium' : 'Strict';
  }
  if (els.settingStyle) els.settingStyle.value = s.humanizationStyle || 'natural';
  if (els.settingUseAI) els.settingUseAI.checked = s.useAIAnalysis !== false;
  if (els.settingDarkMode) els.settingDarkMode.checked = s.theme !== 'light';
}

async function saveSettingsHandler() {
  const newSettings = {
    model: els.settingModel.value,
    sensitivity: parseInt(els.settingSensitivity.value),
    humanizationStyle: els.settingStyle.value,
    useAIAnalysis: els.settingUseAI.checked,
    theme: els.settingDarkMode.checked ? 'dark' : 'light',
  };

  await new Promise(resolve => chrome.storage.sync.set(newSettings, resolve));
  settings = newSettings;

  els.saveFeedback.style.display = 'block';
  setTimeout(() => { els.saveFeedback.style.display = 'none'; }, 2000);
}

// ---- Puter.js Availability --------------------------------------------------
function checkPuterAvailability() {
  const badge = els.onlineBadge;
  if (typeof puter !== 'undefined' && puter.ai) {
    badge.classList.remove('offline');
  } else {
    badge.classList.add('offline');
    badge.innerHTML = '<span>Local Only</span>';
    badge.title = 'Puter.js not available — using local heuristics only';
  }
}

// ---- Runtime Message Handler ------------------------------------------------
function handleRuntimeMessage(message) {
  if (message.type === 'SENTENCE_CLICKED') {
    // Scroll to sentence in list
    const item = document.querySelector(`.sentence-item[data-id="${message.sentenceId}"]`);
    if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (message.type === 'TRIGGER_ANALYSIS') {
    runAnalysis();
  }
}

// ---- Utilities ---------------------------------------------------------------
function sendMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function showError(message, type = 'error') {
  const toast = els.errorToast;
  toast.textContent = message;
  toast.style.background = type === 'success' ? '#00B894' : '#E17055';
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  const update = (timestamp) => {
    const elapsed = timestamp - start;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function escapeHtml(text) {
  if (typeof window !== 'undefined' && window.HumanifyUtils) {
    return window.HumanifyUtils.escapeHtml(text);
  }
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
