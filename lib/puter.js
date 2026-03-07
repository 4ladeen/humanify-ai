/**
 * puter.js - Minimal Puter.js API Client for Chrome Extension
 *
 * Chrome Extension Manifest V3 enforces a strict Content Security Policy
 * (script-src 'self') that blocks loading scripts from external domains.
 * Instead of bundling the full Puter.js SDK, this file implements a minimal
 * API client that authenticates via Puter.com popup and makes direct API
 * calls to api.puter.com, matching the surface used by this extension.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // If the real SDK has already populated window.puter, leave it untouched.
  if (window.puter && !window.puter.__isStub) return;

  const API_ORIGIN = 'https://api.puter.com';
  const GUI_ORIGIN = 'https://puter.com';

  let authToken = null;
  let _msgId = 1;

  /**
   * Load saved auth token from chrome.storage.local.
   * @returns {Promise<string|null>}
   */
  async function loadToken() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get('puterAuthToken');
        if (result.puterAuthToken) {
          authToken = result.puterAuthToken;
        }
      }
    } catch (_) { /* storage unavailable outside extension context */ }
    return authToken;
  }

  /**
   * Persist auth token to chrome.storage.local.
   * @param {string} token
   */
  async function saveToken(token) {
    authToken = token;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ puterAuthToken: token });
      }
    } catch (_) { /* storage unavailable outside extension context */ }
  }

  /**
   * Open a Puter.com sign-in popup and return the auth token via postMessage.
   * Uses attempt_temp_user_creation so no manual sign-up is needed.
   * @returns {Promise<string>} auth token
   */
  function authenticate() {
    return new Promise((resolve, reject) => {
      const msgId = _msgId++;
      const w = 600, h = 700;
      const left = Math.round((screen.width / 2) - (w / 2));
      const top = Math.round((screen.height / 2) - (h / 2));

      const popup = window.open(
        `${GUI_ORIGIN}/action/sign-in?embedded_in_popup=true&msg_id=${msgId}&attempt_temp_user_creation=true`,
        'Puter Sign In',
        `toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,copyhistory=no,width=${w},height=${h},top=${top},left=${left}`
      );

      if (!popup) {
        reject(new Error('Could not open sign-in popup. Please allow popups for this extension.'));
        return;
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handler);
          const err = new Error('Authentication window was closed');
          err.isAuthCancellation = true;
          reject(err);
        }
      }, 500);

      function handler(e) {
        if (e.data && String(e.data.msg_id) === String(msgId)) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handler);
          if (e.data.success && e.data.token) {
            saveToken(e.data.token).then(() => resolve(e.data.token));
          } else {
            reject(new Error(e.data.error || 'Authentication failed'));
          }
        }
      }

      window.addEventListener('message', handler);
    });
  }

  /**
   * Ensure we have a valid auth token, prompting sign-in if necessary.
   * @returns {Promise<string>}
   */
  async function ensureAuth() {
    if (authToken) return authToken;
    await loadToken();
    if (authToken) return authToken;
    return await authenticate();
  }

  /**
   * Call a Puter driver endpoint.
   * @param {string} iface   - driver interface (e.g. 'puter-chat-completion')
   * @param {string} driver  - driver name (e.g. 'ai-chat')
   * @param {string} method  - method name (e.g. 'complete')
   * @param {Object} args    - method arguments
   * @returns {Promise<Object>}
   */
  async function callDriver(iface, driver, method, args) {
    const token = await ensureAuth();

    let resp = await fetch(`${API_ORIGIN}/drivers/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interface: iface,
        driver: driver,
        method: method,
        args: args,
        auth_token: token,
      }),
    });

    // If 401, token is expired — re-authenticate and retry once
    if (resp.status === 401) {
      authToken = null;
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.remove('puterAuthToken');
        }
      } catch (e) { console.warn('Humanify: failed to clear expired token', e); }

      const newToken = await authenticate();

      resp = await fetch(`${API_ORIGIN}/drivers/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interface: iface,
          driver: driver,
          method: method,
          args: args,
          auth_token: newToken,
        }),
      });
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'Unable to read response body');
      throw new Error('Puter API call failed (' + resp.status + '): ' + errText);
    }

    return resp.json();
  }

  /**
   * puter.ai.chat(promptOrMessages, options) — compatible with the Puter.js SDK.
   * @param {string|Array} promptOrMessages
   * @param {{ model?: string, temperature?: number, max_tokens?: number }} options
   * @returns {Promise<Object>}
   */
  async function chat(promptOrMessages, options) {
    options = options || {};
    let messages;
    if (typeof promptOrMessages === 'string') {
      messages = [{ content: promptOrMessages }];
    } else if (Array.isArray(promptOrMessages)) {
      messages = promptOrMessages;
    } else {
      throw new Error('Invalid argument: expected string prompt or array of messages');
    }

    const args = { messages: messages };
    if (options.model) args.model = options.model;
    if (options.temperature) args.temperature = options.temperature;
    if (options.max_tokens) args.max_tokens = options.max_tokens;

    const result = await callDriver(
      'puter-chat-completion', 'ai-chat', 'complete', args
    );

    // Add toString/valueOf for SDK compatibility
    if (result && result.message) {
      result.toString = function () { return this.message.content; };
      result.valueOf = function () { return this.message.content; };
    }

    return result;
  }

  window.puter = {
    __isStub: false,
    APIOrigin: API_ORIGIN,
    defaultGUIOrigin: GUI_ORIGIN,
    env: 'web',
    ai: { chat: chat },
    auth: {
      signIn: authenticate,
      isSignedIn: function () { return !!authToken; },
      signOut: function () {
        authToken = null;
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove('puterAuthToken');
          }
        } catch (e) { console.warn('Humanify: signOut storage error', e); }
      },
    },
    setAuthToken: saveToken,
    resetAuthToken: function () {
      authToken = null;
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove('puterAuthToken');
        }
      } catch (e) { console.warn('Humanify: resetAuthToken storage error', e); }
    },
    _loadToken: loadToken,
  };

  // Eagerly load any previously-saved token so subsequent checks see it
  loadToken();
})();
