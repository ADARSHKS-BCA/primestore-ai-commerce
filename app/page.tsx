'use client';

import { useState, useEffect } from 'react';
import AmazonNavbar from '@/components/AmazonNavbar';
import HeroBanner from '@/components/HeroBanner';
import ProductGrid from '@/components/ProductGrid';
import ChatInterface from '@/components/ChatInterface';
import { PRODUCTS_CATALOG, CatalogProduct } from '@/lib/productsData';

export default function Home() {
  const [products, setProducts] = useState<CatalogProduct[]>(PRODUCTS_CATALOG);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [externalPrompt, setExternalPrompt] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch live products if available
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
        console.warn('Using local master catalog');
      }
    }
    fetchProducts();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // When user clicks "Ask AI to Order" on any product card
  const handleAskAiToOrder = (product: CatalogProduct) => {
    const prompt = `Please order 1 unit of ${product.name} (Product ID: ${product.id}) for ₹${product.displayPrice}.`;
    setExternalPrompt(prompt);
    setIsChatOpen(true);
    showToast(`🤖 Commanding AI to order: ${product.name}`);
  };

  // When user clicks standard "Add to Cart"
  const handleAddToCart = (product: CatalogProduct) => {
    setCartCount((prev) => prev + 1);
    showToast(`🛒 Added ${product.name} to Cart!`);
  };

  // When user clicks quick hero chips
  const handleHeroQuickOrder = (prompt: string) => {
    setExternalPrompt(prompt);
    setIsChatOpen(true);
    showToast(`🎙️ AI Command: "${prompt}"`);
  };

  return (
    <div className="amazon-store-container">
      {/* Top Amazon Navigation Bar */}
      <AmazonNavbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        cartCount={cartCount}
        onCartClick={() => {
          showToast(`🛒 You have ${cartCount} items in your shopping bag.`);
        }}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        isChatOpen={isChatOpen}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="amazon-toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Split / Side-by-Side Content Area */}
      <main className="amazon-main-split-layout">
        {/* Left Area: Hero Banner + Product Catalog Grid (65-70% width on desktop) */}
        <div className={`amazon-catalog-pane ${isChatOpen ? 'with-chat' : 'full-width'}`}>
          <HeroBanner onQuickOrderClick={handleHeroQuickOrder} />

          <ProductGrid
            products={products}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            searchQuery={searchQuery}
            onAskAiToOrder={handleAskAiToOrder}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* Right Area: AI Shopping Copilot Bot (30-35% width on desktop) */}
        {isChatOpen && (
          <div className="amazon-ai-dock-pane">
            <ChatInterface
              externalPrompt={externalPrompt}
              onClearExternalPrompt={() => setExternalPrompt(null)}
              onClose={() => setIsChatOpen(false)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="amazon-footer">
        <div className="footer-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Back to top ↑
        </div>
        <div className="footer-links-grid">
          <div className="footer-col">
            <h4>Get to Know Us</h4>
            <a href="#">About PrimeStore</a>
            <a href="#">Careers</a>
            <a href="#">Press Releases</a>
            <a href="#">AI Commerce Innovation</a>
          </div>
          <div className="footer-col">
            <h4>Payment & Security</h4>
            <a href="#">Razorpay Test Sandbox</a>
            <a href="#">100% Purchase Protection</a>
            <a href="#">Human Approval Gate</a>
            <a href="/dashboard">Merchant Admin Portal</a>
          </div>
          <div className="footer-col">
            <h4>AI Copilot Features</h4>
            <a href="#">Voice-to-Order Recognition</a>
            <a href="#">Smart Recommendations</a>
            <a href="#">Multi-Item Carting</a>
            <a href="#">Instant Signature Verification</a>
          </div>
        </div>
        <div className="footer-bottom-copy">
          <p>© 2026 PrimeStore AI. All rights reserved. Powered by Google Gemini 2.0 & Razorpay Payments.</p>
        </div>
      </footer>
    </div>
  );
}
