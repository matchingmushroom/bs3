const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/**
 * Creates a Firebase Auth user, assigns custom claims,
 * and writes to Users + roles collections.
 *
 * Called by the Admin panel after filling the create-user form.
 * Only existing admin users can call this.
 */
exports.createUserWithRole = functions.https.onCall(async (data, context) => {
  // 1. Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 'You must be logged in.'
    );
  }

  // 2. Verify caller has admin role
  const callerRef = db.collection('roles').doc(context.auth.uid);
  const callerDoc = await callerRef.get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied', 'Only admins can create users.'
    );
  }

  // 3. Validate input
  const { email, password, displayName, role } = data;
  if (!email || !password || !role) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'email, password, and role are required.'
    );
  }
  if (!['admin', 'viewer'].includes(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Role must be "admin" or "viewer".'
    );
  }

  // 4. Create auth user
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || '',
    });
  } catch (err) {
    throw new functions.https.HttpsError(
      'internal', 'Failed to create auth user: ' + err.message
    );
  }

  const uid = userRecord.uid;

  // 5. Set custom claims
  try {
    await admin.auth().setCustomUserClaims(uid, { role });
  } catch (err) {
    // Cleanup: delete the auth user if claims fail
    await admin.auth().deleteUser(uid).catch(() => {});
    throw new functions.https.HttpsError(
      'internal', 'Failed to set role claims: ' + err.message
    );
  }

  // 6. Write to Users collection
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('Users').doc(uid).set({
    uid,
    email,
    displayName: displayName || '',
    role,
    createdAt: now,
    updatedAt: now,
  });

  // 7. Write to roles collection (used by frontend role lookups)
  await db.collection('roles').doc(uid).set({
    role,
    updatedAt: now,
  }, { merge: true });

  return { success: true, uid, email, role };
});

/**
 * Deletes a Firebase Auth user and their Firestore docs.
 * Only existing admin users can call this.
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
  // 1. Verify caller is authenticated & admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
  }
  const callerDoc = await db.collection('roles').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users.');
  }

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }

  // Prevent self-deletion
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'You cannot delete your own account.');
  }

  // 2. Delete auth user
  try {
    await admin.auth().deleteUser(uid);
  } catch (err) {
    throw new functions.https.HttpsError('internal', 'Failed to delete auth user: ' + err.message);
  }

  // 3. Delete Firestore documents
  await db.collection('Users').doc(uid).delete().catch(() => {});
  await db.collection('roles').doc(uid).delete().catch(() => {});

  return { success: true, uid };
});
