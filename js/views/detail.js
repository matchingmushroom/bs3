async function loadDetails() {
  const customer = customers.find(c => c.id === currentCIF);
  const cached = customer?.metrics || await crmDb.get('metrics', currentCIF);
  
  if (!cached) {
    showDetailSkeleton();
    toggleLoader(true);
  } else {
    renderMetrics(cached);
  }
  
  if (navigator.onLine) {
    const fresh = await isCacheFresh();
    if (cached && fresh) {
      toggleLoader(false);
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const m = await callBackend('metrics', { cifId: currentCIF }, controller.signal);
      clearTimeout(timeoutId);
      toggleLoader(false);
      await crmDb.put('metrics', m);
      renderMetrics(m);
    } catch (err) {
      clearTimeout(timeoutId);
      toggleLoader(false);
      if (!cached) showToast("Failed to retrieve metrics from excel in your phone.", 'error');
    }
  } else {
    toggleLoader(false);
  }
}

async function renderMetrics(m) {
  document.getElementById('det-name').innerText = m.CUSTOMER_NAME;
  document.getElementById('det-avatar').innerText = (m.CUSTOMER_NAME || 'CS').substring(0, 2).toUpperCase();
  document.getElementById('det-id').innerHTML = "🆔 CIF: " + m.CIF_ID;
  currentGroup = (m.CUSTOMER_GROUP || "NO GROUP").trim();
  
  const hasGroup = (currentGroup && currentGroup.toUpperCase() !== "NO GROUP");
  if(hasGroup) {
    document.getElementById('det-group-tag').innerHTML = `<i class="material-icons-round" style="font-size:14px; vertical-align:middle;">groups</i> ${currentGroup}`;
    document.getElementById('det-group-tag').style.display = 'inline-flex';
    document.getElementById('n-group').style.display = 'flex';
  } else {
    document.getElementById('det-group-tag').style.display = 'none';
    document.getElementById('n-group').style.display = 'none';
  }
  document.getElementById('det-status').innerHTML = getStatusIcons(m.CATEGORY_ACTUAL, m.CATEGORY_PROBABLE);
  
  animateMetricCounter('v-net-ovd', m.TOTAL_OVERDUE_NET);
  animateMetricCounter('v-tot-ovd', m.TOT_OVD_AMT);
  animateMetricCounter('v-npa', m.MIN_BAL_NPA);
  animateMetricCounter('v-wl', m.MIN_BAL_WL);
  animateMetricCounter('v-loan', m.OUTSTANDING_LOAN);
  animateMetricCounter('v-op', m.OP_BALANCE);
  
  document.getElementById('v-days').innerText = m.MAX_OVD_DAYS;
  document.getElementById('v-renewal').innerText = m.RENEWAL || 'N/A';
  adjustFontSizeToFit(document.getElementById('v-days'));
  adjustFontSizeToFit(document.getElementById('v-renewal'));
  
  const renewalEl = document.getElementById('v-renewal');
  if ((m.RENEWAL || '').toUpperCase() === 'EXPIRED') {
    renewalEl.style.color = 'var(--danger)';
    renewalEl.style.fontWeight = '800';
  } else {
    renewalEl.style.color = 'var(--theme-text-primary)';
    renewalEl.style.fontWeight = '500';
  }
  
  loadLocalDetailPortfolioTable();
  
  window.currentCustomer.name = m.CUSTOMER_NAME;
  window.currentCustomer.renewal = m.RENEWAL;

  const grid = document.getElementById("contact-grid");
  if (grid && currentCIF) {
    grid.innerHTML = '<div class="contact-card-premium" style="grid-column: 1/-1;"><div class="skeleton skeleton-text" style="width:100%;"></div></div>';
    
    try {
      const c = await getCachedExtraDetails(currentCIF);
      
      if (!c) { 
        grid.innerHTML = "<div class='contact-card-premium' style='grid-column:1/-1;text-align:center;color:var(--text-muted);padding:24px;font-size:13px;'>No contact details recorded</div>"; 
        window.currentCustomer.primaryPhone = '';
        window.currentCustomer.secondaryPhone = '';
        return; 
      }
      
      function formatPhones(str) { 
        if (!str) return '<span style="color:var(--text-muted);font-size:12px;">No phone</span>'; 
        return str.split(';').filter(p=>p.trim()).map(p => `
          <div class="contact-phone-item">
            <a href="tel:${p}">${p}</a>
            <div class="contact-actions">
              <span class="contact-action-btn" onclick="navigator.clipboard.writeText('${p}').then(() => showToast('Number copied', 'success'))" title="Copy"><i class="material-icons-round" style="font-size:15px;">content_copy</i></span>
              <a class="contact-action-btn" href="https://wa.me/${p.replace(/[^0-9]/g, '')}" target="_blank" title="WhatsApp"><i class="material-icons-round" style="font-size:15px; color:#25D366;">chat</i></a>
            </div>
          </div>`).join(''); 
      }
      
      window.currentCustomer.primaryPhone = (c.Contact_No || '').split(';')[0]?.trim() || '';
      window.currentCustomer.secondaryPhone = (c.Additional_Contact_Number || '').split(';')[0]?.trim() || '';
      
      const initial1 = (c.Contact_Person_Name || 'P').substring(0, 1).toUpperCase();
      let html = `
        <div class="contact-card-premium">
          <div class="contact-avatar">${initial1}</div>
          <div class="contact-details">
            <span class="contact-name">${c.Contact_Person_Name || 'Primary Lead'}</span>
            <span class="contact-role">Primary Client Contact</span>
            ${formatPhones(c.Contact_No)}
          </div>
        </div>
      `;
      
      if (c.Additional_Contact_Number || c.Additional_Person) { 
        const initial2 = (c.Additional_Person || 'A').substring(0, 1).toUpperCase();
        html += `
          <div class="contact-card-premium">
            <div class="contact-avatar">${initial2}</div>
            <div class="contact-details">
              <span class="contact-name">${c.Additional_Person || 'Secondary Lead'}</span>
              <span class="contact-role">Relation: ${c.Additional_Person_Relation || 'Representative'}</span>
              ${formatPhones(c.Additional_Contact_Number)}
            </div>
          </div>
        `; 
      }
      grid.innerHTML = html;
    } catch(e) {
      grid.innerHTML = "<div class='contact-card-premium' style='grid-column:1/-1;text-align:center;color:var(--text-muted);padding:24px;font-size:13px;'>Contact details not loaded offline</div>";
      window.currentCustomer.primaryPhone = '';
      window.currentCustomer.secondaryPhone = '';
    }
  }
}


