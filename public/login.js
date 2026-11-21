/**
 * login.js — Citizen Login controller (Google Sign-In & Phone OTP)
 * Externalized to comply with strict Content Security Policy (no inline scripts).
 */
(function () {
  'use strict';

  let confirmationResult = null;

  document.addEventListener('DOMContentLoaded', () => {
    const authErr = document.getElementById('auth-error');
    const btnGoogle = document.getElementById('btn-google-signin');
    const phoneForm = document.getElementById('phone-form');
    const stepPhone = document.getElementById('step-phone');
    const stepOtp = document.getElementById('step-otp');
    const btnVerifyOtp = document.getElementById('btn-verify-otp');
    const btnBackPhone = document.getElementById('btn-back-phone');

    if (btnGoogle) {
      btnGoogle.addEventListener('click', async () => {
        if (authErr) authErr.textContent = '';
        btnGoogle.disabled = true;
        try {
          await window.AuthClient.signInWithGoogle();
          window.location.href = 'index.html#report';
        } catch (err) {
          if (authErr) authErr.textContent = err.message || 'Google sign-in failed.';
          btnGoogle.disabled = false;
        }
      });
    }

    if (phoneForm) {
      phoneForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authErr) authErr.textContent = '';
        const phoneInput = document.getElementById('phone-number');
        const phone = phoneInput ? phoneInput.value.trim() : '';
        if (!phone) {
          if (authErr) authErr.textContent = 'Please enter a valid mobile number.';
          return;
        }
        try {
          confirmationResult = await window.AuthClient.signInWithPhone(phone, 'recaptcha-container');
          if (stepPhone) stepPhone.style.display = 'none';
          if (stepOtp) stepOtp.style.display = 'block';
        } catch (err) {
          if (authErr) authErr.textContent = err.message || 'Failed to send OTP.';
        }
      });
    }

    if (btnVerifyOtp) {
      btnVerifyOtp.addEventListener('click', async () => {
        if (authErr) authErr.textContent = '';
        const codeInput = document.getElementById('otp-code');
        const code = codeInput ? codeInput.value.trim() : '';
        if (code.length < 6) {
          if (authErr) authErr.textContent = 'Please enter the complete 6-digit code.';
          return;
        }
        try {
          await window.AuthClient.confirmOTP(confirmationResult, code);
          window.location.href = 'index.html#my-reports';
        } catch (err) {
          if (authErr) authErr.textContent = err.message || 'Invalid verification code.';
        }
      });
    }

    if (btnBackPhone) {
      btnBackPhone.addEventListener('click', () => {
        if (stepOtp) stepOtp.style.display = 'none';
        if (stepPhone) stepPhone.style.display = 'block';
        if (authErr) authErr.textContent = '';
      });
    }
  });
})();
