# 🚀 PrimeStore AI 2.0 — Voice-First Intelligent E-Commerce Platform

> **Next-Generation Autonomous AI Shopping Copilot, Bounded Agentic State Machine, Multi-Item Cart Engine, Supabase & Cloud Firestore Dual-Sync, and Razorpay Payments.**

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Payment%20Gateway-02042B?style=flat&logo=razorpay)](https://razorpay.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Cloud%20Firestore-FFCA28?style=flat&logo=firebase)](https://firebase.google.com/)

---

## 📌 1. Project Overview & Pitch

**PrimeStore AI 2.0** is an enterprise-grade, voice-driven e-commerce platform designed to bridge the gap between static web catalogs and interactive conversational shopping. Built with a **Deterministic Finite State Machine (FSM)**, a **Real-Time Client Voice STT/TTS Engine**, a **Multi-Product Shopping Cart Engine**, and a **Human-in-the-Loop Approval System**, PrimeStore solves the critical trust, latency, and hallucination problems plaguing traditional AI e-commerce bots.

### 🌟 Why This Matters (The Problem It Solves)
1. **Search & Discovery Friction**: Traditional search requires rigid keywords and deep filtering. PrimeStore lets shoppers speak natural queries (*"Find noise-canceling headphones under ₹5,000"* or *"Compare MacBook Pro with gaming laptops"*), and the AI immediately filters, selects, and presents products.
2. **Hallucination & Rogue Action Prevention**: Unlike unconstrained LLM bots that can execute unauthorized transactions or fabricate non-existent discounts, PrimeStore utilizes a strict **Bounded State Machine** with hard financial safety limits (₹10,000 max order limit) and mandatory human confirmation before payment creation.
3. **Cart Flexibility & Instant Checkout**: Shoppers can add products to a persistent multi-item cart to buy later or check out in 1 click via **Razorpay Test Mode**.
4. **Explainable AI & Merchant Auditability**: Every customer voice utterance, intent classification, transition state, and upsell recommendation is recorded turn-by-turn with explainable reasoning in the Merchant Dashboard.

---

## 🎯 2. Project Objectives

- **Sub-Second Voice Interaction**: Low-latency Speech-to-Text (STT) and Text-to-Speech (TTS) with push-to-talk, barge-in support, and automatic offline/network failure degradation.
- **Dynamic Multi-Item Cart & 1-Click Payments**: Real-time cart calculations, quantity modifications, cross-tab synchronization, and seamless Razorpay modal payments.
- **Strict Database-Backed Authentication**: Protected storefront gating with Supabase & Firestore storage, SHA-256 password hashing, and user-isolated order histories.
- **Explainable Autonomous Upselling**: Context-aware upselling algorithms with trackable conversion metrics and zero high-pressure lock-in.
- **Continuous Real-Time Sync**: Auto-refresh mechanisms across the catalog, cart, user account, and merchant console without full page reloads.

---

## 🛠️ 3. Architecture & Tech Stack

```
                                  ┌────────────────────────┐
                                  │   Shopper Interface    │
                                  │  (Voice & 3D Assistant)│
                                  └───────────┬────────────┘
                                              │
                                   Web Speech API (STT/TTS)
                                              │
                                  ┌───────────▼────────────┐
                                  │ Bounded State Machine  │
                                  │ (Deterministic Intent) │
                                  └───────────┬────────────┘
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
         ┌───────────────────────┐┌───────────────────────┐┌───────────────────────┐
         │ Dynamic Cart Engine   ││ Razorpay Payment API  ││ Supabase / Firestore  │
         │ (Persistent Storage)  ││ (Order Verification)  ││ (Auth & Audit Trail)  │
         └───────────────────────┘└───────────────────────┘└───────────────────────┘
```

| Layer | Technologies Used |
|---|---|
| **Frontend Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| **Styling & Design** | Vanilla Modern CSS, Responsive Dark/Light Themes, Glassmorphism, Micro-Animations |
| **Voice & Speech Engine** | Web Speech Recognition API (`webkitSpeechRecognition`), SpeechSynthesis TTS with barge-in |
| **State Machine & Logic** | Deterministic 7-State FSM (`GREETING`, `DISCOVERY`, `RECOMMENDATION`, `UPSELL`, `CONFIRMATION`, `PAYMENT`, `FULFILLMENT`) |
| **Database & Auth** | Supabase (PostgreSQL), Google Cloud Firestore, In-Memory Master Fallback |
| **Payments** | Razorpay Node SDK & Razorpay Standard Client Checkout Modal |
| **Security & Logging** | SHA-256 Password Hashing, Input Sanitization, Human-Gated Order Safety Limit (₹10,000) |

---

## ⚡ 4. Key Features & What Works

### 🛒 1. Slide-Out Multi-Item Cart Drawer
- **Add to Cart from Catalog**: Direct 1-click cart addition from product cards and voice commands.
- **Live Quantity Adjustments**: Increment, decrement, and remove items with immediate subtotal and total recalculations.
- **Persistent Storage**: Saved in `localStorage` with cross-tab event listeners for instantaneous multi-tab sync.
- **1-Click Razorpay Checkout**: Directly initializes and triggers the official Razorpay test payment modal for all combined items.

### 🎙️ 2. Resilient Voice Assistant & AI Shopping Copilot
- **Push-to-Talk & Barge-In**: Interrupt bot speech at any moment by speaking or typing.
- **Network Failure Fallback**: Gracefully catches browser Web Speech network dropouts or permission denials and switches seamlessly to text and the manual step-by-step shopping wizard.
- **Dynamic Personalized Greeting**: Greets the logged-in user dynamically by their real name pulled from the database session.

### 🔐 3. Supabase & Database Authentication
- **Entry Gate**: Unauthenticated users are redirected to `/auth/login`.
- **Database Verification**: Validates credentials against Supabase / Firestore (no mock guest bypasses allowed).
- **User Account Dashboard (`/account`)**: Shoppers can update their Profile (Full Name, Email, Phone, Delivery Address) and view their live order history with Razorpay Payment IDs.

### 📊 4. Merchant Dashboard & Real-Time Audit (`/dashboard`)
- **Pending Approvals Queue**: Live Firestore listener for carts awaiting human confirmation.
- **Audit Trail**: Real-time event log tracking every AI proposal, state transition, and payment execution.
- **Explainable Voice Session Logs**: Complete turn-by-turn logs revealing shopper transcripts, detected intents, transition flows, and upsell accept rates.

### 🔄 5. Live Auto-Refresh Engine
- **Storefront**: Auto-polls catalog updates every 20 seconds and on window/tab focus.
- **Account Orders**: 10-second polling interval with an interactive **Auto-Refresh: ON** toggle and manual refresh button.
- **Merchant Console**: Real-time Firestore snapshot listeners paired with polling sync fallbacks.

---

## 🚧 5. Build Challenges & Technical Obstacles (And How We Solved Them)

### Challenge 1: Browser Web Speech API Network Dropouts
* **Issue**: In Chromium browsers, `webkitSpeechRecognition` frequently emits a `'network'` error or aborts when speech servers experience latency or offline network conditions.
* **Solution**: Engineered a resilient error handler in [lib/voiceEngine.ts](file:///d:/Razor/ai-commerce/lib/voiceEngine.ts) and [components/FloatingAssistant.tsx](file:///d:/Razor/ai-commerce/components/FloatingAssistant.tsx). Instead of crashing or showing unhandled console exceptions, the engine smoothly intercepts the error, emits a user-friendly notice, and switches instantly to keyboard input and the guided manual shopping wizard.

### Challenge 2: Static Product Cart Proposals vs Dynamic Multi-Item Ordering
* **Issue**: Early iterations of the voice agent defaulted to a static single-item proposal (e.g. boAt BassHeads ₹499) regardless of what the user selected.
* **Solution**: Developed a dynamic catalog resolution pipeline in [app/api/cart/checkout/route.ts](file:///d:/Razor/ai-commerce/app/api/cart/checkout/route.ts) and [components/CartDrawer.tsx](file:///d:/Razor/ai-commerce/components/CartDrawer.tsx) that maps selected product IDs, validates stock and prices, creates multi-item order proposals, and launches Razorpay checkouts dynamically.

### Challenge 3: Strict Database Auth Gating vs Guest Bypass Leaks
* **Issue**: Unauthenticated users could previously access the storefront through guest defaults without real database validation.
* **Solution**: Built server-side validation in [app/api/auth/login/route.ts](file:///d:/Razor/ai-commerce/app/api/auth/login/route.ts) and [app/api/auth/signup/route.ts](file:///d:/Razor/ai-commerce/app/api/auth/signup/route.ts) that hashes passwords with SHA-256, verifies records against Supabase and Firestore, and redirects unauthenticated visits directly to the login gate.

### Challenge 4: Broken External Product CDN Links
* **Issue**: External placeholder services (`dummyjson`, `fakestoreapi`) caused broken 404 images on specific products.
* **Solution**: Replaced all product image URLs with verified, high-resolution Unsplash CDN links across [lib/importedProducts.ts](file:///d:/Razor/ai-commerce/lib/importedProducts.ts) and implemented an auto-recovery `onError` fallback in [components/ProductCard.tsx](file:///d:/Razor/ai-commerce/components/ProductCard.tsx) to guarantee zero broken images.

### Challenge 5: Preventing Rogue AI Transactions
* **Issue**: Autonomous agents have a risk of executing rogue or unexpected payment orders.
* **Solution**: Enforced a strict **Human-in-the-Loop Approval Gating** architecture. AI agents can only transition to a `proposed` cart state. An order can only be signed and executed when a human explicitly clicks Approve & Pay or confirms the payment dialog, backed by a hard ceiling of ₹10,000 (`ORDER_LIMIT_PAISE`).

---

## 🚀 6. Getting Started & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm**

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/ADARSHKS-BCA/primestore-ai-commerce.git
cd primestore-ai-commerce
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` or `.env` file in the project root:
```env
# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=rzp_test_yourKeyIdHere
RAZORPAY_KEY_SECRET=yourKeySecretHere
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_yourKeyIdHere

# Supabase Database Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=yourSupabaseAnonKeyHere

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=yourFirebaseApiKeyHere
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=yourSenderId
NEXT_PUBLIC_FIREBASE_APP_ID=yourAppId
```

### 3. Run Locally in Development Mode
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 7. License & Credits

Built with ❤️ by **Adarsh K S** for Next-Generation Agentic Commerce.
Licensed under the [MIT License](LICENSE).
