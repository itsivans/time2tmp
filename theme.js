// theme.js — toggle tema condiviso per tutte le pagine
(function () {
  const KEY = 'tt_theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch {}
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = (theme === 'dark') ? '☀️' : '🌙';
  }

  function initTheme() {
    let theme = 'light';
    try {
      theme = localStorage.getItem(KEY) || 'light';
    } catch {}
    applyTheme(theme);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  // Expose per uso manuale se serve
  window.theme = { applyTheme, toggleTheme };

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
  function ready() {
    initTheme();
    const btn = document.getElementById('themeBtn');
    if (btn) btn.addEventListener('click', toggleTheme);
  }
})();
