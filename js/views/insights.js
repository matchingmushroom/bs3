async function loadInsights() {
  let data = null;
  if (window.db) {
    try {
      const doc = await window.db.collection('insights').doc(currentCIF).get();
      if (doc.exists) data = doc.data();
    } catch(e) {
      console.warn('Firestore insights read failed:', e);
    }
  }
  if (!data) {
    try {
      data = await getCachedInsights(currentCIF, 'overdue', 'overdue');
    } catch(e) {}
  }
  
  if (data && data.overdue && data.overdue.rows) {
    document.getElementById('body-daily').innerHTML = data.overdue.rows.map(r => `<tr><td style="font-weight:600;">${r.OVD_DATE}</td><td>${fAmt(r.TOT_OVD_AMT)}</td><td>${fAmt(r.I_OVD)}</td><td>${fAmt(r.P_OVD)}</td><td>${fAmt(r.PENAL_INT)}</td></tr>`).join('');
    document.getElementById('foot-daily').innerHTML = `<tr><td>TOTAL</td><td>${fAmt(data.overdue.total.TOT_OVD_AMT)}</td><td>${fAmt(data.overdue.total.I_OVD)}</td><td>${fAmt(data.overdue.total.P_OVD)}</td><td>${fAmt(data.overdue.total.PENAL_INT)}</td></tr>`;
  }
  
  if (data && data.slicerYears) {
    slicerMeta = { years: data.slicerYears, months: data.slicerMonths };
    renderFilters(data.slicerYears, data.slicerMonths);
    applySlicer();
  }
}

function renderFilters(years, months) {
  const yrHtml = [`<label class="chip-checkbox-label"><input type="checkbox" class="yr-chip" value="ALL" checked onchange="toggleAllYears(this)"><div class="chip-label-btn">ALL</div></label>`];
  years.forEach(y => yrHtml.push(`<label class="chip-checkbox-label"><input type="checkbox" class="yr-chip sub-yr" value="${y}" checked onchange="subYearChanged()"><div class="chip-label-btn">${y}</div></label>`));
  document.getElementById('year-chips').innerHTML = yrHtml.join('');
  
  if (months && months.length) {
    document.getElementById('month-chips').innerHTML = months.map(m => `<label class="chip-checkbox-label"><input type="checkbox" class="mn-chip" value="${m}" checked><div class="chip-label-btn">${m}</div></label>`).join('');
  } else {
    document.getElementById('month-chips').innerHTML = '<div style="padding:10px; color:var(--theme-text-muted);">No monthly insights compiled</div>';
  }
}

function toggleAllYears(allCheck) {
  document.querySelectorAll('.sub-yr').forEach(cb => cb.checked = allCheck.checked);
}
function subYearChanged() {
  const allBox = document.querySelector('.yr-chip[value="ALL"]');
  const subs = Array.from(document.querySelectorAll('.sub-yr'));
  const allChecked = subs.every(cb => cb.checked);
  if (allBox) allBox.checked = allChecked;
}

async function applySlicer() {
  const checkedYears = Array.from(document.querySelectorAll('.yr-chip:checked')).map(i=>i.value);
  const checkedMonths = Array.from(document.querySelectorAll('.mn-chip:checked')).map(i=>i.value);
  
  toggleLoader(true);
  try {
    const d = await callBackend('slicerSummary', { cifId: currentCIF, years: JSON.stringify(checkedYears), months: JSON.stringify(checkedMonths) });
    toggleLoader(false);
    let t_ovd=0,t_i=0,t_p=0,t_pen=0;
    document.getElementById('body-nepali').innerHTML = d.map(r => { 
      t_ovd+=r.TOT_OVD_AMT; t_i+=r.I_OVD; t_p+=r.P_OVD; t_pen+=r.PENAL_INT;
      return `<tr><td style="font-weight:600;">${r.NEPALI_OVD_Month}</td><td>${fAmt(r.TOT_OVD_AMT)}</td><td>${fAmt(r.I_OVD)}</td><td>${fAmt(r.P_OVD)}</td><td>${fAmt(r.PENAL_INT)}</td></tr>`;
    }).join('');
    document.getElementById('foot-nepali').innerHTML = `<tr><td>TOTAL</td><td>${fAmt(t_ovd)}</td><td>${fAmt(t_i)}</td><td>${fAmt(t_p)}</td><td>${fAmt(t_pen)}</td></tr>`;
  } catch(e) {
    toggleLoader(false);
    showToast("Filter execution failed.", 'error');
  }
}

function switchTab(t) {
  document.getElementById('pane-daily').classList.toggle('hidden', t !== 'daily');
  document.getElementById('pane-nepali').classList.toggle('hidden', t !== 'nepali');
  document.getElementById('tab-daily').classList.toggle('active', t === 'daily');
  document.getElementById('tab-nepali').classList.toggle('active', t === 'nepali');
}
