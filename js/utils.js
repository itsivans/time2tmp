/**
 * Shared Utility Functions
 * Used across all pages for common operations
 */

/* ===== DOM Helpers ===== */
window.$ = s => document.querySelector(s);
window.$$ = s => document.querySelectorAll(s);

// Aliases for convenience
const $ = window.$;
const $$ = window.$$;

/* ===== Security: Input Sanitization ===== */

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} unsafe - Untrusted user input
 * @returns {string} Safe HTML-escaped string
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ===== Toast Notifications ===== */

/**
 * Shows a temporary toast notification
 * @param {string} text - Message to display
 * @param {number} duration - Duration in milliseconds (default: 1600)
 */
function showToast(text, duration = 1600) {
  const toastEl = $('#toast');
  if (!toastEl) return;

  toastEl.textContent = text;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

/* ===== Loading States ===== */

let loadingElement = null;

/**
 * Shows a loading indicator
 * @param {string} message - Optional loading message
 */
function showLoading(message = 'Caricamento...') {
  if (loadingElement) return; // Already showing

  loadingElement = document.createElement('div');
  loadingElement.id = 'globalLoader';
  loadingElement.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(2px);
    ">
      <div style="
        background: var(--card);
        color: var(--text);
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        text-align: center;
        font-size: 16px;
      ">
        <div style="margin-bottom: 10px; font-size: 32px;">⏳</div>
        ${escapeHtml(message)}
      </div>
    </div>
  `;
  document.body.appendChild(loadingElement);
}

/**
 * Hides the loading indicator
 */
function hideLoading() {
  if (loadingElement) {
    loadingElement.remove();
    loadingElement = null;
  }
}

/* ===== Error Handling ===== */

/**
 * Maps Firebase auth error codes to Italian messages
 * @param {string} code - Firebase error code
 * @param {string} fallback - Fallback message
 * @returns {string} Italian error message
 */
function mapAuthError(code, fallback) {
  const map = {
    'auth/invalid-email': 'Email non valida.',
    'auth/invalid-credential': 'Email o password errata. Verifica i tuoi dati o registrati.',
    'auth/user-not-found': 'Utente non trovato.',
    'auth/wrong-password': 'Password errata.',
    'auth/email-already-in-use': 'Email già in uso.',
    'auth/too-many-requests': 'Troppe richieste, riprova più tardi.',
    'auth/weak-password': 'Password troppo debole. Usa almeno 6 caratteri.',
    'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
    'auth/user-disabled': 'Questo account è stato disabilitato.',
    'auth/operation-not-allowed': 'Operazione non consentita. Contatta il supporto.'
  };
  return map[code] || fallback || 'Errore di autenticazione.';
}

/**
 * Handles Firebase operations with proper error handling
 * @param {Function} operation - Async Firebase operation
 * @param {string} errorMessage - Error message to show on failure
 * @returns {Promise<any>} Result of operation or null on error
 */
async function safeFirebaseCall(operation, errorMessage = 'Operazione fallita') {
  try {
    return await operation();
  } catch (error) {
    console.error('Firebase error:', error);

    // Network errors
    if (error.code === 'unavailable' || error.code === 'failed-precondition') {
      showToast('❌ Connessione assente. Riprova quando sei online.', 2500);
      return null;
    }

    // Permission errors
    if (error.code === 'permission-denied') {
      showToast('⛔ Permesso negato. Effettua nuovamente il login.', 2500);
      if (typeof auth !== 'undefined') {
        setTimeout(() => auth.signOut(), 1000);
      }
      return null;
    }

    // Auth errors - use mapAuthError for proper Italian messages
    if (error.code && error.code.startsWith('auth/')) {
      const italianMessage = mapAuthError(error.code, error.message);
      showToast(`❌ ${italianMessage}`, 2500);
      return null;
    }

    // Generic error
    showToast(`❌ ${errorMessage}: ${error.message}`, 2500);
    return null;
  }
}

/* ===== Date & Time Utilities ===== */

/**
 * Gets current local date-time in ISO format (for datetime-local input)
 * @returns {string} ISO datetime string (YYYY-MM-DDTHH:mm)
 */
function getLocalISODateTimeNow() {
  const now = new Date();
  now.setSeconds(0, 0);
  const tz = -now.getTimezoneOffset();
  return new Date(now.getTime() + tz * 60000).toISOString().slice(0, 16);
}

/**
 * Formats ISO timestamp for display
 * @param {string} ts - ISO 8601 timestamp
 * @returns {string} Formatted date string (DD/MM, HH:mm)
 */
function formatTimestamp(ts) {
  try {
    const d = new Date(ts);
    if (!isNaN(d)) {
      return d.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch {}
  return ts;
}

/**
 * Gets today's date in YYYY-MM-DD format (Italy timezone)
 * @returns {string} Date string
 */
function todayYMD() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60000);
  return localDate.toISOString().split('T')[0];
}

/**
 * Converts YYYY-MM-DD to start of day ISO timestamp
 * @param {string} ymd - Date in YYYY-MM-DD format
 * @returns {string} ISO timestamp at 00:00:00
 */
function ymdToStartISO(ymd) {
  return `${ymd}T00:00:00`;
}

/**
 * Converts YYYY-MM-DD to end of day ISO timestamp
 * @param {string} ymd - Date in YYYY-MM-DD format
 * @returns {string} ISO timestamp at 23:59:59
 */
function ymdToEndISO(ymd) {
  return `${ymd}T23:59:59`;
}

/* ===== Local Storage Helpers ===== */

/**
 * Safely gets item from localStorage
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Stored value or default
 */
function getLocal(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely sets item in localStorage
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 */
function setLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage.setItem failed:', e);
  }
}

/**
 * Safely removes item from localStorage
 * @param {string} key - Storage key
 */
function removeLocal(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('localStorage.removeItem failed:', e);
  }
}

/**
 * Gets JSON from localStorage with parsing
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if not found/invalid
 * @returns {any} Parsed JSON or default
 */
function getLocalJSON(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Sets JSON in localStorage with stringification
 * @param {string} key - Storage key
 * @param {any} value - Value to store (will be JSON.stringify'd)
 */
function setLocalJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage JSON.stringify failed:', e);
  }
}

/* ===== Nickname Helpers ===== */

const NICK_KEY = 'timeNickname';

/**
 * Loads nickname from localStorage
 * @returns {string} Nickname or empty string
 */
function loadNick() {
  return getLocal(NICK_KEY, '');
}

/**
 * Saves nickname to localStorage
 * @param {string} value - Nickname to save
 */
function saveNick(value) {
  setLocal(NICK_KEY, value || '');
}

/**
 * Removes nickname from localStorage
 */
function clearNick() {
  removeLocal(NICK_KEY);
}

/**
 * Extracts name from email address
 * @param {string} email - Email address
 * @returns {string} Name part before @
 */
function nameFromEmail(email) {
  return (email || '').split('@')[0];
}

/* ===== Network Status Detection ===== */

/**
 * Initializes online/offline detection with toast notifications
 */
function initNetworkDetection() {
  window.addEventListener('online', () => {
    showToast('✅ Connessione ripristinata');
  });

  window.addEventListener('offline', () => {
    showToast('⚠️ Sei offline. Le modifiche verranno sincronizzate quando tornerai online.', 3000);
  });
}

/* ===== Keyboard Shortcuts ===== */

/**
 * Sets up common keyboard shortcuts
 * @param {Object} shortcuts - Map of key combos to handlers
 * Example: { 'ctrl+k': () => $('#activity').focus() }
 */
function initKeyboardShortcuts(shortcuts = {}) {
  document.addEventListener('keydown', (e) => {
    const combo = [
      e.ctrlKey && 'ctrl',
      e.altKey && 'alt',
      e.shiftKey && 'shift',
      e.key.toLowerCase()
    ].filter(Boolean).join('+');

    if (shortcuts[combo]) {
      e.preventDefault();
      shortcuts[combo](e);
    }
  });
}

/* ===== Debounce Utility ===== */

/**
 * Debounces a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/* ===== Rate Limiting ===== */

/**
 * Creates a rate limiter
 * @param {number} minInterval - Minimum milliseconds between calls
 * @returns {Object} Rate limiter with canProceed() method
 */
function createRateLimiter(minInterval = 1000) {
  let lastCall = 0;

  return {
    canProceed() {
      const now = Date.now();
      if (now - lastCall < minInterval) {
        return false;
      }
      lastCall = now;
      return true;
    },
    reset() {
      lastCall = 0;
    }
  };
}

/* ===== Make all functions globally available ===== */
// Since we're not using ES6 modules, attach functions to window for cross-script access

window.escapeHtml = escapeHtml;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.mapAuthError = mapAuthError;
window.safeFirebaseCall = safeFirebaseCall;
window.getLocalISODateTimeNow = getLocalISODateTimeNow;
window.formatTimestamp = formatTimestamp;
window.todayYMD = todayYMD;
window.ymdToStartISO = ymdToStartISO;
window.ymdToEndISO = ymdToEndISO;
window.getLocal = getLocal;
window.setLocal = setLocal;
window.removeLocal = removeLocal;
window.getLocalJSON = getLocalJSON;
window.setLocalJSON = setLocalJSON;
window.loadNick = loadNick;
window.saveNick = saveNick;
window.clearNick = clearNick;
window.nameFromEmail = nameFromEmail;
window.initNetworkDetection = initNetworkDetection;
window.initKeyboardShortcuts = initKeyboardShortcuts;
window.debounce = debounce;
window.createRateLimiter = createRateLimiter;
