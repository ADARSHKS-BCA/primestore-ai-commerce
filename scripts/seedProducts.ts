/**
 * Seed script — populates the `products` collection with sample data.
 * 
 * Run: npx tsx scripts/seedProducts.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PRODUCTS_CATALOG } from '../lib/productsData';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local if present
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  // Ignore
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Missing Firebase Admin credentials in .env.local');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

const db = getFirestore();

async function seed() {
  console.log(`🌱 [CLOUD FIRESTORE] Seeding products collection to project: "${projectId}"...\n`);

  const batch = db.batch();

  for (const product of PRODUCTS_CATALOG) {
    const ref = db.collection('products').doc(product.id);
    batch.set(ref, product);
    console.log(`  ✅ ${product.name} — ₹${product.displayPrice}`);
  }

  await batch.commit();
  console.log(`\n🎉 Successfully seeded ${PRODUCTS_CATALOG.length} products to Cloud Firestore!`);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
