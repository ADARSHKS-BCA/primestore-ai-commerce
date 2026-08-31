import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

/**
 * Firebase Client SDK — browser-safe.
 * 
 * Automatically connects to Cloud Firestore if NEXT_PUBLIC_FIREBASE_API_KEY exists,
 * or connects to local emulator if NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-ai-commerce',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const clientApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const clientDb = getFirestore(clientApp);

// Only connect to emulator if explicitly set AND no Cloud Firebase API key is provided
if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' &&
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY
) {
  try {
    connectFirestoreEmulator(clientDb, 'localhost', 8080);
  } catch {
    // Emulator already connected
  }
}
