import { login, logout, isLoggedIn } from './auth.js';
import { loadProfile } from './profile.js';

// ─── View helpers ─────────────────────────────────────────────────────────────

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function setError(message) {
  const el = document.getElementById('login-error');
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearError() {
  const el = document.getElementById('login-error');
  el.textContent = '';
  el.classList.add('hidden');
}

function setLoading(active) {
  const btn = document.getElementById('login-btn');
  btn.disabled = active;
  btn.textContent = active ? 'Signing in…' : 'Sign In';
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();

  const identifier = document.getElementById('identifier').value.trim();
  const password   = document.getElementById('password').value;

  if (!identifier || !password) {
    setError('Please fill in both fields.');
    return;
  }

  clearError();
  setLoading(true);

  try {
    await login(identifier, password);
    showView('profile-view');
    await loadProfile();
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

function handleLogout() {
  logout();
  document.getElementById('login-form').reset();
  clearError();
  showView('login-view');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  if (isLoggedIn()) {
    showView('profile-view');
    loadProfile();
  } else {
    showView('login-view');
  }
}

document.addEventListener('DOMContentLoaded', init);
