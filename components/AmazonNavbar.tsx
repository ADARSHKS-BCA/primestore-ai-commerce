'use client';

import React from 'react';

interface AmazonNavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  cartCount: number;
  onCartClick: () => void;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
}

export default function AmazonNavbar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  cartCount,
  onCartClick,
  onToggleChat,
  isChatOpen = true,
}: AmazonNavbarProps) {
  const categories = [
    'All Categories',
    'Audio',
    'Peripherals',
    'Wearables',
    'Storage',
    'Gaming',
    'Accessories',
  ];

  return (
    <header className="amazon-header">
      {/* Top Main Navigation */}
      <div className="amazon-nav-top">
        {/* Brand Logo */}
        <div className="nav-logo-container">
          <a href="/" className="amazon-logo">
            <span className="logo-main">prime<span className="logo-accent">store</span></span>
            <span className="logo-badge">AI ⚡</span>
          </a>
        </div>

        {/* Deliver to Location */}
        <div className="nav-delivery-box">
          <div className="delivery-icon">📍</div>
          <div className="delivery-text">
            <span className="delivery-small">Deliver to</span>
            <span className="delivery-bold">Mumbai 400001</span>
          </div>
        </div>

        {/* Amazon Live Search Bar */}
        <div className="amazon-search-container">
          <div className="search-category-select-wrapper">
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="search-category-select"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search electronics, earbuds, keyboards, smartwatches..."
            className="amazon-search-input"
          />

          <button className="amazon-search-btn" title="Search">
            🔍
          </button>
        </div>

        {/* Right Nav Utilities */}
        <div className="nav-right-actions">
          {/* Language / Region */}
          <div className="nav-item nav-lang">
            <span className="flag">🇮🇳</span>
            <span className="lang-code">EN</span>
          </div>

          {/* Account / Orders */}
          <a href="/dashboard" className="nav-item nav-account">
            <span className="nav-line-1">Merchant</span>
            <span className="nav-line-2">Dashboard 📊</span>
          </a>

          {/* AI Copilot Toggle Button (for smaller screens or collapse) */}
          <button
            onClick={onToggleChat}
            className={`nav-ai-bot-btn ${isChatOpen ? 'active' : ''}`}
            title="Toggle AI Shopping Copilot"
          >
            <span className="ai-bot-pulse"></span>
            🤖 AI Bot {isChatOpen ? 'Active' : 'Open'}
          </button>

          {/* Cart Button */}
          <button onClick={onCartClick} className="nav-cart-btn" title="View Cart">
            <div className="cart-icon-wrap">
              🛒
              {cartCount > 0 && <span className="cart-count-badge">{cartCount}</span>}
            </div>
            <span className="cart-label">Cart</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Strip */}
      <div className="amazon-nav-sub">
        <div className="sub-nav-links">
          <button
            className={`sub-nav-item ${selectedCategory === 'All Categories' ? 'active' : ''}`}
            onClick={() => onCategoryChange('All Categories')}
          >
            ☰ All Products
          </button>
          <button
            className={`sub-nav-item ${selectedCategory === 'Audio' ? 'active' : ''}`}
            onClick={() => onCategoryChange('Audio')}
          >
            🎧 Audio
          </button>
          <button
            className={`sub-nav-item ${selectedCategory === 'Peripherals' ? 'active' : ''}`}
            onClick={() => onCategoryChange('Peripherals')}
          >
            ⌨️ Peripherals
          </button>
          <button
            className={`sub-nav-item ${selectedCategory === 'Gaming' ? 'active' : ''}`}
            onClick={() => onCategoryChange('Gaming')}
          >
            🎮 Gaming
          </button>
          <button
            className={`sub-nav-item ${selectedCategory === 'Wearables' ? 'active' : ''}`}
            onClick={() => onCategoryChange('Wearables')}
          >
            ⌚ Wearables
          </button>
          <button
            className={`sub-nav-item ${selectedCategory === 'Storage' ? 'active' : ''}`}
            onClick={() => onCategoryChange('Storage')}
          >
            💾 Storage
          </button>
          <button
            className={`sub-nav-item ${selectedCategory === 'Accessories' ? 'active' : ''}`}
            onClick={() => onCategoryChange('Accessories')}
          >
            🔌 Accessories
          </button>
        </div>

        <div className="sub-nav-promo">
          <span className="promo-tag">⚡ Mega Tech Sale</span>
          <span className="promo-text">Up to 50% Off | Free 1-Day Prime Delivery</span>
        </div>
      </div>
    </header>
  );
}
