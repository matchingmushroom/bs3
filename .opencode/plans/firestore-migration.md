# Firestore Migration Plan

## Goal
Replace GAS API for all data reads/writes with direct Firestore access while keeping Google Sheets as the admin's source of truth.

## Architecture

```
Admin edits Google Sheets
    ↓ (onEdit trigger)
GAS Sync Script ──→ Firestore
                       ↕ (SDK)
Frontend reads/writes directly via firebase.firestore()
    ↕
Firebase Auth (admin / viewer via custom claims)
```

## Collections

| Collection | Source | Description |
|---|---|---|
| `customers` | GAS `loadFullData` | Customer list + embedded metrics |
| `metrics` | GAS `loadFullData` (embedded) | Per-CIF detailed metrics + accounts[] |
| `groups` | GAS `group` action | Group summary + unit list |
| `insights` | GAS slicer/overdue | Monthly overdue breakdown per CIF |
| `commitments` | Frontend direct write | Payment commitment calendar |
| `gpsEntries` | Frontend direct write | GPS coords + images per CIF |

## Collections and Fields

### `customers/{cifId}`
```
{
  name: string,
  relationship: string,
  rm: string,
  categoryActual: string,
  categoryProbable: string,
  outstandingLoan: number,
  renewal: string,
  metrics: {           // nested, same shape as current m
    CUSTOMER_NAME, CIF_ID, TOTAL_OVERDUE_NET, TOT_OVD_AMT,
    MIN_BAL_NPA, MIN_BAL_WL, OUTSTANDING_LOAN, OP_BALANCE,
    MAX_OVD_DAYS, RENEWAL, CATEGORY_ACTUAL, CATEGORY_PROBABLE,
    CUSTOMER_GROUP, accounts: [...]
  }
}
```

### `commitments/{docId}`
```
{
  cifId: string,
  customerName: string,
  date: string (YYYY-MM-DD),
  remarks: string,
  createdBy: string (uid),
  createdAt: timestamp
}
```

### `gpsEntries/{cifId}`
```
{
  cifId: string,
  locations: [
    { type, label, lat, lng, capturedAt }
  ],
  images: [
    { dataUrl, capturedAt }
  ]
}
```

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin: full access. Viewer: read-only.
    function isAdmin() {
      return request.auth.token.role == 'admin';
    }
    function isViewer() {
      return request.auth.token.role == 'viewer';
    }
    function isAuthenticated() {
      return request.auth != null;
    }

    match /customers/{cif} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /metrics/{cif} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /groups/{group} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /insights/{cif} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /commitments/{doc} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update, delete: if isAdmin();
    }
    match /gpsEntries/{cif} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

## Implementation Phases

### Phase 0 — Prerequisites
- [ ] Enable Firestore in Firebase Console
- [ ] Create custom claims (admin/viewer) via Firebase Admin SDK or Cloud Function
- [ ] Assign `role: admin` to yourself, `role: viewer` to other users

### Phase 1 — GAS sync script (Code.gs.txt)
- [ ] Add `FIREBASE_WEB_API_KEY` to Script Properties
- [ ] Implement `syncToFirestore()` function: iterate all sheets, write each row to Firestore REST API
- [ ] Add `onEdit(e)` trigger that calls `syncToFirestore()` for the edited sheet/row
- [ ] On every deploy: `syncToFirestore()` runs once to seed Firestore
- [ ] Keep existing API action handlers during transition

### Phase 2 — Frontend reads: switch from GAS to Firestore
- [ ] `js/auth.js`: after login, set `window.db = firebase.firestore()`; enable offline persistence
- [ ] `js/api.js`: add `db` reference, remove or keep `callBackend` for backward compat
- [ ] `js/main.js`:
  - `loadInitialCachedLedgers()` → `db.collection('customers').get()`, build `customers` array from docs
  - Remove `loadCustomerListLegacy()` entirely
  - Remove IndexedDB `customers` / `metrics` store ops (Firestore offline handles caching)
- [ ] `js/views/detail.js`:
  - `loadDetails()` → `db.collection('metrics').doc(currentCIF).get()`, then `renderMetrics()`
  - Remove `isCacheFresh()` / AbortController / fallback API call
- [ ] `js/views/group.js`:
  - `loadGroupDetails()` → `db.collection('groups').doc(currentGroup).get()`
  - Remove AbortController / fallback API call
- [ ] `js/views/insights.js`:
  - `loadInsights()` → `db.collection('insights').doc(currentCIF).get()`
  - `applySlicer()` → local filtering only (all data already in the doc)
- [ ] `Dashboard.html`:
  - `callBackend('loadFullData')` → `db.collection('customers').get()`, build `allMetrics` from docs
  - Remove `API_BASE`, `callBackend()`

### Phase 3 — Frontend writes: direct to Firestore
- [ ] `js/views/detail.js` / `Dashboard.html`:
  - `saveCommitment()` → `db.collection('commitments').add({...})`
- [ ] `js/views/gps.js`:
  - GPS save → `db.collection('gpsEntries').doc(cifId).set({...}, {merge: true})`

### Phase 4 — Role-based UI
- [ ] `js/auth.js`: after login, `user.getIdTokenResult().then(t => window.userRole = t.claims.role)`
- [ ] `index.html` / `Dashboard.html`: hide write buttons (Add Commitment, GPS Add/Save, etc.) if `window.userRole !== 'admin'`
- [ ] `js/ui.js`: `showAdminControls()` utility to toggle visibility

### Phase 5 — Cleanup
- [ ] Remove `API_BASE` from all files
- [ ] Remove `callBackend()` from `js/api.js`
- [ ] Remove IndexedDB wrapper from `js/db.js` (unless used elsewhere)
- [ ] Remove AbortController patterns from all view files
- [ ] Verify no GAS API calls remain in the frontend

## Files Changed Summary

| File | Phase | Change |
|---|---|---|
| `.opencode/plans/firestore-migration.md` | 0 | This plan |
| `Code.gs.txt` | 1 | Add `syncToFirestore()` + `onEdit()` |
| `js/auth.js` | 2, 4 | Init Firestore, read custom claims, set userRole |
| `js/api.js` | 2 | Add `db` ref, keep `callBackend` temporarily |
| `js/main.js` | 2 | Replace `loadInitialCachedLedgers`, remove `loadCustomerListLegacy` |
| `js/views/detail.js` | 2, 3 | Firestore reads/writes |
| `js/views/group.js` | 2 | Firestore reads |
| `js/views/insights.js` | 2 | Firestore reads |
| `js/views/gps.js` | 3 | Firestore writes |
| `Dashboard.html` | 2, 3 | Firestore reads/writes |
| `index.html` | 4 | Role-based visibility |
| `js/ui.js` | 4 | Role helpers |

## Rollback Strategy

- Keep GAS API handlers intact during Phase 1-3 (don't delete them until Phase 5)
- Add a feature flag: `const USE_FIRESTORE = true;` — toggle to `false` to switch back to GAS
- Firestore offline persistence means the app works even if GAS sync is briefly down

## Risks

| Risk | Mitigation |
|---|---|
| GAS `onEdit` quota | Use `onEdit` with debounce + `LockService`; fallback to 5-min time trigger |
| Firestore write costs | Each `onEdit` triggers 1 write per edited row; well within free tier |
| Custom claims expiry | Re-fetch on each page load; auto-refresh fails silently |
| Data inconsistency (GAS edited but not synced) | `onEdit` is near-instant; add "Last synced" timestamp on each doc for visibility |
