// Admin Login — password stored server-side only (ADMIN_PASSWORD env var on Render)
const BACKEND = 'https://chatbot-widget-kaqe.onrender.com';
const SESSION_KEY = 'chatbot_admin_token';

const overlay = document.getElementById('loginOverlay');
const form = document.getElementById('loginForm');
const input = document.getElementById('loginPassword');
const error = document.getElementById('loginError');

function getToken() {
  return sessionStorage.getItem(SESSION_KEY);
}

async function verifyToken(token) {
  // Token is a JWT — decode payload to check expiry client-side
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role === 'admin' && payload.exp * 1000 > Date.now();
  } catch { return false; }
}

async function init() {
  const token = getToken();
  if (token && await verifyToken(token)) {
    overlay.style.display = 'none';
  }
}
init();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.classList.add('hidden');

  const password = input.value;
  input.value = '';

  try {
    const res = await fetch(`${BACKEND}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (!res.ok) {
      error.textContent = data.error || 'Login fehlgeschlagen.';
      error.classList.remove('hidden');
      input.focus();
      return;
    }

    sessionStorage.setItem(SESSION_KEY, data.token);
    overlay.style.display = 'none';
  } catch (err) {
    error.textContent = 'Server nicht erreichbar. Versuche es später.';
    error.classList.remove('hidden');
    input.focus();
  }
});
