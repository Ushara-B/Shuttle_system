const admin = require('firebase-admin');
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const users = [
    { email: 'admin@shuttle.com', password: 'password123', role: 'admin', displayName: 'System Admin' },
    { email: 'driver1@shuttle.com', password: 'password123', role: 'driver', displayName: 'Driver One' },
    { email: 'driver2@shuttle.com', password: 'password123', role: 'driver', displayName: 'Driver Two' },
    { email: 'student1@shuttle.com', password: 'password123', role: 'student', displayName: 'Student One', studentId: 'S1001' },
    { email: 'student2@shuttle.com', password: 'password123', role: 'student', displayName: 'Student Two', studentId: 'S1002' },
];

async function seed() {
    console.log("Starting seed process...");
    for (const u of users) {
        try {
            console.log(`Creating user: ${u.email}...`);
            const userRecord = await admin.auth().createUser({
                email: u.email,
                password: u.password,
                displayName: u.displayName
            }).catch(e => {
                console.error(`Auth Creation ERROR for ${u.email}:`, e.message);
                throw e;
            });

            await admin.auth().setCustomUserClaims(userRecord.uid, { role: u.role });

            await db.collection('users').doc(userRecord.uid).set({
                email: u.email,
                role: u.role,
                displayName: u.displayName,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            if (u.role === 'student') {
                await db.collection('wallets').doc(userRecord.uid).set({
                    balance: 1000,
                    studentId: u.studentId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            console.log(`Successfully created ${u.role}: ${u.email} (UID: ${userRecord.uid})`);
        } catch (error) {
            if (error.code === 'auth/email-already-exists') {
                console.log(`User ${u.email} already exists, skipping...`);
            } else {
                console.log(`Error creating ${u.email}:`, error.message);
            }
        }
    }
    console.log("Seed process complete!");
    process.exit(0);
}

seed();
