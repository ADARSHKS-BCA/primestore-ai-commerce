/**
 * Seed script — populates the Firestore `products` collection with enriched catalog data.
 * 
 * Enriches product images using the multi-tier image lookup service:
 * Pexels API -> Pixabay API -> Deterministic Seeded Picsum Placeholder
 * 
 * Run: npx tsx scripts/seedProducts.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PRODUCTS_CATALOG } from '../lib/productsData';
import { getProductImage } from '../lib/imageLookupService';
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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function seed() {
  console.log(`🌱 [CLOUD FIRESTORE] Seeding products collection to project: "${projectId}"...\n`);

  const batch = db.batch();
  let count = 0;

  for (const product of PRODUCTS_CATALOG) {
    count++;

    // Enrich product image via multi-tier lookup chain
    let finalImageUrl = product.imageUrl;
    try {
      const lookup = await getProductImage(product);
      finalImageUrl = lookup.imageUrl;
      console.log(
        `  [${count}/${PRODUCTS_CATALOG.length}] [${lookup.source.toUpperCase()}] ${product.name.slice(0, 35)} — ₹${product.displayPrice}`
      );
      if (lookup.source !== 'cache') {
        await sleep(250); // Free-tier rate-limit throttling
      }
    } catch (err) {
      console.warn(`  ⚠️ Image enrichment failed for ${product.id}, preserving default:`, err);
    }

    const ref = db.collection('products').doc(product.id);
    batch.set(ref, {
      ...product,
      imageUrl: finalImageUrl,
    });
  }

  await batch.commit();
  console.log(`\n🎉 Successfully seeded and enriched ${PRODUCTS_CATALOG.length} products to Cloud Firestore!`);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
