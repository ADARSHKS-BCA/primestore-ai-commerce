import { Timestamp } from 'firebase/firestore';

// --- Products ---
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;          // in paise (₹1 = 100 paise)
  displayPrice: number;   // in rupees for UI
  category: string;
  imageUrl: string;
  inStock: boolean;
}

// --- Cart ---
export interface CartItem {
  productId: string;
  name: string;
  price: number;          // paise
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totalPaise: number;
  totalDisplay: number;   // rupees
  status: 'proposed' | 'approved' | 'rejected' | 'checked_out';
  createdAt: Timestamp | Date;
  userId?: string;        // Placeholder for future auth
}

// --- Orders ---
export interface Order {
  id: string;
  cartId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;         // paise
  currency: string;
  status: 'created' | 'paid' | 'failed';
  createdAt: Timestamp | Date;
  userId?: string;
  deliveryAddress?: string;
}

// --- Audit Logs ---
export type AuditActor = 'ai' | 'human' | 'system';
export type AuditStatus = 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed';

export interface AuditLogEntry {
  id: string;
  timestamp: Timestamp | Date;
  actor: AuditActor;
  action: string;
  details: Record<string, unknown>;
  status: AuditStatus;
  userId?: string;
  relatedCartId?: string;
  relatedOrderId?: string;
}

// --- Chat Messages ---
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  cart?: Cart;
}

// --- Voice Session Logs ---
export interface VoiceSessionLog {
  id: string;
  userId: string | null;
  userName: string | null;
  startedAt: string;
  endedAt: string | null;
  transcript: Array<{
    role: 'user' | 'bot';
    text: string;
    timestamp: string;
    intent?: string;
    slots?: Record<string, unknown>;
    state?: string;
    reasoning?: string;
  }>;
  outcome: 'order_placed' | 'abandoned' | 'payment_failed' | 'error';
  orderId: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  statesVisited: string[];
  upsellOffered?: boolean;
  upsellAccepted?: boolean;
  upsellItem?: { name: string; displayPrice: number } | null;
  orderTotalDisplay?: number | null;
}

