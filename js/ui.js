function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const card = document.createElement('div');
  card.className = `toast-card toast-${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check_circle';
  else if (type === 'error') icon = 'error';
  else if (type === 'warning') icon = 'warning';
  
  card.innerHTML = `<i class="material-icons-round toast-icon">${icon}</i><span class="toast-msg">${message}</span>`;
  card.onclick = () => card.remove();
  
  container.appendChild(card);
  setTimeout(() => {
    card.style.animation = 'toastSlideIn 0.3s cubic-bezier(0.2, 1, 0.2, 1) reverse forwards';
    setTimeout(() => card.remove(), 300);
  }, 3500);
}

window.alert = function(message) {
  let type = 'info';
  if (message.includes('✅') || message.includes('success')) type = 'success';
  else if (message.includes('❌') || message.includes('failed') || message.includes('error') || message.includes('Unable') || message.includes('offline')) type = 'error';
  else if (message.includes('⚠️') || message.includes('gentle') || message.includes('renewal')) type = 'warning';
  
  showToast(message.replace(/[✅❌⚠️]/g, '').trim(), type);
};

const NEPALI_MONTHS = ["Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin","Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"];

const fAmt = (n) => '₹ ' + (Math.abs(n) <= 0.0001 ? "0.00" : parseFloat(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}));

function adjustFontSizeToFit(element) {
  if (!element) return;
  element.style.whiteSpace = 'nowrap';
  element.style.overflow = 'visible';
  element.style.fontSize = '';
  const computed = window.getComputedStyle(element);
  let size = parseFloat(computed.fontSize) || 18;
  const minSize = 10;
  element.style.fontSize = size + 'px';
  void element.offsetWidth;
  if (element.scrollWidth > element.clientWidth) {
    while (size > minSize) {
      size -= 0.5;
      element.style.fontSize = size + 'px';
      void element.offsetWidth;
      if (element.scrollWidth <= element.clientWidth) break;
    }
  }
  element.style.overflow = 'hidden';
}

let loaderTimeout = null;
const toggleLoader = (show) => {
  const loader = document.getElementById('loader');
  if (!loader) return;
  if (show) {
    loader.classList.remove('hidden');
    if (loaderTimeout) clearTimeout(loaderTimeout);
    loaderTimeout = setTimeout(() => {
      loader.classList.add('hidden');
    }, 7500);
  } else {
    if (loaderTimeout) clearTimeout(loaderTimeout);
    loader.classList.add('hidden');
  }
};

function getStatusIcons(actual, probable) {
  const badges = [];
  if (actual) {
    const a = actual.trim().toUpperCase();
    if (a.includes('PASS')) badges.push('<span class="badge-premium badge-act-pass">ACTUAL: PASS</span>');
    else if (a.includes('WL') || a.includes('WATCH')) badges.push('<span class="badge-premium badge-act-wl">ACTUAL: WATCH LIST</span>');
    else if (a.includes('NPA')) badges.push('<span class="badge-premium badge-act-npa">ACTUAL: NPA</span>');
    else if (a) badges.push(`<span class="badge-premium" style="background:#334155; color:white;">ACTUAL: ${a}</span>`);
  }
  if (probable) {
    const p = probable.trim().toUpperCase();
    if (p.includes('NPA')) badges.push('<span class="badge-premium badge-prob-npa">PROBABLE: NPA</span>');
    else if (p.includes('WL') || p.includes('WATCH')) badges.push('<span class="badge-premium badge-prob-wl">PROBABLE: WATCH LIST</span>');
    else if (p.includes('PASS')) badges.push('<span class="badge-premium badge-prob-pass">PROBABLE: PASS</span>');
    else if (p) badges.push(`<span class="badge-premium" style="background:#475569; color:white;">PROBABLE: ${p}</span>`);
  }
  return badges.join('&nbsp;');
}

function animateMetricCounter(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const target = parseFloat(targetValue) || 0;
  if (target === 0) { 
    el.innerText = fAmt(0); 
    adjustFontSizeToFit(el);
    return; 
  }
  const duration = 800;
  const startTime = performance.now();
  const startVal = 0;
  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentVal = startVal + (target - startVal) * eased;
    el.innerText = fAmt(currentVal);
    adjustFontSizeToFit(el);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function showDetailSkeleton() {
  document.getElementById('det-name').innerHTML = '<div class="skeleton skeleton-title"></div>';
  document.getElementById('det-id').innerHTML = '<div class="skeleton skeleton-text" style="width:100px;"></div>';
  document.getElementById('det-group-tag').style.display = 'none';
  
  // Set skeleton loaders for metric values
  document.getElementById('v-net-ovd').innerHTML = '<div class="skeleton skeleton-text" style="width: 120px; height: 26px; margin: 4px 0;"></div>';
  document.getElementById('v-tot-ovd').innerHTML = '<div class="skeleton skeleton-text" style="width: 120px; height: 26px; margin: 4px 0;"></div>';
  document.getElementById('v-npa').innerHTML = '<div class="skeleton skeleton-text" style="width: 120px; height: 26px; margin: 4px 0;"></div>';
  document.getElementById('v-wl').innerHTML = '<div class="skeleton skeleton-text" style="width: 120px; height: 26px; margin: 4px 0;"></div>';
  document.getElementById('v-days').innerHTML = '<div class="skeleton skeleton-text" style="width: 60px; height: 26px; margin: 4px 0;"></div>';
  document.getElementById('v-loan').innerHTML = '<div class="skeleton skeleton-text" style="width: 120px; height: 26px; margin: 4px 0;"></div>';
  document.getElementById('v-op').innerHTML = '<div class="skeleton skeleton-text" style="width: 120px; height: 26px; margin: 4px 0;"></div>';
  document.getElementById('v-renewal').innerHTML = '<div class="skeleton skeleton-text" style="width: 100px; height: 26px; margin: 4px 0;"></div>';

  document.getElementById('tbl-loan').querySelector('tbody').innerHTML = `
    <tr><td colspan="6"><div class="skeleton skeleton-text" style="width:100%;"></div></td></tr>
    <tr><td colspan="6"><div class="skeleton skeleton-text" style="width:100%;"></div></td></tr>
  `;
}

function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme') || 'light';
  const next = curr === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('crm_theme', next);
  updateThemeIcon();
  showToast(`Switched to ${next === 'light' ? 'Light' : 'Dark'} banking theme`, 'info');
}

function initTheme() {
  const saved = localStorage.getItem('crm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const curr = document.documentElement.getAttribute('data-theme') || 'light';
  btn.innerHTML = curr === 'light' 
    ? '<i class="material-icons-round">dark_mode</i>' 
    : '<i class="material-icons-round">light_mode</i>';
}

function openDashboard() {
  window.location.href = 'Dashboard.html';
}

function openAdminPage() {
  window.location.href = '?page=admin';
}
