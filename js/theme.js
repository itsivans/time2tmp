/**
 * Theme Management
 * Handles light/dark mode switching and persistence
 */

const THEME_KEY = 'tt_theme';

/**
 * Gets the current theme (light or dark)
 * @returns {string} 'light' or 'dark'
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * Applies a theme to the page
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Save to localStorage
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.warn('Failed to save theme preference:', e);
  }

  // Update theme button if it exists
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  // Update meta theme-color for PWA
  updateThemeColor(theme);
}

/**
 * Updates the theme-color meta tag for PWA
 * @param {string} theme - 'light' or 'dark'
 */
function updateThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0b1118' : '#2196f3');
  }
}

/**
 * Toggles between light and dark theme
 */
function toggleTheme() {
  const current = getCurrentTheme();
  const newTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

/**
 * Initializes theme from saved preference or system preference
 * Should be called on page load
 */
function initTheme() {
  // Check for saved preference
  let theme;
  try {
    theme = localStorage.getItem(THEME_KEY);
  } catch (e) {
    console.warn('Failed to read theme preference:', e);
  }

  // Fall back to system preference
  if (!theme) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }

  applyTheme(theme);
}

/**
 * Sets up theme toggle button
 * Call this after DOM is ready
 */
function setupThemeButton() {
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
    // Set initial button state
    const current = getCurrentTheme();
    themeBtn.textContent = current === 'dark' ? '☀️' : '🌙';
    themeBtn.setAttribute('aria-pressed', current === 'dark' ? 'true' : 'false');
  }
}

/**
 * Pre-initializes theme before page render to prevent flash
 * This should be inlined in <head> for best results
 */
function preInitTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // Silent fail - will use default light theme
  }
}

// Auto-initialize theme when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupThemeButton();
  });
} else {
  initTheme();
  setupThemeButton();
}
