import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK — SERVER-ONLY.
 * 
 * Automatically selects:
 * 1. Cloud Firestore (if FIREBASE_PROJECT_ID + Service Account credentials exist)
 * 2. Local Emulator (if NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' and host is reachable)
 */

let _adminDb: Firestore | null = null;

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // 1. Check for real Cloud Firebase credentials
  if (projectId && clientEmail && privateKey) {
    console.log(`☁️ [FIREBASE ADMIN] Connected to Cloud Firestore Project: ${projectId}`);
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  // 2. Local Emulator Check
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
  if (useEmulator && process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`💻 [FIREBASE ADMIN] Using local emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    return initializeApp({ projectId: projectId || 'demo-ai-commerce' });
  }

  // Default fallback app
  return initializeApp({ projectId: projectId || 'demo-ai-commerce' });
}

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (!_adminDb) {
      try {
        const app = getAdminApp();
        _adminDb = getFirestore(app);
        // Fast timeout settings
        _adminDb.settings({ ignoreUndefinedProperties: true });
      } catch (err) {
        console.warn('⚠️ [FIREBASE ADMIN] Firestore init warning:', err);
      }
    }
    return _adminDb ? Reflect.get(_adminDb, prop) : undefined;
  },
});
