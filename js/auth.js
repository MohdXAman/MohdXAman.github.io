const DOMAIN = 'learn.reboot01.com';
const AUTH_URL = `https://${DOMAIN}/api/auth/signin`;
const TOKEN_KEY = 'graphql_jwt';

export async function login(identifier, password) {
  const credentials = btoa(`${identifier}:${password}`);
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    let message = 'Invalid credentials. Please check your username/email and password.';
    try {
      const body = await response.json();
      if (body.error) message = body.error;
    } catch { /* body may not be JSON */ }
    throw new Error(message);
  }

  const token = await response.json();
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

export function isLoggedIn() {
  const token = getToken();
  if (!token) return false;
  try {
    const { exp } = decodeJWT(token);
    return exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getUserId() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = decodeJWT(token);
    const claims = payload['https://hasura.io/jwt/claims'];
    return claims ? Number(claims['x-hasura-user-id']) : null;
  } catch {
    return null;
  }
}
