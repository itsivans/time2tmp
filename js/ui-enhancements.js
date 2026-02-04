/* ===== UI Enhancements ===== */

/* ===== Button Ripple Effect ===== */
function initRippleEffect() {
  document.addEventListener('click', function(e) {
    const button = e.target.closest('button, .btn, a.btn');
    if (!button) return;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    button.appendChild(ripple);

    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

/* ===== Pull to Refresh ===== */
let ptrStartY = 0;
let ptrDelta = 0;
let ptrRefreshing = false;
let ptrCallback = null;

function initPullToRefresh(callback) {
  ptrCallback = callback;

  // Create indicator if not exists
  if (!document.querySelector('.ptr-indicator')) {
    const indicator = document.createElement('div');
    indicator.className = 'ptr-indicator';
    indicator.innerHTML = '<span class="ptr-arrow">↓</span>';
    document.body.prepend(indicator);
  }

  document.addEventListener('touchstart', handlePtrStart, { passive: true });
  document.addEventListener('touchmove', handlePtrMove, { passive: false });
  document.addEventListener('touchend', handlePtrEnd, { passive: true });
}

function handlePtrStart(e) {
  if (window.scrollY === 0 && !ptrRefreshing) {
    ptrStartY = e.touches[0].pageY;
  }
}

function handlePtrMove(e) {
  if (ptrStartY === 0 || ptrRefreshing) return;

  ptrDelta = e.touches[0].pageY - ptrStartY;

  if (ptrDelta > 0 && window.scrollY === 0) {
    e.preventDefault();
    const indicator = document.querySelector('.ptr-indicator');
    const arrow = indicator.querySelector('.ptr-arrow');

    if (ptrDelta > 20) {
      indicator.classList.add('visible');
    }

    if (ptrDelta > 80) {
      arrow.classList.add('rotate');
    } else {
      arrow.classList.remove('rotate');
    }

    indicator.style.top = Math.min(ptrDelta / 3 - 40, 30) + 'px';
  }
}

async function handlePtrEnd() {
  if (ptrDelta > 80 && !ptrRefreshing && ptrCallback) {
    ptrRefreshing = true;

    const indicator = document.querySelector('.ptr-indicator');
    indicator.innerHTML = '<div class="ptr-spinner"></div>';
    indicator.style.top = '10px';

    try {
      await ptrCallback();
    } catch (e) {
      console.error('Pull to refresh error:', e);
    }

    setTimeout(() => {
      indicator.classList.remove('visible');
      indicator.innerHTML = '<span class="ptr-arrow">↓</span>';
      indicator.style.top = '';
      ptrRefreshing = false;
    }, 500);
  } else {
    const indicator = document.querySelector('.ptr-indicator');
    if (indicator) {
      indicator.classList.remove('visible');
      indicator.style.top = '';
      const arrow = indicator.querySelector('.ptr-arrow');
      if (arrow) arrow.classList.remove('rotate');
    }
  }

  ptrStartY = 0;
  ptrDelta = 0;
}

/* ===== PWA Install Prompt ===== */
let deferredInstallPrompt = null;
const INSTALL_DISMISSED_KEY = 'tt_install_dismissed';

function initInstallPrompt() {
  // Check if already installed or dismissed recently
  const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
    return; // Don't show for 7 days after dismissal
  }

  // Check if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return;
  }

  // Create prompt UI
  const prompt = document.createElement('div');
  prompt.className = 'install-prompt';
  prompt.id = 'installPrompt';
  prompt.innerHTML = `
    <div class="icon">📲</div>
    <div class="content">
      <div class="title">Installa l'app</div>
      <div class="desc">Aggiungi alla schermata home per un accesso rapido</div>
    </div>
    <div class="actions">
      <button class="btn-install" id="installBtn">Installa</button>
      <button class="btn-dismiss" id="dismissInstall">✕</button>
    </div>
  `;
  document.body.appendChild(prompt);

  // Listen for install prompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    // Show our custom prompt after a delay
    setTimeout(() => {
      prompt.classList.add('show');
    }, 3000);
  });

  // Handle install button
  document.getElementById('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;

    if (outcome === 'accepted') {
      showToast('✅ App installata!');
    }

    deferredInstallPrompt = null;
    prompt.classList.remove('show');
  });

  // Handle dismiss button
  document.getElementById('dismissInstall').addEventListener('click', () => {
    prompt.classList.remove('show');
    localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
  });

  // Hide prompt when app is installed
  window.addEventListener('appinstalled', () => {
    prompt.classList.remove('show');
    deferredInstallPrompt = null;
    showToast('✅ App installata con successo!');
  });
}

/* ===== Loading Skeleton Helper ===== */
function showSkeleton(container, count = 3) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card skeleton"></div>
    `;
  }
  container.innerHTML = html;
}

function showSkeletonRows(container, count = 5) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-row">
        <div class="skeleton" style="flex:0.3"></div>
        <div class="skeleton" style="flex:0.5"></div>
        <div class="skeleton" style="flex:0.2"></div>
      </div>
    `;
  }
  container.innerHTML = html;
}

/* ===== Card Animation on Scroll ===== */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  // Observe all cards
  document.querySelectorAll('.card').forEach(card => {
    observer.observe(card);
  });
}

/* ===== Initialize All Enhancements ===== */
function initUIEnhancements(options = {}) {
  // Ripple effect for buttons
  initRippleEffect();

  // Pull to refresh (if callback provided)
  if (options.onRefresh) {
    initPullToRefresh(options.onRefresh);
  }

  // PWA install prompt
  if (options.showInstallPrompt !== false) {
    initInstallPrompt();
  }

  // Scroll animations
  if (options.scrollAnimations !== false) {
    // Delay to allow DOM to settle
    setTimeout(initScrollAnimations, 100);
  }
}

// Auto-init on DOMContentLoaded if not manually called
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Only auto-init basic features, page-specific features need manual init
    initRippleEffect();
  });
} else {
  initRippleEffect();
}
