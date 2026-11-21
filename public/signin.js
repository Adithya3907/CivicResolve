(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const errorBox = document.getElementById('signin-error');
    const buttons = document.querySelectorAll('[data-demo-account]');

    const accounts = {
      citizen: {
        email: 'demo.citizen@civicresolve.in',
        password: 'test123',
        destination: '/index.html#report',
        label: 'Signing in as Citizen...'
      },
      staff: {
        email: 'demo.staff@civicresolve.in',
        password: 'test123',
        destination: '/staff.html#overview',
        label: 'Signing in as Staff...'
      }
    };

    buttons.forEach(function (button) {
      button.addEventListener('click', async function () {
        const account = accounts[button.dataset.demoAccount];
        if (!account) return;

        errorBox.textContent = '';
        buttons.forEach(function (item) { item.disabled = true; });
        const originalText = button.textContent;
        button.textContent = account.label;

        try {
          if (!window.AuthClient) {
            throw new Error('Authentication is not ready. Refresh and try again.');
          }

          await window.AuthClient.signInWithEmail(
            account.email,
            account.password
          );

          window.location.assign(account.destination);
        } catch (error) {
          errorBox.textContent = error.message || 'Sign-in failed. Please try again.';
          buttons.forEach(function (item) { item.disabled = false; });
          button.textContent = originalText;
        }
      });
    });
  });
})();