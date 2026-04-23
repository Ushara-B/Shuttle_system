import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Mobile app Firebase setup.
// NOTE: This config identifies the Firebase project and is safe to embed in clients.
// Security comes from Firestore rules and Auth, not from hiding these values.
const firebaseConfig = {
    apiKey: "AIzaSyDEJfm4WWYYI3NWCSjEE3NFJQi_s2b58Bo",
    authDomain: "shuttle-system-21158.firebaseapp.com",
    projectId: "shuttle-system-21158",
    storageBucket: "shuttle-system-21158.firebasestorage.app",
    messagingSenderId: "12172551820",
    appId: "1:12172551820:web:f03307ca50eec647f17da9",
    measurementId: "G-QLDLCP7Q8B"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
