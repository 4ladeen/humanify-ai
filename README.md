# 🤖➡️🧑 Humanify AI

> **Detect AI-written text in Google Docs and humanize it to be 100% undetectable — completely free, no API key needed.**

[![Version](https://img.shields.io/badge/version-1.0.0-6C5CE7?style=flat-square)](./manifest.json)
[![License](https://img.shields.io/badge/license-MIT-00B894?style=flat-square)](./LICENSE)
[![Powered by Puter.js](https://img.shields.io/badge/AI-Puter.js%20(Free)-a855f7?style=flat-square)](https://puter.com)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-E17055?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)

---

## ✨ Features

- 🔍 **AI Detection Engine** — Hybrid local heuristics + Puter.js GPT-4o deep analysis
- 📊 **Sentence-Level Scoring** — Color-coded highlights: 🟢 Human / 🟡 Suspicious / 🔴 AI
- ✍️ **One-Click Humanization** — Rewrite entire doc, flagged sentences only, or selected text
- 🔄 **Before/After Diff View** — See exactly what changed with colour-coded additions/deletions
- 📋 **Apply to Google Doc** — Push humanized text directly back into your document
- ⚡ **Works Offline** — Local heuristic analysis with no internet required
- 🆓 **100% Free** — Powered by [Puter.js](https://puter.com) — zero API keys, zero cost

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Extension | Chrome Manifest V3 |
| AI API | [Puter.js](https://js.puter.com/v2/) (GPT-4o, Claude — all free) |
| Language | Vanilla JavaScript (no frameworks) |
| Styles | Custom CSS with CSS variables |
| Storage | Chrome Storage API |

---

## 📁 File Structure

```
humanify-ai/
├── manifest.json                 # Chrome Extension Manifest V3
├── README.md                     # This file
├── icons/
│   ├── icon16.png               # Extension icon 16×16
│   ├── icon32.png               # Extension icon 32×32
│   ├── icon48.png               # Extension icon 48×48
│   ├── icon128.png              # Extension icon 128×128
│   └── generate-icons.js        # Node.js icon generator script
├── popup/
│   ├── popup.html               # Extension popup UI
│   ├── popup.css                # Popup styles
│   └── popup.js                 # Popup logic
├── sidepanel/
│   ├── sidepanel.html           # Side panel UI (main analysis interface)
│   ├── sidepanel.css            # Side panel styles
│   └── sidepanel.js             # Side panel logic
├── content/
│   ├── content.js               # Google Docs content script
│   └── content.css              # Sentence highlight overlay styles
├── background/
│   └── background.js            # Service worker (messaging, badge updates)
├── lib/
│   ├── detector.js              # AI detection engine (heuristics + Puter.js)
│   ├── humanizer.js             # Humanization engine (Puter.js prompts)
│   ├── differ.js                # Text diff/comparison (word-level LCS)
│   └── utils.js                 # Shared utilities
├── settings/
│   ├── settings.html            # Full settings page
│   ├── settings.css             # Settings styles
│   └── settings.js              # Settings logic
└── assets/
    └── logo.svg                 # Humanify AI logo (SVG)
```

---

## 🚀 Installation (Load Unpacked)

Since Humanify AI is not yet on the Chrome Web Store, you can install it as an unpacked extension:

### Step 1 — Download or clone the repository
```bash
git clone https://github.com/4ladeen/humanify-ai.git
cd humanify-ai
```

### Step 2 — Open Chrome Extensions
1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Toggle **Developer mode** ON (top-right corner)

### Step 3 — Load the extension
1. Click **"Load unpacked"**
2. Select the `humanify-ai` folder (the root, containing `manifest.json`)
3. The **Humanify AI** extension icon will appear in your toolbar

### Step 4 — Pin the extension (optional)
1. Click the puzzle piece 🧩 icon in the toolbar
2. Click the pin 📌 next to Humanify AI

---

## 📖 Usage Guide

### Quick Scan (Popup)
1. Open a Google Doc in Chrome
2. Click the **Humanify AI** extension icon
3. Click **"Quick Scan"** for an instant local analysis
4. View the AI score gauge and sentence counts

### Full Analysis (Side Panel)
1. Open a Google Doc
2. Click the extension icon → **"Full Analysis"** (opens side panel)
3. In the Detection tab, click **"Analyze Document"**
4. Wait for the analysis (combines local heuristics + Puter.js AI)
5. View:
   - 📊 Overall score gauge (0–100% Human)
   - 📈 Breakdown bars (Perplexity, Burstiness, Vocabulary, Patterns, Structure)
   - 📝 Sentence list with individual scores and colour coding
6. Click any sentence in the list to scroll to it in the document

### Humanizing Text
1. Open the **Humanize** tab in the side panel
2. Choose what to humanize:
   - **All text** — rewrites the entire document
   - **Flagged only** — rewrites only red/yellow sentences
   - **Selected text** — rewrites your current selection
3. Choose aggressiveness: **Light / Medium / Aggressive**
4. Click **"Humanize Text"**
5. Review the **Before/After diff** (colour-coded additions/deletions)
6. Click **"Apply to Doc"** to push changes back, or **"Reject"** to discard

### Settings
Access via the Settings tab in the side panel or the popup settings button:
- **AI Model** — Choose GPT-4o Mini, GPT-4o, Claude 3.5 Sonnet (all free via Puter.js)
- **Sensitivity** — Adjust how strictly AI text is flagged
- **Writing Style** — Natural, Academic, Casual, or Professional voice
- **AI Analysis** — Toggle Puter.js deep analysis on/off (works offline without it)

---

## 🧠 How It Works

### AI Detection (Hybrid Approach)

**1. Local Heuristics (instant, offline)**

| Metric | Description | AI Text Pattern |
|--------|-------------|-----------------|
| Perplexity | Word predictability/entropy | Low perplexity = repetitive word choices |
| Burstiness | Sentence length variation (CV) | Low CV = uniform sentence lengths |
| Vocabulary | Type-token ratio + hapax legomena | Low TTR = narrow vocabulary |
| Patterns | AI phrase detection (200+ phrases) | "Moreover", "delve", "landscape", etc. |
| Structure | Sentence starter variety + human markers | Monotonous SVO = AI |

**2. Puter.js AI Analysis (free, cloud)**
- Sends text to GPT-4o-mini via Puter.js
- Receives per-sentence human/AI scores with reasons
- Blends with local scores (40% local + 60% AI)

### Humanization Engine
Uses Puter.js with a carefully crafted prompt instructing the AI to:
- Vary sentence lengths dramatically (5-word to 25+ word sentences)
- Use natural contractions (don't, it's, they're)
- Add colloquialisms and informal transitions
- Avoid AI-typical vocabulary (delve, leverage, synergy, etc.)
- Add personal voice with hedging language (I think, probably)
- Break structured paragraph patterns

### Diff Engine
Word-level diff using the Longest Common Subsequence (LCS) algorithm — same approach as `git diff`. Shows insertions in green, deletions in red with strikethrough.

---

## 📸 Screenshots

> *Screenshots coming soon — see installation guide above to try it yourself*

| Popup | Side Panel (Detection) | Side Panel (Humanize) |
|-------|------------------------|----------------------|
| Score gauge with quick stats | Sentence-level analysis | Before/After diff view |

---

## 🔧 Development

### Regenerating Icons
If you need to regenerate the PNG icons:
```bash
npm install canvas
node icons/generate-icons.js
```

### Key Files to Modify
- **`lib/detector.js`** — Add/remove AI phrases, adjust scoring weights
- **`lib/humanizer.js`** — Modify humanization prompts
- **`manifest.json`** — Add new permissions or content script matches

### Adding New AI Models
Puter.js supports many models — update `settings/settings.html` select options and use the model ID in Puter.js calls.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## ⚠️ Privacy & Security

- **No data collection** — Your documents are processed locally or sent directly to Puter.js AI (not our servers)
- **No account needed** — Puter.js provides free AI access without registration
- **Open source** — Full source code available for inspection
- **Minimal permissions** — Only requests `activeTab`, `storage`, `sidePanel`, and `scripting`

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

- [Puter.js](https://puter.com) — Free, unlimited AI API
- [OpenAI GPT-4o](https://openai.com) — AI model (via Puter.js)
- [Anthropic Claude](https://anthropic.com) — Alternative AI model (via Puter.js)

---

<div align="center">
  Made with ❤️ — <strong>Humanify AI</strong> makes your writing feel truly human
</div>
