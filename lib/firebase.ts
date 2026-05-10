import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with experimentalForceLongPolling to improve connectivity in restricted networks
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // We specify the databaseId from our config if it exists
}, firebaseConfig.firestoreDatabaseId);

// Test connection
async function testConnection() {
  if (typeof window === 'undefined') return;
  
  try {
    // Attempt to read a non-existent doc to trigger a request
    // We use getDocFromServer to bypass local cache and force a network check
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    console.log("Firebase connection established.");
  } catch (error) {
    // We expect a "permission-denied" error because of our rules, 
    // which still confirms we reached the backend.
    // We only care about connection timeouts/offline errors.
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('the client is offline') || errorMessage.includes('Could not reach Cloud Firestore')) {
      console.error("Please check your Firebase configuration or internet connection.");
    } else {
      console.log("Firebase connection verified (permission check completed).");
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
