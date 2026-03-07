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
   * Build the headers and body for a driver call request.
   * @param {string} iface  - driver interface
   * @param {string} driver - driver name
   * @param {string} method - method name
   * @param {Object} args   - method arguments
   * @param {string} token  - auth token
   * @returns {{ headers: Object, body: string }}
   */
  function buildDriverRequest(iface, driver, method, args, token) {
    return {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        interface: iface,
        driver: driver,
        method: method,
        args: args,
        auth_token: token,
      }),
    };
  }

  /**
   * Parse a Puter driver API response.
   * The API wraps results as { success: bool, result: <payload> }.
   * This mirrors the SDK's driverCall_ unwrap logic.
   * @param {Response} resp - fetch Response
   * @returns {Promise<Object>} the unwrapped result payload
   */
  async function parseDriverResponse(resp) {
    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'Unable to read response body');
      const err = new Error('Puter API call failed (' + resp.status + '): ' + errText);
      if (resp.status >= 500 && resp.status < 600) err.isGatewayError = true;
      throw err;
    }

    let json;
    try {
      json = await resp.json();
    } catch (_) {
      throw new Error('Puter API returned invalid JSON');
    }

    // The API signals driver-level errors via { success: false, error: {...} }
    if (json.success === false) {
      const code = json.error?.code || '';
      const message = json.error?.message || (json.error ? JSON.stringify(json.error) : 'Unknown driver error');
      const err = new Error('Puter driver error (' + code + '): ' + message);
      err.code = code;
      throw err;
    }

    // Unwrap: the actual payload lives under "result" (matches SDK driverCall_)
    return json.result !== undefined ? json.result : json;
  }

  /**
   * Call a Puter driver endpoint.
   * Sends auth both as an Authorization header and in the body (belt-and-suspenders).
   * Retries once on 401 after re-authentication.
   * @param {string} iface   - driver interface (e.g. 'puter-chat-completion')
   * @param {string} driver  - driver name (e.g. 'ai-chat')
   * @param {string} method  - method name (e.g. 'complete')
   * @param {Object} args    - method arguments
   * @returns {Promise<Object>} unwrapped result payload
   */
  async function callDriver(iface, driver, method, args) {
    const token = await ensureAuth();
    const req = buildDriverRequest(iface, driver, method, args, token);

    let resp;
    try {
      resp = await fetch(API_ORIGIN + '/drivers/call', { method: 'POST', headers: req.headers, body: req.body });
    } catch (networkErr) {
      const err = new Error('Network error calling Puter API: ' + (networkErr.message || 'check your connection'));
      err.isGatewayError = true;
      throw err;
    }

    // If 401 or token_auth_failed, re-authenticate and retry once
    if (resp.status === 401) {
      authToken = null;
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.remove('puterAuthToken');
        }
      } catch (e) { console.warn('Humanify: failed to clear expired token', e); }

      const newToken = await authenticate();
      const retryReq = buildDriverRequest(iface, driver, method, args, newToken);

      try {
        resp = await fetch(API_ORIGIN + '/drivers/call', { method: 'POST', headers: retryReq.headers, body: retryReq.body });
      } catch (networkErr) {
        const err = new Error('Network error calling Puter API: ' + (networkErr.message || 'check your connection'));
        err.isGatewayError = true;
        throw err;
      }
    }

    return parseDriverResponse(resp);
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
      messages = [{ role: 'user', content: promptOrMessages }];
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
