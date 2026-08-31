/**
 * Test script — verifies read/write to all 4 Firestore collections.
 * 
 * Run: npx tsx scripts/testCollections.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Setup for emulator
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

if (getApps().length === 0) {
  initializeApp({ projectId: 'demo-ai-commerce' });
}

const db = getFirestore();

const collections = ['products', 'carts', 'orders', 'audit_logs'];

async function testCollection(name: string): Promise<boolean> {
  try {
    // Write
    const ref = db.collection(name).doc('__test__');
    await ref.set({ test: true, timestamp: new Date() });

    // Read
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Document not found after write');

    // Cleanup
    await ref.delete();

    console.log(`  ✅ ${name} — read/write OK`);
    return true;
  } catch (err) {
    console.error(`  ❌ ${name} — FAILED:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Firestore collections...\n');

  let allPassed = true;
  for (const col of collections) {
    const passed = await testCollection(col);
    if (!passed) allPassed = false;
  }

  console.log(allPassed ? '\n✅ All collection tests passed!' : '\n❌ Some tests failed!');
  process.exit(allPassed ? 0 : 1);
}

main();
