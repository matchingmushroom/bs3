async function performFirebaseAuthentication() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value.trim();
  
  if (!email || !pass) {
    showToast('Email and Password are required.', 'warning');
    return;
  }
  
  toggleLoader(true);
  
  let fbConfig = null;
  try {
    fbConfig = await callBackend('getFirebaseConfig');
  } catch(e) {
    toggleLoader(false);
    showToast('Could not fetch Login record. Check network or excel record.', 'error');
    return;
  }
  
  if (!fbConfig || !fbConfig.apiKey || !fbConfig.projectId) {
    toggleLoader(false);
    showToast('Invalid Firebase config from server.', 'error');
    return;
  }
  
  localStorage.setItem('crm_fb_config', JSON.stringify(fbConfig));
  
  try {
    if (firebase.apps.length > 0) {
      firebase.app().delete().then(() => initFirebaseAndAuth(fbConfig, email, pass));
    } else {
      initFirebaseAndAuth(fbConfig, email, pass);
    }
  } catch(e) {
    toggleLoader(false);
    showToast('Firebase Config Init Error: ' + e.message, 'error');
  }
}

function applyRoleUI() {
  const isAdmin = window.userRole === 'admin';
  localStorage.setItem('crm_user_role', window.userRole || 'viewer');
  // Hide admin-only elements
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  document.querySelectorAll('.viewer-hidden').forEach(el => el.classList.toggle('hidden', !isAdmin));
}

function initFirebaseAndAuth(config, email, pass) {
  try {
    firebase.initializeApp(config);
    firebase.auth().signInWithEmailAndPassword(email, pass)
      .then((userCredential) => {
        toggleLoader(false);
        const user = userCredential.user;
        localStorage.setItem('crm_auth_user', JSON.stringify({ email: user.email, uid: user.uid }));
        showToast('Authenticated successfully with Excel File.', 'success');
        
        // Initialize Firestore
        window.db = firebase.firestore();
        window.db.settings({ persistence: false });
        
        // Read user role from Firestore roles collection
        window.db.collection('roles').doc(user.uid).get().then(doc => {
          window.userRole = doc.exists ? (doc.data().role || 'viewer') : 'viewer';
          applyRoleUI();
        }).catch(() => {
          window.userRole = 'viewer';
          applyRoleUI();
        });
        
        showMainAppDashboard();
      })
      .catch((error) => {
        toggleLoader(false);
        showToast('Authentication Failed: ' + error.message, 'error');
      });
  } catch(e) {
    toggleLoader(false);
    showToast('Firebase Connection Error: ' + e.message, 'error');
  }
}

function showMainAppDashboard() {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('app-wrapper').classList.remove('hidden');
  
  syncLedgerDataOnStart();

  handleUrlParams();
}

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  let cifParam = params.get('cif');
  if (!cifParam) {
    cifParam = sessionStorage.getItem('selectedCIF');
  }
  if (cifParam) {
    currentCIF = cifParam;
    sessionStorage.setItem('selectedCIF', cifParam);
    if (typeof navTo === 'function') {
      navTo('detail');
    }
  }
}

function checkSessionOnLoad() {
  const cachedUser = localStorage.getItem('crm_auth_user');
  const cachedConfig = localStorage.getItem('crm_fb_config');
  
  if (cachedUser) {
    if (cachedConfig) {
      try {
        const config = JSON.parse(cachedConfig);
        if (firebase.apps.length === 0) firebase.initializeApp(config);
      } catch(e) {}
    }
    if (firebase.apps.length > 0) {
      window.db = firebase.firestore();
      window.db.settings({ persistence: false });
    }
    window.userRole = localStorage.getItem('crm_user_role') || 'viewer';
    applyRoleUI();
    // Re-fetch role from Firestore in background (may be stale from cache)
    if (window.db) {
      try {
        const userData = JSON.parse(cachedUser);
        window.db.collection('roles').doc(userData.uid).get().then(doc => {
          if (doc.exists) {
            window.userRole = doc.data().role || 'viewer';
            applyRoleUI();
          }
        }).catch(() => {});
      } catch(e) {}
    }
    showMainAppDashboard();
  } else {
    if (navigator.onLine) {
      callBackend('getFirebaseConfig').then(config => {
        if (config && config.apiKey) {
          localStorage.setItem('crm_fb_config', JSON.stringify(config));
        }
      }).catch(() => {});
    }
    document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
  }
}

function performLogout() {
  if (confirm('Are you sure you want to sign out?')) {
    localStorage.removeItem('crm_auth_user');
    try {
      if (firebase.apps.length > 0) firebase.auth().signOut();
    } catch(e) {}
    showToast('Logged out of CRM session successfully.', 'info');
    
    location.reload();
  }
}

function openCommitmentModal() {
  document.getElementById('comDate').value = new Date().toISOString().substring(0, 10);
  document.getElementById('comRemarks').value = '';
  
  const modal = document.getElementById('commitmentModal');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.right = '0';
  modal.style.bottom = '0';
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('active'), 50);
  window.scrollTo(0, 0);
  try { google.script.host.scrollTo(0, 0); } catch(e) {}
}

function closeCommitmentModal() {
  const m = document.getElementById('commitmentModal');
  m.classList.remove('active');
  setTimeout(() => m.classList.add('hidden'), 250);
}

async function saveCommitment() {
  const dateVal = document.getElementById('comDate').value;
  const remarksVal = document.getElementById('comRemarks').value.trim();
  
  if (!dateVal) {
    showToast('Please pick a calendar date', 'warning');
    return;
  }
  
  toggleLoader(true);
  try {
    if (window.db) {
      await window.db.collection('commitments').add({
        cifId: currentCIF,
        customerName: window.currentCustomer.name,
        date: dateVal,
        remarks: remarksVal,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Commitment saved to Firestore.', 'success');
    } else {
      const res = await callBackend('saveCommitment', {
        cifId: currentCIF,
        customerName: window.currentCustomer.name,
        date: dateVal,
        remarks: remarksVal
      });
      if (!res || !res.success) {
        showToast('Save failed: ' + (res?.error || 'Server error'), 'error');
        return;
      }
      showToast('Commitment saved to sheet and notified.', 'success');
    }
    closeCommitmentModal();
  } catch(e) {
    toggleLoader(false);
    showToast('Failed to save commitment.', 'error');
  }
}
