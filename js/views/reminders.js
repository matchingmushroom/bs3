async function openShareModal() {
  if (!window.currentCustomer || !window.currentCustomer.name || !currentCIF) {
    showToast("Select a customer ledger first.", 'warning');
    return;
  }
  
  const modal = document.getElementById('shareModal');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.right = '0';
  modal.style.bottom = '0';
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('active'), 50);
  window.scrollTo(0, 0);
  try { google.script.host.scrollTo(0, 0); } catch(e) {}
  
  toggleLoader(true);
  try {
    // Account number is ALWAYS fetched from sheets directly and NEVER saved locally (in db or memory config caches)
    const c = await callBackend('extraDetails', { cifId: currentCIF });
    toggleLoader(false);
    
    const acc = c?.OP_ACCOUNT || 'Not Available';
    const name = window.currentCustomer?.name || 'N/A';
    
    // Removed "Currency Unit: रु." line completely to comply with no-currency-in-sharing requirement
    document.getElementById('sharePreview').value = `Account Name: ${name}\nAccount No.: ${acc}\nBank: NIC ASIA Bank Limited`;
  } catch (err) {
    toggleLoader(false);
    const name = window.currentCustomer?.name || 'N/A';
    document.getElementById('sharePreview').value = `Account Name: ${name}\nAccount No.: Failed to sync\nBank: NIC ASIA Bank Limited`;
  }
}

function closeShareModal() { 
  const m = document.getElementById('shareModal');
  m.classList.remove('active'); 
  setTimeout(() => m.classList.add('hidden'), 250);
}

function copyAccountInfoFromModal() {
  const text = document.getElementById('sharePreview').value;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Account credentials copied", 'success');
    closeShareModal();
  }).catch(() => showToast("Failed to copy", 'error'));
}

function shareViaWhatsAppFromModal() {
  const text = encodeURIComponent(document.getElementById('sharePreview').value);
  window.open(`https://wa.me/?text=${text}`, '_blank');
  closeShareModal();
}

function shareViaSMSFromModal() {
  const text = encodeURIComponent(document.getElementById('sharePreview').value);
  window.location.href = `sms:?body=${text}`;
  closeShareModal();
}

// ==========================================
// OUTSTANDING REMINDERS SEGMENTED
// ==========================================
async function openReminderPopup() {
  if (!window.currentCustomer || !window.currentCustomer.name || !currentCIF) {
    showToast("Select a customer ledger first.", 'warning');
    return;
  }
  
  const modal = document.getElementById('reminderModal');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.right = '0';
  modal.style.bottom = '0';
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('active'), 50);
  window.scrollTo(0, 0);
  try { google.script.host.scrollTo(0, 0); } catch(e) {}
  
  updatePreview();
  
  toggleLoader(true);
  try {
    const c = await callBackend('extraDetails', { cifId: currentCIF });
    toggleLoader(false);
    if (c) {
      window.currentCustomer.account = c.OP_ACCOUNT || '-';
      window.currentCustomer.primaryPhone = (c.Contact_No || '').split(';')[0]?.trim() || '';
      window.currentCustomer.secondaryPhone = (c.Additional_Contact_Number || '').split(';')[0]?.trim() || '';
    }
  } catch (err) {
    toggleLoader(false);
  }
}

function closeReminder() { 
  const m = document.getElementById('reminderModal');
  m.classList.remove('active'); 
  setTimeout(() => m.classList.add('hidden'), 250);
}

function setReminderLang(lang) {
  document.getElementById('remLang').value = lang;
  document.querySelectorAll('.segmented-btn').forEach(b => b.classList.remove('active'));
  if (lang === 'EN') document.getElementById('btn-lang-en').classList.add('active');
  else document.getElementById('btn-lang-np').classList.add('active');
  updatePreview();
}

function setReminderContact(contact) {
  document.getElementById('remContact').value = contact;
  document.getElementById('btn-cont-pri').classList.toggle('active', contact === 'primary');
  document.getElementById('btn-cont-sec').classList.toggle('active', contact === 'secondary');
}

function updatePreview() {
  let phone = '';
  if (document.getElementById('remContact').value === 'primary') {
    phone = window.currentCustomer.primaryPhone || '';
  } else {
    phone = window.currentCustomer.secondaryPhone || '';
  }
  
  const lang = document.getElementById('remLang').value;
  const name = window.currentCustomer.name || '';
  const renewal = window.currentCustomer.renewal || 'N/A';
  const account = window.currentCustomer.account || '';
  
  let text;
  const isExpired = renewal.toUpperCase() === 'EXPIRED';
  if (isExpired) {
    if (lang === 'NP') {
      text = `आदरणीय ग्राहकज्यू, तपाईंको कर्जा खातामा बक्यौता रकम बाँकी रहेको र कर्जा खाता नवीकरण गर्नु आवश्यक रहेको जानकारी गराउन चाहन्छौँ। कृपया बक्यौता भुक्तानी तथा नवीकरणका लागि आवश्यक कागजातसहित शीघ्र सम्पर्क गर्नुहुन अनुरोध छ। धन्यवाद।`;
    } else {
      text = `Dear Valued Customer, please be informed that your loan account has an overdue balance and also requires renewal. Kindly clear the overdue amount and contact us with the necessary documents for renewal at your earliest convenience. Thank you.`;
    }
  } else {
    if (lang === 'NP') {
      text = `आदरणीय ग्राहकज्यू, तपाईंको भुक्तानी समयमै नभएकोले बाँकी रहेको जानकारी गराउन चाहन्छौँ। कृपया छिटो भुक्तानी गरिदिनुहुन अनुरोध छ। धन्यवाद।`;
    } else {
      text = `Dear Customer, this is a gentle reminder that your payment is overdue. Kindly arrange clearance at your earliest convenience. Thank you.`;
    }
  }
  
  document.getElementById('remPreview').value = text;
}

function copyReminder() {
  navigator.clipboard.writeText(document.getElementById('remPreview').value).then(() => {
    showToast('Reminder copied to clipboard.', 'success');
    closeReminder();
  });
}

function sendWhatsApp() {
  let phone = '';
  if (document.getElementById('remContact').value === 'primary') {
    phone = window.currentCustomer.primaryPhone || '';
  } else {
    phone = window.currentCustomer.secondaryPhone || '';
  }
  if (!phone) { showToast('No phone number available for selected contact.', 'error'); return; }
  
  const text = encodeURIComponent(document.getElementById('remPreview').value);
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const fullPhone = cleanPhone.startsWith('977') ? cleanPhone : '977' + cleanPhone;
  window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
  closeReminder();
}

function sendSMS() {
  let phone = '';
  if (document.getElementById('remContact').value === 'primary') {
    phone = window.currentCustomer.primaryPhone || '';
  } else {
    phone = window.currentCustomer.secondaryPhone || '';
  }
  if (!phone) { showToast('No phone number available.', 'error'); return; }
  
  const text = encodeURIComponent(document.getElementById('remPreview').value);
  window.location.href = `sms:${phone}?body=${text}`;
  closeReminder();
}

function closeModalOnBackdrop(e, id) {
  if (e.target.classList.contains('modal-backdrop')) {
    const map = {
      shareModal: closeShareModal,
      reminderModal: closeReminder,
      gpsModal: closeGpsModal,
      commitmentModal: closeCommitmentModal
    };
    if (map[id]) map[id]();
  }
}
