/**
 * content.js - Google Docs Content Script for Humanify AI
 *
 * Handles text extraction from Google Docs DOM, sentence highlighting,
 * and text injection back into the document.
 */

(function () {
  'use strict';

  // Avoid double injection
  if (window.__humanifyAILoaded) return;
  window.__humanifyAILoaded = true;

  // Map of sentence index → overlay element
  const sentenceOverlays = new Map();
  let highlightContainer = null;

  // ---- Text Extraction -------------------------------------------------------

  /**
   * Extract all text from the Google Docs editor.
   * Google Docs uses .kix-paragraphrenderer > .kix-lineview > spans
   * @returns {{ text: string, paragraphs: string[] }}
   */
  function extractText() {
    // Try the modern Google Docs DOM structure
    const editor = document.querySelector('.kix-appview-editor');
    if (!editor) return { text: '', paragraphs: [] };

    const paragraphs = [];
    const paragraphEls = editor.querySelectorAll('.kix-paragraphrenderer');

    paragraphEls.forEach(para => {
      const spans = para.querySelectorAll('.kix-wordhtmlgenerator-word-node, .kix-lineview-text-block span');
      if (spans.length) {
        const text = Array.from(spans).map(s => s.textContent).join('');
        if (text.trim()) paragraphs.push(text.trim());
      } else {
        // Fallback: grab all text
        const text = para.textContent.trim();
        if (text) paragraphs.push(text);
      }
    });

    // If no paragraphs found via .kix-, try a broader selector
    if (!paragraphs.length) {
      const allText = editor.textContent.trim();
      if (allText) return { text: allText, paragraphs: [allText] };
    }

    return {
      text: paragraphs.join('\n\n'),
      paragraphs,
    };
  }

  // ---- Text Injection --------------------------------------------------------

  /**
   * Replace document text by selecting all and pasting new content.
   * @param {string} newText
   */
  async function injectText(newText) {
    const editor = document.querySelector('.kix-appview-editor');
    if (!editor) return { success: false, error: 'Editor not found' };

    try {
      // Focus the document
      const docBody = document.querySelector('.kix-rotatingtilemanager');
      if (docBody) docBody.click();

      // Select all using keyboard shortcut
      await delay(100);
      document.execCommand('selectAll');
      await delay(100);

      // Use clipboard API to paste new text
      await navigator.clipboard.writeText(newText);
      document.execCommand('paste');

      return { success: true };
    } catch (err) {
      // Fallback: try programmatic input events
      try {
        await injectViaEvents(newText);
        return { success: true };
      } catch (err2) {
        return { success: false, error: err2.message };
      }
    }
  }

  /**
   * Fallback text injection via synthetic keyboard events.
   * @param {string} text
   */
  async function injectViaEvents(text) {
    const activeEl = document.activeElement;
    if (!activeEl) throw new Error('No active element');

    // Select all first
    const selectAll = new KeyboardEvent('keydown', {
      key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true
    });
    activeEl.dispatchEvent(selectAll);
    await delay(50);

    // Type the text (limited — works for short texts)
    for (const char of text) {
      activeEl.dispatchEvent(new KeyboardEvent('keypress', {
        key: char, bubbles: true
      }));
    }
  }

  // ---- Sentence Highlighting -------------------------------------------------

  /**
   * Highlight sentences in the document with colour overlays.
   * @param {Array<{id: number, text: string, score: number, color: string}>} sentences
   */
  function highlightSentences(sentences) {
    clearHighlights();
    if (!sentences || !sentences.length) return;

    // Create a container for overlays
    highlightContainer = document.createElement('div');
    highlightContainer.id = 'humanify-highlight-container';
    document.body.appendChild(highlightContainer);

    // Use TreeWalker to find text nodes containing sentence text
    const editor = document.querySelector('.kix-appview-editor');
    if (!editor) return;

    sentences.forEach(sentence => {
      if (!sentence.text.trim()) return;
      highlightSentenceInDOM(sentence, editor);
    });
  }

  /**
   * Find and highlight a single sentence in the DOM.
   * @param {Object} sentence
   * @param {Element} root
   */
  function highlightSentenceInDOM(sentence, root) {
    const searchText = sentence.text.slice(0, 50).trim();
    if (!searchText) return;

    // Find paragraph elements containing this sentence
    const paragraphs = root.querySelectorAll('.kix-paragraphrenderer');
    for (const para of paragraphs) {
      if (para.textContent.includes(searchText.slice(0, 20))) {
        const overlay = createHighlightOverlay(sentence, para);
        if (overlay) sentenceOverlays.set(sentence.id, overlay);
        break;
      }
    }
  }

  /**
   * Create a coloured overlay element over a paragraph.
   * @param {Object} sentence
   * @param {Element} paraEl
   * @returns {Element}
   */
  function createHighlightOverlay(sentence, paraEl) {
    const rect = paraEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const overlay = document.createElement('div');
    overlay.className = `humanify-sentence-overlay humanify-${sentence.color}`;
    overlay.dataset.sentenceId = sentence.id;
    overlay.dataset.score = sentence.score;
    overlay.title = `Score: ${sentence.score}% human — Click to view in panel`;

    // Position relative to viewport + scroll
    overlay.style.cssText = `
      position: absolute;
      left: ${rect.left + window.scrollX}px;
      top: ${rect.top + window.scrollY}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      pointer-events: auto;
      cursor: pointer;
      z-index: 1000;
    `;

    overlay.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'SENTENCE_CLICKED',
        sentenceId: sentence.id,
      });
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Clear all sentence highlights.
   */
  function clearHighlights() {
    sentenceOverlays.forEach(el => el.remove());
    sentenceOverlays.clear();
    if (highlightContainer) {
      highlightContainer.remove();
      highlightContainer = null;
    }
    document.querySelectorAll('.humanify-sentence-overlay').forEach(el => el.remove());
  }

  /**
   * Scroll the document to show a specific sentence.
   * @param {number} sentenceId
   */
  function scrollToSentence(sentenceId) {
    const overlay = sentenceOverlays.get(sentenceId);
    if (overlay) {
      overlay.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight
      overlay.style.outline = '3px solid #6C5CE7';
      setTimeout(() => { overlay.style.outline = ''; }, 2000);
    }
  }

  // ---- Message Listener -------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'EXTRACT_TEXT': {
        const result = extractText();
        sendResponse(result);
        break;
      }

      case 'INJECT_TEXT':
        injectText(message.text).then(sendResponse);
        return true;

      case 'HIGHLIGHT_SENTENCES':
        highlightSentences(message.sentences);
        sendResponse({ success: true });
        break;

      case 'CLEAR_HIGHLIGHTS':
        clearHighlights();
        sendResponse({ success: true });
        break;

      case 'SCROLL_TO_SENTENCE':
        scrollToSentence(message.sentenceId);
        sendResponse({ success: true });
        break;

      case 'PING':
        sendResponse({ pong: true, isGoogleDoc: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
    return false;
  });

  // ---- Utilities -------------------------------------------------------------

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Notify background that content script is loaded
  chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_LOADED' }).catch(() => {});

})();
