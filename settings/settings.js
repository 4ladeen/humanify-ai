/**
 * settings.js - Humanify AI Settings Page Logic
 */

const DEFAULTS = {
  model: 'gpt-4o-mini',
  sensitivity: 50,
  humanizationStyle: 'natural',
  defaultAggLevel: 'medium',
  useAIAnalysis: true,
  darkMode: true,
};

document.addEventListener('DOMContentLoaded', async () => {
  const modelEl = document.getElementById('model');
  const sensitivityEl = document.getElementById('sensitivity');
  const sensitivityLabel = document.getElementById('sensitivityLabel');
  const humanizationStyleEl = document.getElementById('humanizationStyle');
  const useAIAnalysisEl = document.getElementById('useAIAnalysis');
  const darkModeEl = document.getElementById('darkMode');
  const btnSave = document.getElementById('btnSave');
  const btnReset = document.getElementById('btnReset');
  const saveFeedback = document.getElementById('saveFeedback');
  const currentModelDisplay = document.getElementById('currentModelDisplay');

  // Load current settings
  const current = await loadSettings();
  applyToUI(current);

  // Update sensitivity label
  sensitivityEl.addEventListener('input', () => {
    const v = parseInt(sensitivityEl.value);
    sensitivityLabel.textContent = v < 30 ? 'Lenient' : v < 70 ? 'Medium' : 'Strict';
  });

  // Update model display
  modelEl.addEventListener('change', () => {
    const selected = modelEl.options[modelEl.selectedIndex];
    currentModelDisplay.textContent = selected.text.split(' — ')[0];
  });

  // Save
  btnSave.addEventListener('click', async () => {
    const aggLevelEl = document.querySelector('input[name="defaultAggLevel"]:checked');
    const newSettings = {
      model: modelEl.value,
      sensitivity: parseInt(sensitivityEl.value),
      humanizationStyle: humanizationStyleEl.value,
      defaultAggLevel: aggLevelEl?.value || 'medium',
      useAIAnalysis: useAIAnalysisEl.checked,
      darkMode: darkModeEl.checked,
      theme: darkModeEl.checked ? 'dark' : 'light',
    };

    await saveSettings(newSettings);
    currentModelDisplay.textContent = modelEl.options[modelEl.selectedIndex].text.split(' — ')[0];

    saveFeedback.style.display = 'block';
    setTimeout(() => { saveFeedback.style.display = 'none'; }, 3000);
  });

  // Reset
  btnReset.addEventListener('click', async () => {
    if (confirm('Reset all settings to defaults?')) {
      await saveSettings(DEFAULTS);
      applyToUI(DEFAULTS);
      saveFeedback.style.display = 'block';
      saveFeedback.textContent = '✓ Settings reset to defaults';
      setTimeout(() => {
        saveFeedback.style.display = 'none';
        saveFeedback.textContent = '✓ Settings saved successfully';
      }, 3000);
    }
  });

  function applyToUI(s) {
    if (modelEl) modelEl.value = s.model || 'gpt-4o-mini';
    if (sensitivityEl) sensitivityEl.value = s.sensitivity || 50;

    const v = s.sensitivity || 50;
    if (sensitivityLabel) sensitivityLabel.textContent = v < 30 ? 'Lenient' : v < 70 ? 'Medium' : 'Strict';

    if (humanizationStyleEl) humanizationStyleEl.value = s.humanizationStyle || 'natural';
    if (useAIAnalysisEl) useAIAnalysisEl.checked = s.useAIAnalysis !== false;
    if (darkModeEl) darkModeEl.checked = s.darkMode !== false;

    // Aggressiveness radio
    const aggEl = document.querySelector(`input[name="defaultAggLevel"][value="${s.defaultAggLevel || 'medium'}"]`);
    if (aggEl) aggEl.checked = true;

    // Model display
    if (currentModelDisplay && modelEl) {
      const selected = modelEl.options[modelEl.selectedIndex];
      if (selected) currentModelDisplay.textContent = selected.text.split(' — ')[0];
    }
  }
});

function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(DEFAULTS, resolve);
  });
}

function saveSettings(settings) {
  return new Promise(resolve => {
    chrome.storage.sync.set(settings, resolve);
  });
}
