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
    return res.status(401).send({ error: 'Unauthorized' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (decodedToken.role === 'admin') {
      req.user = decodedToken;
      next();
    } else {
      res.status(403).send({ error: 'Forbidden' });
    }
  } catch (error) {
    res.status(401).send({ error: 'Unauthorized' });
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

const PORT = 5000;
app.listen(PORT, () => { console.log('Server on 5000'); });

