let gpsCurrentCIF = null, gpsRecords = [], gpsManualMode = false, gpsManualCIF = null, gpsManualCustomerName = '';

function openGPS() {
  if (!currentCIF && !gpsManualCIF) {
    showToast("Select a customer first.", 'warning');
    return;
  }
  const cif = gpsManualCIF || currentCIF;
  gpsCurrentCIF = cif;
  
  const modal = document.getElementById('gpsModal');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.right = '0';
  modal.style.bottom = '0';
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('active'), 50);
  window.scrollTo(0, 0);
  try { google.script.host.scrollTo(0, 0); } catch(e) {}
  
  loadGpsRecords();
}

function closeGpsModal() {
  const m = document.getElementById('gpsModal');
  m.classList.remove('active');
  setTimeout(() => {
    m.classList.add('hidden');
    gpsManualMode = false;
    gpsManualCIF = null;
    gpsCapturedImageData = null;
    document.getElementById('gpsManualSearch').classList.add('hidden');
    document.getElementById('gpsImagePreview').classList.add('hidden');
    document.getElementById('gpsPreviewImg').src = '';
    document.getElementById('gpsCameraInput').value = '';
    document.getElementById('toggleManualEntry').innerHTML = '<i class="material-icons-round">search</i> Manual GPS search';
  }, 250);
}

async function loadGpsRecords() {
  toggleLoader(true);
  try {
    gpsRecords = [];
    if (window.db) {
      const doc = await window.db.collection('gpsEntries').doc(gpsCurrentCIF).get();
      if (doc.exists) {
        const d = doc.data();
        gpsRecords = (d.locations || []).map((loc, i) => ({
          rowIndex: i,
          Customer_Name: loc.customerName || '',
          CIF_ID: gpsCurrentCIF,
          LocationType: loc.locationType,
          CollateralName: loc.label || '',
          Latitude: loc.latitude,
          Longitude: loc.longitude,
          TimeStamp: loc.timestamp ? new Date(loc.timestamp) : new Date()
        }));
      }
    } else {
      showToast('Firestore unavailable for GPS.', 'warning');
    }
    renderGpsChips();
    loadGpsImages();
    
    if (!gpsManualCIF) {
      document.getElementById('gpsCustName').innerText = window.currentCustomer.name || 'Active Client';
      document.getElementById('gpsCustId').innerText = 'CIF: ' + gpsCurrentCIF;
    } else {
      document.getElementById('gpsCustName').innerText = gpsManualCustomerName;
      document.getElementById('gpsCustId').innerText = 'CIF: ' + gpsCurrentCIF + ' (Manual Lookup)';
    }
    
    const adminGpsList = document.getElementById('admin-gps-list');
    if (adminGpsList) {
      if (gpsRecords.length === 0) {
        adminGpsList.innerHTML = '<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:16px;">No active locations recorded for this customer.</div>';
      } else {
        adminGpsList.innerHTML = gpsRecords.map(r => `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;
                      background:rgba(0,0,0,0.03); padding:10px 14px; border-radius:var(--radius-md);">
            <span style="font-size:13px;"><b>${r.LocationType}</b> - ${r.CollateralName || 'Default'}</span>
            <div style="display:flex; gap:6px;">
              <button class="btn-premium btn-outline" style="padding:4px 10px; font-size:11px; flex:none; width:auto;" onclick="editGpsRecordFromAdmin(${r.rowIndex})">✎ Edit</button>
              <button class="btn-premium" style="padding:4px 10px; font-size:11px; background:var(--danger); flex:none; width:auto;" onclick="deleteGpsRecordFromAdmin(${r.rowIndex})">🗑 Delete</button>
            </div>
          </div>
        `).join('');
      }
    }
    
    toggleLoader(false);
  } catch (e) {
    toggleLoader(false);
    showToast('Coordinates load failed', 'error');
  }
}

async function saveGpsLocationsToFirestore(locations) {
  if (!window.db) return;
  await window.db.collection('gpsEntries').doc(gpsCurrentCIF).set({ locations }, { merge: true });
}

function renderGpsChips() {
  const container = document.getElementById('gpsChips');
  container.innerHTML = '';
  if (gpsRecords.length === 0) {
    container.innerHTML = '<div style="color:var(--theme-text-muted); font-size:13px; width:100%; text-align:center; padding:10px 0;">No active locations recorded</div>';
    return;
  }
  
  gpsRecords.forEach(r => {
    const icon = r.LocationType === 'Residence' ? '🏠' : r.LocationType === 'Business' ? '🏢' : '🗺️';
    const label = r.CollateralName || r.LocationType;
    const chip = document.createElement('div');
    chip.className = 'recent-chip';
    chip.style.cursor = 'pointer';
    chip.innerHTML = `<span>${icon} ${label}</span>`;
    chip.onclick = () => {
      if (r.Latitude && r.Longitude) {
        window.open(`https://www.google.com/maps?q=${r.Latitude},${r.Longitude}`, '_blank');
      } else {
        showToast('No coordinates logged for this chip.', 'warning');
      }
    };
    container.appendChild(chip);
  });
}

function showGpsAddForm() {
  document.getElementById('gpsLabel').value = '';
  document.getElementById('gpsCoordsDisplay').innerText = 'Awaiting GPS Capture...';
  window.gpsCapturedLat = null;
  window.gpsCapturedLng = null;
  window.gpsEditRow = null;
  clearGpsImagePreview();

  const hasRes = gpsRecords.some(r => r.LocationType === 'Residence');
  const hasBus = gpsRecords.some(r => r.LocationType === 'Business');
  
  const allowed = [];
  if (!hasRes) allowed.push(GPS_TYPES[0]);
  if (!hasBus) allowed.push(GPS_TYPES[1]);
  allowed.push(GPS_TYPES[2]);

  populateGpsDropdown(allowed);
  
  document.getElementById('gpsForm').classList.remove('hidden');
  document.getElementById('gpsUpdateList').classList.add('hidden');
}

function showGpsUpdateMode() {
  const list = document.getElementById('gpsUpdateItems');
  if (gpsRecords.length === 0) {
    list.innerHTML = '<div style="color:var(--theme-text-muted); font-size:13px; text-align:center; padding:10px;">Empty list</div>';
  } else {
    list.innerHTML = gpsRecords.map(r => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;
                  background:rgba(0,0,0,0.03); padding:10px 14px; border-radius:var(--radius-md);">
        <span style="font-size:13px;"><b>${r.LocationType}</b> - ${r.CollateralName || 'Default'}</span>
        <div style="display:flex; gap:6px;">
          <button class="btn-premium btn-outline" style="padding:4px 10px; font-size:11px; flex:none; width:auto;" onclick="editGpsRecord(${r.rowIndex})">✎ Edit</button>
          <button class="btn-premium" style="padding:4px 10px; font-size:11px; background:var(--danger); flex:none; width:auto;" onclick="deleteGpsRecord(${r.rowIndex})">🗑 Delete</button>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('gpsUpdateList').classList.remove('hidden');
  document.getElementById('gpsForm').classList.add('hidden');
}

function editGpsRecord(rowIndex) {
  const rec = gpsRecords.find(r => r.rowIndex === rowIndex);
  if (!rec) return;
  
  populateGpsDropdown(GPS_TYPES);
  document.getElementById('gpsLocType').value = rec.LocationType;
  gpsTypeChanged();
  document.getElementById('gpsLabel').value = rec.CollateralName || '';
  
  if (rec.Latitude && rec.Longitude) {
    window.gpsCapturedLat = rec.Latitude;
    window.gpsCapturedLng = rec.Longitude;
    document.getElementById('gpsCoordsDisplay').innerText = `${rec.Latitude}, ${rec.Longitude}`;
  } else {
    document.getElementById('gpsCoordsDisplay').innerText = 'Awaiting Capture...';
  }
  
  window.gpsEditRow = rowIndex;
  clearGpsImagePreview();
  document.getElementById('gpsForm').classList.remove('hidden');
  document.getElementById('gpsUpdateList').classList.add('hidden');
}

async function deleteGpsRecord(rowIndex) {
  if (!confirm('Permanently delete this coordination point?')) return;
  toggleLoader(true);
  try {
    const locs = gpsRecords
      .filter(r => r.rowIndex !== rowIndex)
      .map(r => ({
        locationType: r.LocationType,
        label: r.CollateralName,
        latitude: r.Latitude,
        longitude: r.Longitude,
        customerName: r.Customer_Name,
        timestamp: r.TimeStamp instanceof Date ? r.TimeStamp.toISOString() : r.TimeStamp
      }));
    await saveGpsLocationsToFirestore(locs);
    toggleLoader(false);
    showToast('Record deleted.', 'success');
    loadGpsRecords();
  } catch(e) {
    toggleLoader(false);
    showToast('Delete failed.', 'error');
  }
}

function captureGpsLocation() {
  if (!navigator.geolocation) {
    showToast('Physical geolocation unsupported.', 'error');
    return;
  }
  document.getElementById('gpsCoordsDisplay').innerText = 'Locating Nic Asia device...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      window.gpsCapturedLat = pos.coords.latitude;
      window.gpsCapturedLng = pos.coords.longitude;
      document.getElementById('gpsCoordsDisplay').innerText = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
      showToast('Coordinates locked', 'success');
    },
    err => {
      showToast('Unable to secure precision coordinate lock.', 'error');
      document.getElementById('gpsCoordsDisplay').innerText = 'Awaiting manual entry...';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function submitGpsForm() {
  const type = document.getElementById('gpsLocType').value;
  const label = document.getElementById('gpsLabel').value || (type === 'Business' ? 'Business' : '');
  const lat = window.gpsCapturedLat;
  const lng = window.gpsCapturedLng;
  
  if (!lat || !lng) {
    showToast('Geolocate coordinate trigger first.', 'warning');
    return;
  }
  
  const customerName = document.getElementById('gpsCustName').innerText || 'N/A';
  
  toggleLoader(true);
  
  try {
    if (!window.db) throw new Error('Firestore not available');
    
    let locs = gpsRecords.map(r => ({
      locationType: r.LocationType,
      label: r.CollateralName,
      latitude: r.Latitude,
      longitude: r.Longitude,
      customerName: r.Customer_Name,
      timestamp: r.TimeStamp instanceof Date ? r.TimeStamp.toISOString() : r.TimeStamp
    }));
    
    const entry = {
      locationType: type,
      label: label,
      latitude: lat,
      longitude: lng,
      customerName: customerName,
      timestamp: new Date().toISOString()
    };
    
    if (window.gpsEditRow !== null) {
      locs[window.gpsEditRow] = entry;
    } else {
      locs.push(entry);
    }
    
    await saveGpsLocationsToFirestore(locs);
    
    // Image upload still via GAS (GitHub storage)
    if (gpsCapturedImageData) {
      try {
        const imageFileName = `${gpsCurrentCIF}_${type}.webp`;
        await callBackend('uploadImage', {
          cifId: gpsCurrentCIF,
          imageData: gpsCapturedImageData,
          fileName: imageFileName
        });
      } catch(e) {
        console.warn('Image upload failed, location saved:', e);
      }
    }
    
    toggleLoader(false);
    showToast('Field coordinate saved to Firestore.', 'success');
    window.gpsEditRow = null;
    gpsCapturedImageData = null;
    document.getElementById('gpsImagePreview').classList.add('hidden');
    document.getElementById('gpsPreviewImg').src = '';
    document.getElementById('gpsCameraInput').value = '';
    document.getElementById('gpsForm').classList.add('hidden');
    loadGpsRecords();
  } catch (e) {
    toggleLoader(false);
    showToast('Save failed: ' + e.message, 'error');
  }
}

function cancelGpsForm() {
  document.getElementById('gpsForm').classList.add('hidden');
  window.gpsEditRow = null;
}

function gpsTypeChanged() {
  const type = document.getElementById('gpsLocType').value;
  const labelGroup = document.getElementById('gpsLabelGroup');
  if (type === 'Business') {
    labelGroup.classList.add('hidden');
    document.getElementById('gpsLabel').value = 'Business';
  } else {
    labelGroup.classList.remove('hidden');
    if (document.getElementById('gpsLabel').value === 'Business') {
      document.getElementById('gpsLabel').value = '';
    }
  }
}

function toggleManualEntry() {
  gpsManualMode = !gpsManualMode;
  if (gpsManualMode) {
    document.getElementById('gpsManualSearch').classList.remove('hidden');
    document.getElementById('toggleManualEntry').innerHTML = '<i class="material-icons-round">person</i> Use Current Customer';
    gpsManualCIF = null;
    gpsRecords = [];
    document.getElementById('gpsChips').innerHTML = '';
    document.getElementById('gpsCustName').innerText = 'Search details...';
    document.getElementById('gpsCustId').innerText = '';
  } else {
    document.getElementById('gpsManualSearch').classList.add('hidden');
    document.getElementById('toggleManualEntry').innerHTML = '<i class="material-icons-round">search</i> Manual GPS search';
    gpsManualCIF = null;
    gpsRecords = [];
    if (currentCIF) openGPS();
  }
}

async function searchGpsCustomer() {
  const q = document.getElementById('gpsManualSearchInp').value.trim().toUpperCase();
  if (!q) { document.getElementById('gpsManualResults').innerHTML = ''; return; }
  
  let list = [];
  if (window.db) {
    try {
      const snapshot = await window.db.collection('customers').get();
      snapshot.forEach(doc => {
        const d = doc.data();
        list.push({ id: d.cifId, name: d.name });
      });
    } catch(e) {}
  }
  if (list.length === 0) {
    list = await crmDb.getAll('customers');
  }
  
  const filtered = list.filter(c => c.name.toUpperCase().includes(q) || c.id.includes(q)).slice(0, 5);
  
  document.getElementById('gpsManualResults').innerHTML = filtered.map(c => `
    <div class="search-result-item-compact" style="padding:10px; border-bottom:1px solid var(--theme-border); cursor:pointer;" onclick="selectGpsManualCustomer('${c.id}','${c.name.replace(/'/g, "\\'")}')">
      <b>${c.name}</b> <span style="font-size:11px; color:var(--theme-text-muted);">(${c.id})</span>
    </div>
  `).join('') || '<div style="padding:10px; font-size:13px; color:var(--theme-text-muted);">No match found</div>';
}

function selectGpsManualCustomer(cifId, name) {
  gpsManualCIF = cifId;
  gpsManualCustomerName = name;
  document.getElementById('gpsManualSearch').classList.add('hidden');
  document.getElementById('toggleManualEntry').innerHTML = '<i class="material-icons-round">arrow_back</i> Back to Current';
  gpsCurrentCIF = cifId;
  loadGpsRecords();
}

const GPS_TYPES = [
  { value: 'Residence', text: '🏠 Residence Location' },
  { value: 'Business',  text: '🏢 Business Headquarters' },
  { value: 'Collateral',text: '🗺️ Collateral Asset' }
];

function populateGpsDropdown(allowedTypes) {
  const sel = document.getElementById('gpsLocType');
  sel.innerHTML = '';
  allowedTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.text;
    sel.appendChild(opt);
  });
  if (allowedTypes.length > 0) {
    sel.value = allowedTypes[0].value;
    gpsTypeChanged();
  }
}

// GPS IMAGE CAPTURE & GALLERY
let gpsCapturedImageData = null;

function triggerGpsCamera() {
  document.getElementById('gpsCameraInput').click();
}

function onGpsImageCapture(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const MAX_W = 1920, MAX_H = 1920;
      let w = img.width, h = img.height;
      if (w > MAX_W || h > MAX_H) {
        const ratio = Math.min(MAX_W / w, MAX_H / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const webpData = canvas.toDataURL('image/webp', 0.72);
      gpsCapturedImageData = webpData.split(',')[1];
      document.getElementById('gpsPreviewImg').src = webpData;
      document.getElementById('gpsImagePreview').classList.remove('hidden');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearGpsImagePreview() {
  gpsCapturedImageData = null;
  document.getElementById('gpsImagePreview').classList.add('hidden');
  document.getElementById('gpsPreviewImg').src = '';
  document.getElementById('gpsCameraInput').value = '';
}

async function loadGpsImages() {
  const container = document.getElementById('gpsImageGallery');
  if (!gpsCurrentCIF) return;
  try {
    const res = await callBackend('getImages', { cifId: gpsCurrentCIF });
    const images = res?.images || [];
    if (images.length === 0) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:6px; color:var(--theme-text-muted); font-size:13px;">No images captured</div>';
      return;
    }
    container.innerHTML = images.map(img => `
      <div style="border-radius:var(--radius-xs); overflow:hidden; border:1px solid var(--theme-border); cursor:pointer; position:relative; aspect-ratio:1; background:var(--theme-surface);"
           onclick="window.open('${img.url}','_blank')" title="${img.fileName}">
        <img src="${img.url}" style="width:100%; height:100%; object-fit:cover; display:block;" loading="lazy"
             onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--theme-text-muted);font-size:9px;\\'>Err</div>'">
        <span style="position:absolute;top:2px;right:2px; background:rgba(0,0,0,0.6); color:white; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:11px; cursor:pointer;"
              onclick="event.stopPropagation(); deleteGpsImage('${img.fileName}')">&times;</span>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:6px; color:var(--theme-text-muted); font-size:13px;">Failed to load</div>';
  }
}

async function deleteGpsImage(fileName) {
  if (!confirm('Delete this image from GitHub?')) return;
  try {
    const res = await callBackend('deleteImage', { fileName });
    if (res && res.success) {
      showToast('Image deleted.', 'success');
      loadGpsImages();
    } else {
      showToast('Delete failed: ' + (res?.error || 'Server error'), 'error');
    }
  } catch (e) {
    showToast('Delete error.', 'error');
  }
}
