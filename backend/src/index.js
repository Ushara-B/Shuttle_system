const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// Basic input validation for admin-driven account creation.
// (We still rely on Firebase Auth for canonical validation; this is a fast fail for UX.)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Strong password policy used across admin + user profile flows.
// 8+ chars, at least one lowercase, uppercase, number, and symbol.
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
// Business rule: allow limited overdraft to keep service usable.
// A scan is allowed as long as the resulting wallet balance stays >= MIN_WALLET_BALANCE.
const MIN_WALLET_BALANCE = -1000;

const buildGeneratedStudentId = () => `S${Math.floor(1000 + Math.random() * 9000)}`;

const getStudentUidFromIdentifier = async (identifier) => {
  if (!identifier) return null;

  // First try direct UID match.
  const byUid = await db.collection('users').doc(identifier).get();
  if (byUid.exists && byUid.data()?.role === 'student') return identifier;

  // Then try studentId match.
  const byStudentId = await db.collection('users')
    .where('role', '==', 'student')
    .where('studentId', '==', identifier)
    .limit(2)
    .get();

  if (byStudentId.empty) return null;
  if (byStudentId.size > 1) {
    throw new Error(`Multiple student accounts found for studentId ${identifier}.`);
  }
  return byStudentId.docs[0].id;
};

const ensureUniqueStudentId = async (preferredStudentId) => {
  // Student IDs are used for scanning/lookup. Enforce uniqueness at creation time
  // to avoid ambiguous "same studentId" lookups later.
  let candidate = preferredStudentId || buildGeneratedStudentId();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.collection('users')
      .where('role', '==', 'student')
      .where('studentId', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) return candidate;
    if (preferredStudentId) throw new Error(`Student ID ${preferredStudentId} is already in use.`);
    candidate = buildGeneratedStudentId();
    attempts += 1;
  }
  throw new Error('Unable to generate a unique student ID');
};

const verifyFirebaseToken = async (req) => {
  // Used for endpoints where any signed-in user is allowed (e.g., driver pricing / scan).
  // Returns null instead of throwing so callers can stay backward-compatible.
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    return null;
  }
};

const verifyAdmin = async (req, res, next) => {
  // Admin authorization gate.
  // Prefer custom claims for speed; fall back to Firestore "users/{uid}.role" for reliability.
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ error: 'Unauthorized: No token' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Check custom claim first
    if (decodedToken.role === 'admin') {
      req.user = decodedToken;
      return next();
    }

    // Fallback: check Firestore user document (in case claims not refreshed yet)
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (userDoc.exists && userDoc.data().role === 'admin') {
      req.user = decodedToken;
      return next();
    }

    return res.status(403).send({ error: 'Forbidden: Admin access required' });
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).send({ error: 'Unauthorized: Invalid token' });
  }
};

app.get('/', (req, res) => { res.send('API Running'); });

// --- Admin Routes ---

app.post('/api/admin/create-user', verifyAdmin, async (req, res) => {
  console.log("Admin Create User Attempt:", req.body.email);
  const { email, password, displayName, role, studentId } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !password || !role) {
    return res.status(400).send({ error: "Missing required fields" });
  }
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).send({ error: "Invalid email address" });
  }
  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return res.status(400).send({ error: "Password must be at least 8 chars with uppercase, lowercase, number, and symbol" });
  }
  if (!['student', 'driver', 'admin'].includes(role)) {
    return res.status(400).send({ error: "Invalid role" });
  }

  try {
    // 1. Create the Auth User
    const userRecord = await admin.auth().createUser({
      email: normalizedEmail,
      password,
      displayName: displayName || normalizedEmail.split('@')[0],
    });

    // 2. Set Custom Claims (Roles)
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    // 3. Create User Document
    await db.collection('users').doc(userRecord.uid).set({
      email: normalizedEmail,
      role,
      displayName: displayName || normalizedEmail.split('@')[0],
      studentId: studentId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Initialize Wallet for Students
    if (role === 'student') {
      // Wallet is only created for students since drivers/admins don't have balances.
      const generatedId = await ensureUniqueStudentId(studentId);
      await db.collection('wallets').doc(userRecord.uid).set({
        studentId: generatedId,
        balance: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('users').doc(userRecord.uid).update({ studentId: generatedId });
    }

    console.log(`Successfully created ${role}: ${normalizedEmail}`);
    res.status(201).send({ message: "User created successfully", uid: userRecord.uid });
  } catch (error) {
    console.error("User Creation Failed:", error.message);
    res.status(400).send({ error: error.message });
  }
});

// Admin: delete a user account (Auth + Firestore docs). Keeps payments history for audit.
app.post('/api/admin/delete-user', verifyAdmin, async (req, res) => {
  const { uid } = req.body || {};
  if (!uid) return res.status(400).send({ error: 'Missing uid' });
  if (uid === req.user?.uid) return res.status(400).send({ error: 'You cannot delete your own admin account.' });
  try {
    // Delete Auth user first (prevents further logins).
    await admin.auth().deleteUser(uid);

    // Best-effort cleanup of Firestore docs (audit/payment history remains in `payments`).
    await db.collection('users').doc(uid).delete().catch(() => {});
    await db.collection('wallets').doc(uid).delete().catch(() => {});

    res.status(200).send({ message: 'User deleted', uid });
  } catch (error) {
    console.error('Delete user failed:', error.message);
    res.status(400).send({ error: error.message || 'Failed to delete user' });
  }
});
// --- TRANSACTION ENDPOINTS ---
const { haversineDistance, CAMPUS_COORDS } = require('./utils/haversine');

const getGlobalDefaultPricePerKm = async () => {
  const doc = await db.collection('settings').doc('pricing').get();
  if (!doc.exists) return null;
  const v = doc.data()?.defaultPricePerKm;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

const getDriverDefaultPricePerKm = async (driverUid) => {
  if (!driverUid) return null;
  const doc = await db.collection('users').doc(driverUid).get();
  if (!doc.exists) return null;
  const v = doc.data()?.driverPricing?.defaultPricePerKm;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

// Admin: set global default price per km
app.post('/api/admin/pricing/global', verifyAdmin, async (req, res) => {
  const { defaultPricePerKm } = req.body;
  if (typeof defaultPricePerKm !== 'number' || !Number.isFinite(defaultPricePerKm) || defaultPricePerKm <= 0) {
    return res.status(400).send({ error: 'Invalid defaultPricePerKm' });
  }
  await db.collection('settings').doc('pricing').set(
    {
      defaultPricePerKm,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.uid || 'admin',
    },
    { merge: true }
  );
  res.status(200).send({ message: 'Global pricing updated', defaultPricePerKm });
});

// Admin: set per-driver default price per km
app.post('/api/admin/pricing/driver', verifyAdmin, async (req, res) => {
  const { driverUid, defaultPricePerKm } = req.body;
  if (!driverUid) return res.status(400).send({ error: 'Missing driverUid' });
  if (typeof defaultPricePerKm !== 'number' || !Number.isFinite(defaultPricePerKm) || defaultPricePerKm <= 0) {
    return res.status(400).send({ error: 'Invalid defaultPricePerKm' });
  }

  await db.collection('users').doc(driverUid).set(
    {
      driverPricing: {
        defaultPricePerKm,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.user?.uid || 'admin',
      }
    },
    { merge: true }
  );

  res.status(200).send({ message: 'Driver pricing updated', driverUid, defaultPricePerKm });
});

// Driver: set their own default price per km (requires token)
app.post('/api/driver/pricing', async (req, res) => {
  const decoded = await verifyFirebaseToken(req);
  if (!decoded?.uid) return res.status(401).send({ error: 'Unauthorized: Invalid token' });

  const { defaultPricePerKm } = req.body;
  if (typeof defaultPricePerKm !== 'number' || !Number.isFinite(defaultPricePerKm) || defaultPricePerKm <= 0) {
    return res.status(400).send({ error: 'Invalid defaultPricePerKm' });
  }

  await db.collection('users').doc(decoded.uid).set(
    {
      driverPricing: {
        defaultPricePerKm,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: decoded.uid,
      }
    },
    { merge: true }
  );

  res.status(200).send({ message: 'Pricing updated', driverUid: decoded.uid, defaultPricePerKm });
});

app.post('/api/transactions/scan', async (req, res) => {
  const { studentUid, farePrice, driverUid: driverUidFromBody, route, latitude, longitude, direction, pricePerKm } = req.body;

  if (!studentUid) {
    return res.status(400).send({ error: "Missing student identifier" });
  }

  try {
    const resolvedStudentUid = await getStudentUidFromIdentifier(studentUid);
    if (!resolvedStudentUid) {
      return res.status(404).send({ error: "Student account not found for QR/ID" });
    }

    // Prefer authenticated driver (if token provided), but keep backwards-compatible body driverUid.
    const decoded = await verifyFirebaseToken(req);
    const driverUid = decoded?.uid || driverUidFromBody || 'system';

    // === DUPLICATE SCAN CHECK ===
    // Prevent charging multiple times per day per direction.
    // Get today's date key (e.g., "2026-04-22")
    const today = new Date().toISOString().split('T')[0];
    const tripDirection = direction || 'unknown';

    const existingTrips = await db.collection('payments')
      .where('studentUid', '==', resolvedStudentUid)
      .where('type', '==', 'fare-deduction')
      .where('dateKey', '==', today)
      .where('direction', '==', tripDirection)
      .limit(1)
      .get();

    if (!existingTrips.empty) {
      const existingTrip = existingTrips.docs[0].data();
      return res.status(409).send({
        error: `Already paid for ${tripDirection === 'home-to-campus' ? 'Home → Campus' : 'Campus → Home'} today`,
        existingFare: Math.abs(existingTrip.amount),
        existingDistance: existingTrip.distanceKm,
      });
    }

    // === FARE CALCULATION ===
    // Priority: request override -> per-driver default -> global default -> minimum flat fare.
    let finalFare = farePrice || null;
    let distanceKm = null;
    let effectivePricePerKm = null;
    let pricingSource = 'flat-fare';

    // Determine effective pricePerKm (priority: request override -> per-driver default -> global default)
    if (typeof pricePerKm === 'number' && Number.isFinite(pricePerKm) && pricePerKm > 0) {
      effectivePricePerKm = pricePerKm;
      pricingSource = 'request-override';
    } else {
      const driverDefault = await getDriverDefaultPricePerKm(driverUid);
      if (typeof driverDefault === 'number' && Number.isFinite(driverDefault) && driverDefault > 0) {
        effectivePricePerKm = driverDefault;
        pricingSource = 'driver-default';
      } else {
        const globalDefault = await getGlobalDefaultPricePerKm();
        if (typeof globalDefault === 'number' && Number.isFinite(globalDefault) && globalDefault > 0) {
          effectivePricePerKm = globalDefault;
          pricingSource = 'global-default';
        }
      }
    }

    // Resolve GPS coords: prefer driver-sent coords, fall back to student's saved homeLocation
    // so fares can still be computed if driver's GPS is unavailable.
    let resolvedLat = latitude || null;
    let resolvedLng = longitude || null;

    if ((!resolvedLat || !resolvedLng) && effectivePricePerKm) {
      // Try student's saved home location
      const studentUserDoc = await db.collection('users').doc(resolvedStudentUid).get();
      const homeLocation = studentUserDoc.exists ? studentUserDoc.data()?.homeLocation : null;
      if (homeLocation?.latitude && homeLocation?.longitude) {
        resolvedLat = homeLocation.latitude;
        resolvedLng = homeLocation.longitude;
        pricingSource += '+student-home';
        console.log(`Using student home location (${resolvedLat}, ${resolvedLng}) for distance calc`);
      }
    }

    if (resolvedLat && resolvedLng && effectivePricePerKm) {
      distanceKm = Math.round(haversineDistance(resolvedLat, resolvedLng, CAMPUS_COORDS.lat, CAMPUS_COORDS.lng) * 10) / 10;
      finalFare = Math.round(distanceKm * effectivePricePerKm);
      if (finalFare < 10) finalFare = 10;
      console.log(`Fare: ${distanceKm}km × Rs.${effectivePricePerKm}/km = Rs.${finalFare} (${pricingSource})`);
    } else if (!finalFare) {
      // Absolute last resort: minimum flat fare only — never guess a distance
      finalFare = 50;
      pricingSource = 'minimum-flat';
      console.warn(`No GPS or home location available for student ${resolvedStudentUid}. Charging minimum flat fare Rs.${finalFare}`);
    }

    // Get student name
    let studentName = 'Unknown';
    const userDoc = await db.collection('users').doc(resolvedStudentUid).get();
    const walletDocForStudentId = await db.collection('wallets').doc(resolvedStudentUid).get();
    if (userDoc.exists) studentName = userDoc.data().displayName || userDoc.data().email || 'Student';
    const resolvedStudentId = walletDocForStudentId.exists ? walletDocForStudentId.data().studentId || null : null;

    console.log(`Fare scan: ${studentName} (${resolvedStudentUid}) | Rs. ${finalFare} | ${distanceKm || '?'}km | ${tripDirection}`);

    const walletRef = db.collection('wallets').doc(resolvedStudentUid);
    const result = await db.runTransaction(async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists) throw new Error("Student wallet not found");

      const currentBalance = walletDoc.data().balance || 0;
      if ((currentBalance - finalFare) < MIN_WALLET_BALANCE) {
        // Enforce overdraft floor.
        throw new Error(`Insufficient balance. Minimum allowed is Rs.${MIN_WALLET_BALANCE}. Need Rs.${finalFare}, have Rs.${currentBalance}`);
      }

      const newBalance = currentBalance - finalFare;

      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const paymentRef = db.collection('payments').doc();
      transaction.set(paymentRef, {
        studentUid: resolvedStudentUid,
        studentId: resolvedStudentId,
        studentName,
        driverUid,
        amount: -finalFare,
        type: 'fare-deduction',
        direction: tripDirection,
        route: route || 'Standard Route',
        distanceKm,
        pricePerKm: effectivePricePerKm,
        pricingSource,
        scanLocation: latitude ? { latitude, longitude } : null,
        dateKey: today,
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { newBalance, distanceKm, finalFare };
    });

    res.status(200).send({
      message: "Payment successful",
      studentUid: resolvedStudentUid,
      studentName,
      balance: result.newBalance,
      distanceKm: result.distanceKm,
      fare: result.finalFare
    });
  } catch (error) {
    console.error("Scan Failed:", error.message);
    res.status(400).send({ error: error.message });
  }
});

app.post('/api/admin/adjust-balance', verifyAdmin, async (req, res) => {
  const { studentUid, amount, clientRequestId } = req.body;
  console.log(`Top-up attempt for ${studentUid}: Rs. ${amount}`);

  try {
    if (!studentUid || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).send({ error: "Invalid top-up payload" });
    }

    const resolvedStudentUid = await getStudentUidFromIdentifier(studentUid);
    if (!resolvedStudentUid) {
      return res.status(404).send({ error: "Student account not found" });
    }

    const walletRef = db.collection('wallets').doc(resolvedStudentUid);
    const userRef = db.collection('users').doc(resolvedStudentUid);
    const idempotencyKey = clientRequestId ? `${req.user.uid}_${clientRequestId}` : null;
    const requestRef = idempotencyKey ? db.collection('adminTopupRequests').doc(idempotencyKey) : null;
    let isDuplicate = false;

    await db.runTransaction(async (transaction) => {
      if (requestRef) {
        const requestDoc = await transaction.get(requestRef);
        if (requestDoc.exists) {
          isDuplicate = true;
          return;
        }
      }

      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists) throw new Error("Wallet not found");
      const userDoc = await transaction.get(userRef);

      const newBalance = (walletDoc.data().balance || 0) + amount;
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log the top-up transaction
      const paymentRef = db.collection('payments').doc();
      const userData = userDoc.exists ? userDoc.data() : {};
      transaction.set(paymentRef, {
        studentUid: resolvedStudentUid,
        studentName: userData.displayName || userData.email || 'Student',
        studentId: userData.studentId || walletDoc.data().studentId || null,
        amount,
        type: 'top-up',
        status: 'success',
        performedBy: req.user.uid,
        clientRequestId: clientRequestId || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      if (requestRef) {
        transaction.set(requestRef, {
          studentUid,
          amount,
          paymentRef: paymentRef.id,
          createdBy: req.user.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    if (isDuplicate) {
      return res.status(409).send({ error: "Duplicate top-up request ignored" });
    }

    res.status(200).send({ message: "Balance updated", studentUid: resolvedStudentUid });
  } catch (error) {
    console.error("Top-up Failed:", error.message);
    res.status(400).send({ error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log('-----------------------------------');
  console.log(`Shuttle Backend Live on Port ${PORT}`);
  console.log('-----------------------------------');
});

