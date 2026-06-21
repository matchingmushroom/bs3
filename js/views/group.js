async function loadGroupDetails() { 
  if(!currentGroup || currentGroup.toUpperCase() === "NO GROUP") { 
    document.getElementById('group-content').innerHTML = '<div class="glass-card" style="padding:48px; text-align:center; color:var(--theme-text-muted);">No group data exists for this account.</div>'; 
    return; 
  }
  
  let d = null;
  const groupKey = currentGroup.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  if (window.db) {
    try {
      const doc = await window.db.collection('groups').doc(groupKey).get();
      if (doc.exists) d = doc.data();
    } catch(e) {
      console.warn('Firestore groups read failed:', e);
    }
  }
  
  if (!d) {
    d = await crmDb.get('groups', currentGroup);
  }
  
  if (d) {
    renderGroup(d);
  } else {
    document.getElementById('group-content').innerHTML = '<div class="glass-card" style="padding:48px; text-align:center; color:var(--theme-text-muted);">Group data not found. Sync from Google Sheets first.</div>';
  }
}

function renderGroup(d) {
  if(!d || !d.summary) { 
    document.getElementById('group-content').innerHTML = '<div class="glass-card" style="padding:48px; text-align:center;">Empty dataset</div>'; 
    return; 
  }
  

  const totalNpaSaver = d.units ? d.units.reduce((sum, u) => sum + (parseFloat(u.minNpa) || 0), 0) : 0;
  const totalWlSaver = d.units ? d.units.reduce((sum, u) => sum + (parseFloat(u.minWl) || 0), 0) : 0;
  let html = `
    <div class="group-hero-card">
      <div class="group-hero-title">${d.summary.groupName}</div>
      <div class="group-hero-grid">
        <div class="group-hero-item"><span class="group-hero-lbl">Units</span><span class="group-hero-val">${d.summary.unitCount}</span></div>
        <div class="group-hero-item"><span class="group-hero-lbl">Total Loan</span><span class="group-hero-val">${fAmt(d.summary.totalLoan)}</span></div>
        <div class="group-hero-item"><span class="group-hero-lbl">Total Overdue</span><span class="group-hero-val">${fAmt(d.summary.totalOvd)}</span></div>
        <div class="group-hero-item"><span class="group-hero-lbl">Net Overdue</span><span class="group-hero-val" style="color:var(--danger);">${fAmt(d.summary.totalNetOvd)}</span></div>
        <div class="group-hero-item"><span class="group-hero-lbl">NPA Saver</span><span class="group-hero-val" style="color:var(--danger);">${fAmt(totalNpaSaver)}</span></div>
        <div class="group-hero-item"><span class="group-hero-lbl">WL Saver</span><span class="group-hero-val" style="color:var(--warning);">${fAmt(totalWlSaver)}</span></div>
      </div>
    </div>
    <div class="table-section-title"><span><i class="material-icons-round" style="vertical-align:middle; margin-right:6px; color:var(--accent-gold);">groups</i> Group Members</span></div>
    <div class="member-grid">
  `;
  
  (d.units || []).forEach(u => {
    const actual = u.actual || 'Pass';
    const isNPA = actual.toUpperCase().includes('NPA');
    const isWL = actual.toUpperCase().includes('WL');
    const statusClass = isNPA ? 'npa-status' : (isWL ? 'wl-status' : 'pass-status');
    
    html += `
      <div class="member-card-new ${statusClass}" onclick="navigateToMember('${u.name.replace(/'/g, "\\'")}')">
        <div class="member-card-hdr">
          <div>
            <div class="member-card-name">${u.name}</div>
            <div class="member-card-sub">${d.summary.groupName}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
            ${getStatusIcons(u.actual, u.probable)}
          </div>
        </div>
        <div class="member-card-body">
          <div class="member-metric-row"><span class="metric-lbl">Total Overdue</span><span class="member-metric-val">${fAmt(u.totalOvd)}</span></div>
          <div class="member-metric-row" style="text-align:right;"><span class="metric-lbl">Net Overdue</span><span class="member-metric-val" style="color:var(--danger);">${fAmt(u.totalNetOvd)}</span></div>
          <div class="member-metric-row"><span class="metric-lbl">NPA Saver</span><span class="member-metric-val">${fAmt(u.minNpa)}</span></div>
          <div class="member-metric-row" style="text-align:right;"><span class="metric-lbl">WL Saver</span><span class="member-metric-val">${fAmt(u.minWl)}</span></div>
        </div>
        <div id="disc-${u.name.replace(/[^a-zA-Z0-9]/g, '_')}"></div>
      </div>
    `;
  });
  
  html += `</div>`;
  document.getElementById('group-content').innerHTML = html;
  
  (d.units || []).forEach(u => loadMemberDiscStatus(u.name));
}

async function loadMemberDiscStatus(memberName) {
  const el = document.getElementById('disc-' + memberName.replace(/[^a-zA-Z0-9]/g, '_'));
  if (!el) return;
  
  const found = customers.find(c => c.name === memberName);
  const cifId = found ? found.id : null;
  if (!cifId) return;
  
  const cust = customers.find(c => c.id === cifId);
  const metrics = cust?.metrics || null;
  if (metrics && metrics.accounts) {
    const hasDisc = metrics.accounts.some(a => {
      const rate = parseFloat(a.FULL_RATE) || 0;
      const scheme = (a.SCHEME || '').trim().toUpperCase();
      const netOvd = parseFloat(a.NET_OVD) || 0;
      return rate === 0 && scheme !== 'RRGZI' && scheme !== 'RGITQ' && Math.abs(netOvd) > 0.0001;
    });
    
    if (hasDisc) {
      el.innerHTML = `
        <div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--theme-border);">
          <span class="interest-badge">⚠️ Interest Discontinued</span>
        </div>`;
    }
  }
}

async function navigateToMember(memberName) {
  const found = customers.find(c => c.name === memberName);
  const cifId = found ? found.id : null;
  
  if (cifId) {
    currentCIF = cifId;
    navTo('detail');
    return;
  }
  
  if (navigator.onLine) {
    toggleLoader(true);
    try {
      const list = await callBackend('customers');
      const found = list.find(c => c.name === memberName);
      toggleLoader(false);
      if (found) {
        currentCIF = found.id;
        navTo('detail');
      } else {
        showToast(`Customer ${memberName} not matched on server.`, 'error');
      }
    } catch(e) { toggleLoader(false); }
  } else {
    showToast("Cannot lookup records offline", 'error');
  }
}
