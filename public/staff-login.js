/**
 * staff-login.js — Staff / Officer / Admin Login controller
 * Externalized to comply with strict Content Security Policy (no inline scripts).
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('staff-login-form');
    const errBox = document.getElementById('auth-error');
    const btnSubmit = document.getElementById('btn-staff-submit');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (errBox) errBox.textContent = '';
        const emailInput = document.getElementById('staff-email');
        const passwordInput = document.getElementById('staff-password');
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        if (!email || !password) {
          if (errBox) errBox.textContent = 'Please enter both email and password.';
          return;
        }

        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.textContent = 'Authenticating…';
        }

        try {
          await window.AuthClient.signInWithEmail(email, password);
          window.location.href = 'staff.html#overview';
        } catch (err) {
          if (errBox) errBox.textContent = err.message || 'Invalid email or password.';
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Sign In to Console';
          }
        }
      });
    }
  });
})();
