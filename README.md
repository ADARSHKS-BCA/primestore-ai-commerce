This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Catalog Image Enrichment & Deduplication Service

To ensure every product in the catalog displays a distinct, high-definition photo matching its category and brand:

1. **Configure API Keys (Optional)** in `.env.local`:
   - `PEXELS_API_KEY`: Free signup at [Pexels API](https://www.pexels.com/api/) (Tier 1 Primary).
   - `PIXABAY_API_KEY`: Free signup at [Pixabay API](https://pixabay.com/api/docs/) (Tier 2 Fallback).
   - If keys are omitted, the service deterministically falls back to unique seeded placeholders (`https://picsum.photos/seed/{product_id}/600/400`).

2. **Run Enrichment**:
   ```bash
   npx tsx scripts/enrichCatalogImages.ts
   ```

3. **Seed Cloud Firestore**:
   ```bash
   npx tsx scripts/seedProducts.ts
   ```

