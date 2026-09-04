'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HeroShowcase from '@/components/HeroShowcase';
import ProductGrid from '@/components/ProductGrid';
import FloatingAssistant from '@/components/FloatingAssistant';
import CartDrawer, { CartItemData } from '@/components/CartDrawer';
import { PRODUCTS_CATALOG, CatalogProduct } from '@/lib/productsData';

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [products, setProducts] = useState<CatalogProduct[]>(PRODUCTS_CATALOG);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedPriceBand, setSelectedPriceBand] = useState<'all' | 'budget' | 'mid' | 'premium'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItemData[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load saved cart from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('primestore_cart');
      if (savedCart) {
        try {
          const parsed = JSON.parse(savedCart);
          if (Array.isArray(parsed)) {
            setCartItems(parsed);
          }
        } catch {
          // ignore corrupted cart
        }
      }
    }
  }, []);

  // Save cart to localStorage on changes
  const updateAndPersistCart = useCallback((updated: CartItemData[]) => {
    setCartItems(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('primestore_cart', JSON.stringify(updated));
    }
  }, []);

  // Ensure user is logged in before viewing storefront
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('primestore_user');
      if (!savedUser) {
        router.replace('/auth/login');
        return;
      }
      setCheckingAuth(false);
    }
  }, [router]);

  // Fetch live products from Cloud Firestore (with in-memory catalog fallback) & Auto-Refresh
  const fetchLiveProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
      }
    } catch (err) {
      console.warn('Using local master catalog', err);
    }
  }, []);

  useEffect(() => {
    fetchLiveProducts();

    // Auto-refresh catalog every 20 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLiveProducts();
      }
    }, 20000);

    // Auto-refresh when tab/window gains focus
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchLiveProducts();
        // Also sync cart from storage in case it changed in another tab
        const savedCart = localStorage.getItem('primestore_cart');
        if (savedCart) {
          try {
            const parsed = JSON.parse(savedCart);
            if (Array.isArray(parsed)) setCartItems(parsed);
          } catch {}
        }
      }
    };

    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleFocus);
    };
  }, [fetchLiveProducts]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Add Product to Cart Action
  const handleAddToCart = (product: CatalogProduct) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      let updated: CartItemData[];
      if (existingIndex > -1) {
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
      } else {
        updated = [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            brand: product.brand,
            price: product.price,
            displayPrice: product.displayPrice,
            imageUrl: product.imageUrl,
            quantity: 1,
            category: product.category,
          },
        ];
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('primestore_cart', JSON.stringify(updated));
      }
      return updated;
    });

    showToast(`Added ${product.name} to Cart`);
  };

  // Update item quantity in cart
  const handleUpdateQuantity = (productId: string, delta: number) => {
    const updated = cartItems
      .map((item) => {
        if (item.productId === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter(Boolean) as CartItemData[];

    updateAndPersistCart(updated);
  };

  // Remove item from cart
  const handleRemoveItem = (productId: string) => {
    const updated = cartItems.filter((item) => item.productId !== productId);
    updateAndPersistCart(updated);
  };

  // Clear cart
  const handleClearCart = () => {
    updateAndPersistCart([]);
  };

  const handleOpenAssistantWithPrompt = (prompt: string) => {
    setAssistantPrompt(prompt);
    setIsAssistantOpen(true);
  };

  // Voice state machine drives this — single source of truth for UI updates
  const handleProductSelect = useCallback((productId: string | null) => {
    setHighlightedProductId(productId);
  }, []);

  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            prime<span style={{ color: 'var(--accent-gold)' }}>store</span>
          </div>
          <div>Loading PrimeStore...</div>
        </div>
      </div>
    );
  }

  const totalCartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top Navbar with Cart Button, Theme Toggle, Search & Category selector */}
      <Navbar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {}}
        cartItemCount={totalCartItemCount}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Floating Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            background: 'var(--accent-primary)',
            color: '#ffffff',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 999,
            fontWeight: 700,
            fontSize: '0.9rem',
            animation: 'modal-enter 0.2s ease',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Hero Showcase Banner */}
      <HeroShowcase
        onSelectCategory={setSelectedCategory}
        onOpenAssistantWithPrompt={handleOpenAssistantWithPrompt}
      />

      {/* Product Catalog Grid & Multi-Facet Filters */}
      <ProductGrid
        products={products}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        selectedPriceBand={selectedPriceBand}
        onPriceBandChange={setSelectedPriceBand}
        onAddToCart={handleAddToCart}
        highlightedProductId={highlightedProductId}
      />

      {/* Slide-out Shopping Cart Drawer with 1-Click Razorpay Payment */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onPaymentSuccess={(orderId) => {
          showToast(`Order #${orderId} placed successfully!`);
        }}
      />

      {/* Persistent Floating 3D Robot Assistant (Voice + Text + Manual Guided Shopping Wizard) */}
      <FloatingAssistant
        initialPrompt={assistantPrompt}
        onCategoryFilterChange={setSelectedCategory}
        onSearchChange={setSearchQuery}
        onPriceBandChange={setSelectedPriceBand}
        onProductSelect={handleProductSelect}
        isOpen={isAssistantOpen}
        onToggle={() => setIsAssistantOpen((prev) => !prev)}
        onClose={() => setIsAssistantOpen(false)}
      />

      {/* Modern Footer */}
      <footer
        style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          padding: '3rem 1.5rem',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          fontSize: '0.88rem',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            prime<span style={{ color: 'var(--accent-gold)' }}>store</span> AI 2.0
          </div>
          <p style={{ maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
            The Next-Generation Voice &amp; AI-Driven E-Commerce Platform. Backed by Supabase, Cloud Firestore &amp; Razorpay Payments.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <a href="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>Home</a>
            <button onClick={() => setIsCartOpen(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', padding: 0 }}>
              Cart ({totalCartItemCount})
            </button>
            <a href="/account" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>Your Account</a>
            <a href="/dashboard" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>Merchant Dashboard</a>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            © 2026 PrimeStore Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
