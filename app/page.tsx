'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HeroShowcase from '@/components/HeroShowcase';
import ProductGrid from '@/components/ProductGrid';
import FloatingAssistant from '@/components/FloatingAssistant';
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

  // Fetch live products from Cloud Firestore (with in-memory catalog fallback)
  useEffect(() => {
    async function fetchProducts() {
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
    }
    fetchProducts();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleAddToCart = (product: CatalogProduct) => {
    showToast(`Added ${product.name} to your Cart`);
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top Navbar with Theme Toggle, Search & Category selector */}
      <Navbar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {}}
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
            <a href="/account" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>Your Account</a>
            <a href="/dashboard" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>Merchant Dashboard</a>
            <a href="/auth/login" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>Login / Register</a>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            © 2026 PrimeStore Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
