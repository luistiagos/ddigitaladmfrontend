// Token key used throughout the app
const TOKEN_KEY = 'adminToken';
const USER_KEY = 'adminUser';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredAdmin() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function storeAdmin(user, token) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAdmin() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  try {
    // Verifica apenas que o token é um JWT válido (3 partes)
    // Expiração não é checada no cliente — o servidor rejeita tokens inválidos
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    // JWT usa base64url (- e _); atob requer base64 padrão (+ e /)
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
    JSON.parse(atob(padded)); // valida que o payload é JSON
    return true;
  } catch {
    return false;
  }
}
