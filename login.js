// Admin Login — change password here
const ADMIN_PASSWORD = 'leon2026';
const SESSION_KEY = 'chatbot_admin_auth';

const overlay = document.getElementById('loginOverlay');
const form = document.getElementById('loginForm');
const input = document.getElementById('loginPassword');
const error = document.getElementById('loginError');

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

function showDashboard() {
  overlay.style.display = 'none';
}

if (isLoggedIn()) {
  showDashboard();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, '1');
    showDashboard();
  } else {
    error.classList.remove('hidden');
    input.value = '';
    input.focus();
  }
});
