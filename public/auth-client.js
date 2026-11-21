/**
 * auth-client.js — CivicResolve Firebase Auth Client
 * Exposes window.AuthClient = { init, signInWithGoogle, signInWithPhone, confirmOTP, signInWithEmail, signOut, getUser }
 * Fires CustomEvent('authStateChanged', { detail: user | null }) on document
 */
(function () {
  'use strict';

  const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/9.23.0/';
  let _initialized = false;
  let _firebaseApp = null;
  let _auth = null;

  /* ─── helpers ─── */

  function dispatch(user) {
    document.dispatchEvent(new CustomEvent('authStateChanged', { detail: user || null }));
  }

  function updateNav(user) {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;
    if (user) {
      const name = user.displayName || user.email || user.phoneNumber || 'User';
      navAuth.innerHTML = `
        <span class="nav-user-name" aria-label="Signed in as ${name}">${name}</span>
        <button class="nav-sign-out-btn" id="nav-sign-out-btn" type="button">Sign Out</button>
      `;
      const btn = navAuth.querySelector('#nav-sign-out-btn');
      if (btn) btn.addEventListener('click', () => AuthClient.signOut());
    } else {
      navAuth.innerHTML = `<a href="/signin.html" class="nav-sign-in-link">Sign In</a>`;
    }
  }

  function showConfigError(msg) {
    const banner = document.createElement('div');
    banner.role = 'alert';
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;background:#c0392b;color:#fff;padding:12px 20px;z-index:9999;text-align:center;font-family:sans-serif;';
    banner.textContent = msg;
    document.body.prepend(banner);
  }

  /* ─── dynamic SDK loader ─── */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(s);
    });
  }

  async function loadFirebaseSDK() {
    if (window.firebase && window.firebase.auth) return; // already loaded
    await loadScript(FIREBASE_CDN + 'firebase-app-compat.js');
    await loadScript(FIREBASE_CDN + 'firebase-auth-compat.js');
  }

  /* ─── session management ─── */

  async function postSession(idToken) {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Session error (${res.status})`);
    }
    return res.json();
  }

  /* ─── public API ─── */

  const AuthClient = {
    /**
     * init() — fetch config, load SDK, wire auth state listener.
     * Call once from your page script or DOMContentLoaded.
     */
    async init() {
      if (_initialized) return;
      _initialized = true;

      let config;
      try {
        const res = await fetch('/api/config', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`/api/config responded ${res.status}`);
        config = await res.json();
      } catch (err) {
        console.error('[AuthClient] Could not fetch Firebase config:', err);
        showConfigError('Authentication service is temporarily unavailable. Some features may not work.');
        return;
      }

      try {
        await loadFirebaseSDK();
      } catch (err) {
        console.error('[AuthClient] Could not load Firebase SDK:', err);
        showConfigError('Could not load authentication library. Please refresh the page.');
        return;
      }

      const firebaseConfig = (config && config.firebase) || config;
      if (!firebaseConfig || !firebaseConfig.apiKey) {
        console.error('[AuthClient] Missing Firebase API Key in configuration.');
        showConfigError('Authentication configuration is incomplete. Please contact support.');
        return;
      }

      try {
        // Avoid duplicate app initialisation on HMR / multi-import scenarios
        _firebaseApp = window.firebase.apps.length
          ? window.firebase.app()
          : window.firebase.initializeApp(firebaseConfig);
        _auth = window.firebase.auth(_firebaseApp);

        // Wire auth state observer
        _auth.onAuthStateChanged((user) => {
          updateNav(user);
          dispatch(user);
        });
      } catch (err) {
        console.error('[AuthClient] Firebase init failed:', err);
        showConfigError('Authentication initialisation failed. Please refresh the page.');
      }
    },

    /**
     * signInWithGoogle() — OAuth popup flow.
     * Resolves with Firebase User on success.
     */
    async signInWithGoogle() {
      if (!_auth) throw new Error('AuthClient not initialised');
      const provider = new window.firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      const result = await _auth.signInWithPopup(provider);
      const idToken = await result.user.getIdToken();
      await postSession(idToken);
      return result.user;
    },

    /**
     * signInWithPhone(phoneNumber, recaptchaContainerId)
     * Returns a confirmation object; call AuthClient.confirmOTP(confirmation, otp) next.
     */
    async signInWithPhone(phoneNumber, recaptchaContainerId) {
      if (!_auth) throw new Error('AuthClient not initialised');
      const verifier = new window.firebase.auth.RecaptchaVerifier(recaptchaContainerId, {
        size: 'normal',
        callback: () => { /* reCAPTCHA solved */ },
        'expired-callback': () => { console.warn('[AuthClient] reCAPTCHA expired — please retry'); },
      });
      const confirmation = await _auth.signInWithPhoneNumber(phoneNumber, verifier);
      return confirmation;
    },

    /**
     * confirmOTP(confirmation, otp)
     * Resolves with Firebase User on success.
     */
    async confirmOTP(confirmation, otp) {
      if (!confirmation) throw new Error('No confirmation object — call signInWithPhone first');
      const result = await confirmation.confirm(otp);
      const idToken = await result.user.getIdToken();
      await postSession(idToken);
      return result.user;
    },

    /**
     * signInWithEmail(email, password) — staff / admin only.
     * Resolves with Firebase User on success.
     */
    async signInWithEmail(email, password) {
      if (!_auth) throw new Error('AuthClient not initialised');
      const result = await _auth.signInWithEmailAndPassword(email, password);
      const idToken = await result.user.getIdToken();
      await postSession(idToken);
      return result.user;
    },

    /**
     * signOut() — clears server session and Firebase local state.
     */
    async signOut() {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch (err) {
        console.warn('[AuthClient] Server logout failed (continuing):', err);
      }
      if (_auth) await _auth.signOut();
      updateNav(null);
      dispatch(null);
    },

    /**
     * getUser() — returns current Firebase User or null (synchronous).
     */
    getUser() {
      return (_auth && _auth.currentUser) || null;
    },
  };

  /* ─── expose globally ─── */
  window.AuthClient = AuthClient;

  /* ─── auto-init on DOM ready ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuthClient.init());
  } else {
    AuthClient.init();
  }
})();
