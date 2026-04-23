const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const verifyAdmin = async (req, res, next) => {
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

app.post('/api/transactions/scan', async (req, res) => {
  const { studentUid, farePrice, route, driverUid } = req.body;
  try {
    const walletRef = db.collection('wallets').doc(studentUid);
    await db.runTransaction(async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists) throw new Error("Wallet not found");
      const currentBalance = walletDoc.data().balance || 0;
      if (currentBalance - farePrice < -1000) throw new Error("Insufficient Funds");
      transaction.update(walletRef, { balance: currentBalance - farePrice, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      const tripRef = db.collection('trips').doc();
      transaction.set(tripRef, { studentUid, driverUid, fare: farePrice, route: route || "Fixed", timestamp: admin.firestore.FieldValue.serverTimestamp() });
      const paymentRef = db.collection('payments').doc();
      transaction.set(paymentRef, { studentUid, amount: -farePrice, type: 'fare-deduction', status: 'success', timestamp: admin.firestore.FieldValue.serverTimestamp() });
    });
    res.status(200).send({ message: "Scan successful" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});


// --- Admin Routes ---

app.post('/api/admin/create-user', verifyAdmin, async (req, res) => {
  console.log("Admin Create User Attempt:", req.body.email);
  const { email, password, displayName, role, studentId } = req.body;

  if (!email || !password || !role) {
    return res.status(400).send({ error: "Missing required fields" });
  }

  try {
    // 1. Create the Auth User
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
    });

    // 2. Set Custom Claims (Roles)
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    // 3. Create User Document
    await db.collection('users').doc(userRecord.uid).set({
      email,
      role,
      displayName: displayName || email.split('@')[0],
      studentId: studentId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Initialize Wallet for Students
    if (role === 'student') {
      const generatedId = studentId || "S" + Math.floor(1000 + Math.random() * 9000);
      await db.collection('wallets').doc(userRecord.uid).set({
        studentId: generatedId,
        balance: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Update ID in user doc if it was generated
      if (!studentId) {
        await db.collection('users').doc(userRecord.uid).update({ studentId: generatedId });
      }
    }

    console.log(`Successfully created ${role}: ${email}`);
    res.status(201).send({ message: "User created successfully", uid: userRecord.uid });
  } catch (error) {
    console.error("User Creation Failed:", error.message);
    res.status(400).send({ error: error.message });
  }
});
// --- TRANSACTION ENDPOINTS ---
const { haversineDistance, CAMPUS_COORDS } = require('./utils/haversine');

app.post('/api/transactions/scan', async (req, res) => {
  const { studentUid, farePrice, driverUid, route, latitude, longitude, direction, pricePerKm } = req.body;

  if (!studentUid) {
    return res.status(400).send({ error: "Missing student UID" });
  }

  try {
    // === DUPLICATE SCAN CHECK ===
    // Get today's date key (e.g., "2026-04-22")
    const today = new Date().toISOString().split('T')[0];
    const tripDirection = direction || 'unknown';

    const existingTrips = await db.collection('payments')
      .where('studentUid', '==', studentUid)
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
    let finalFare = farePrice || 50;
    let distanceKm = null;

    if (latitude && longitude && pricePerKm) {
      distanceKm = haversineDistance(latitude, longitude, CAMPUS_COORDS.lat, CAMPUS_COORDS.lng);
      finalFare = Math.round(distanceKm * pricePerKm);
      if (finalFare < 10) finalFare = 10;
      console.log(`GPS Fare: ${distanceKm}km × Rs.${pricePerKm}/km = Rs.${finalFare}`);
    }

    // Get student name
    let studentName = 'Unknown';
    const userDoc = await db.collection('users').doc(studentUid).get();
    if (userDoc.exists) studentName = userDoc.data().displayName || userDoc.data().email || 'Student';

    console.log(`Fare scan: ${studentName} (${studentUid}) | Rs. ${finalFare} | ${distanceKm || '?'}km | ${tripDirection}`);

    const walletRef = db.collection('wallets').doc(studentUid);
    const result = await db.runTransaction(async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists) throw new Error("Student wallet not found");

      const currentBalance = walletDoc.data().balance || 0;
      if (currentBalance < finalFare) throw new Error(`Insufficient balance. Need Rs.${finalFare}, have Rs.${currentBalance}`);

      const newBalance = currentBalance - finalFare;

      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const paymentRef = db.collection('payments').doc();
      transaction.set(paymentRef, {
        studentUid,
        studentName,
        driverUid: driverUid || 'system',
        amount: -finalFare,
        type: 'fare-deduction',
        direction: tripDirection,
        route: route || 'Standard Route',
        distanceKm,
        pricePerKm: pricePerKm || null,
        scanLocation: latitude ? { latitude, longitude } : null,
        dateKey: today,
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { newBalance, distanceKm, finalFare };
    });

    res.status(200).send({
      message: "Payment successful",
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
  const { studentUid, amount } = req.body;
  console.log(`Top-up attempt for ${studentUid}: Rs. ${amount}`);

  try {
    const walletRef = db.collection('wallets').doc(studentUid);

    await db.runTransaction(async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists) throw new Error("Wallet not found");

      const newBalance = (walletDoc.data().balance || 0) + amount;
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log the top-up transaction
      const paymentRef = db.collection('payments').doc();
      transaction.set(paymentRef, {
        studentUid,
        amount,
        type: 'top-up',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    res.status(200).send({ message: "Balance updated" });
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

