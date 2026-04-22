const admin = require('firebase-admin');
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const users = [
    { uid: 'mock_admin_uid', email: 'admin@shuttle.com', role: 'admin', displayName: 'System Admin' },
    { uid: 'mock_driver_uid', email: 'driver1@shuttle.com', role: 'driver', displayName: 'Driver One' },
    { uid: 'mock_student_uid', email: 'student1@shuttle.com', role: 'student', displayName: 'Student One', studentId: 'S1001' },
];

async function seedFirestore() {
    console.log("Seeding Firestore with mock user data...");
    for (const u of users) {
        try {
            await db.collection('users').doc(u.uid).set({
                email: u.email,
                role: u.role,
                displayName: u.displayName,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            if (u.role === 'student') {
                await db.collection('wallets').doc(u.uid).set({
                    balance: 1000,
                    studentId: u.studentId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            console.log(`Added ${u.role} entry for ${u.email}`);
        } catch (e) {
            console.error("Error:", e.message);
        }
    }
    console.log("Firestore seeding complete! (Auth accounts still need to be created manually)");
    process.exit(0);
}

seedFirestore();
