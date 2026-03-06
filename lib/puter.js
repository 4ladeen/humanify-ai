/**
 * puter.js - Local bundle/stub for the Puter.js SDK
 *
 * Chrome Extension Manifest V3 enforces a strict Content Security Policy
 * (script-src 'self') that blocks loading scripts from external domains.
 * The Puter.js SDK must therefore be bundled locally within the extension.
 *
 * HOW TO REPLACE THIS STUB WITH THE REAL SDK:
 *   Download the Puter.js SDK and overwrite this file:
 *     curl -o lib/puter.js https://js.puter.com/v2/
 *
 * When the real SDK is present this stub is a no-op (it detects window.puter
 * was already set by the SDK and exits immediately). Until then the stub
 * defines a minimal puter global that prevents ReferenceError crashes and
 * surfaces a clear "service unavailable" message to the user.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // If the real SDK has already populated window.puter (e.g. loaded before
  // this file), leave it untouched.
  if (window.puter && !window.puter.__isStub) return;

  function unavailable() {
    return Promise.reject(
      new Error('Puter.js AI service is not available. Please check your connection.')
    );
  }

  /**
   * Minimal puter stub — mirrors only the surface used by this extension.
   * __isStub is checked by checkPuterAvailability() in sidepanel.js and by
   * the guards in humanizer.js / detector.js to disable AI features cleanly.
   */
  window.puter = {
    __isStub: true,
    ai: {
      chat: unavailable,
    },
  };
})();
