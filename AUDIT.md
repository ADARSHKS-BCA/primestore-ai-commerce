# AI Commerce Agent — Security & Verification Audit (AUDIT.md)

This document records the architectural and security verification steps conducted across all 6 phases of the AI Commerce Agent.

---

## Verification Matrix

| Phase | Requirement | Status | Verification Method |
|---|---|---|---|
| **Phase 1: Project Scaffolding** | Secret never in client bundle | ✅ PASS | Scanned `.next/static` JS chunks for `RAZORPAY_KEY_SECRET`; 0 matches found. Separate `lib/firebaseAdmin.ts` & `lib/firebaseClient.ts`. |
| **Phase 2: Data Layer & Schema** | Structured Firestore collections & audit log | ✅ PASS | Schemas defined in `lib/schemas.ts`. Verified seed script `scripts/seedProducts.ts` and `scripts/testCollections.ts`. |
| **Phase 3: AI Agent → Cart Flow** | AI cannot trigger payment / No payment tools | ✅ PASS | Audited `lib/gemini.ts` tool declarations: only `search_products` and `propose_cart` exist. No `create_order` or `pay` tool exists. |
| **Phase 4: Transaction Gate** | Server-side ₹10,000 ceiling + Price recalculation | ✅ PASS | In `app/api/orders/create/route.ts`, prices are fetched fresh from Firestore and recalculated. If total > 1,000,000 paise (₹10,000), logged as `'rejected'` and 400 returned. |
| **Phase 5: Checkout & Capture** | HMAC SHA256 Signature verification + Timing-safe check | ✅ PASS | `app/api/orders/verify/route.ts` implements `crypto.createHmac('sha256', secret)` with `crypto.timingSafeEqual()`. Tampering triggers `status: 'failed'` in audit log. |
| **Phase 6: Merchant Dashboard** | Real-time audit trail & human approval queue | ✅ PASS | `app/dashboard/page.tsx` uses `onSnapshot` for real-time streaming of `audit_logs` and pending `carts`. Approve/Reject triggers gated endpoints. |

---

## Detailed Phase Verifications

### 1. Phase 1 — Secret Isolation
- **Client Configuration:** `lib/firebaseClient.ts` only consumes `NEXT_PUBLIC_*` environment variables.
- **Server Configuration:** `lib/razorpay.ts` and `lib/firebaseAdmin.ts` consume private secrets (`RAZORPAY_KEY_SECRET`, `FIREBASE_PRIVATE_KEY`).
- **Static Bundle Grep Check:**
  ```powershell
  Get-ChildItem -Recurse .next/static -Filter *.js | Select-String "RAZORPAY_KEY_SECRET"
  # Output: 0 matches (Empty)
  ```

### 2. Phase 2 — Data Layer & Schema
- **Collections:** `products`, `carts`, `orders`, `audit_logs`.
- **Audit Log Schema:**
  ```typescript
  {
    id: string;
    timestamp: Timestamp | Date;
    actor: 'ai' | 'human' | 'system';
    action: string;
    details: Record<string, unknown>;
    status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed';
    userId?: string;
    relatedCartId?: string;
    relatedOrderId?: string;
  }
  ```
- All schema models feature optional `userId` for future authentication extension without schema rewrite.

### 3. Phase 3 — AI Agent Architectural Boundary
- The Gemini 2.0 Flash model is strictly confined to tool use defined in `lib/gemini.ts`.
- **Available Tools:**
  1. `search_products(query, category)`
  2. `propose_cart(items: [{ productId, quantity }])`
- Every cart proposal is saved to Firestore with `status: 'proposed'` and written to the audit log. The AI has **zero knowledge** of Razorpay APIs.

### 4. Phase 4 — Transaction Gate & Order Creation
- **Endpoint:** `POST /api/orders/create`
- **Security Controls:**
  1. **Human Trigger Only:** Must be explicitly triggered by a user action (Approve button).
  2. **Total Recalculation:** Client-supplied totals are discarded. Prices are fetched directly from Firestore `products` collection.
  3. **Hard Limit Enforcement:**
     ```typescript
     if (recalculatedTotalPaise > ORDER_LIMIT_PAISE) { // 1,000,000 paise (₹10,000)
       await writeAuditLog({ actor: 'system', action: 'create_order', status: 'rejected', ... });
       return NextResponse.json({ error: 'Order total exceeds ₹10,000 limit' }, { status: 400 });
     }
     ```

### 5. Phase 5 — Payment Capture & Signature Verification
- **Endpoint:** `POST /api/orders/verify`
- **Verification Logic:**
  ```typescript
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(razorpay_signature, 'hex')
  );
  ```
- **Tampering Behavior:** If signatures mismatch, order is marked `failed`, an audit log is emitted with `status: 'failed'`, and HTTP 400 is returned.

### 6. Phase 6 — Merchant Dashboard
- **Route:** `/dashboard`
- **Features:**
  1. **Approval Queue:** Displays pending cart proposals with live subtotal/total calculations and Approve/Reject action triggers.
  2. **Live Audit Trail:** Streams Firestore `audit_logs` chronologically using `onSnapshot` with fallback to `/api/audit` polling.
