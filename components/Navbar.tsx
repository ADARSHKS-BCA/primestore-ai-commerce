'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import { CATEGORIES } from '@/lib/productsData';

interface NavbarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  cartItemCount?: number;
  onOpenCart?: () => void;
}

export default function Navbar({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  cartItemCount = 0,
  onOpenCart,
}: NavbarProps) {
  const [dropdownCategory, setDropdownCategory] = useState('All Categories');

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (dropdownCategory !== 'All Categories') {
        onSelectCategory(dropdownCategory);
      }
      onSearchSubmit();
    }
  };

  const handleSearchButtonClick = () => {
    if (dropdownCategory !== 'All Categories') {
      onSelectCategory(dropdownCategory);
    }
    onSearchSubmit();
  };

  return (
    <nav className="navbar-container">
      {/* Top Main Navigation Bar */}
      <div className="navbar-top">
        {/* Brand Logo */}
        <Link href="/" className="brand-logo">
          <span>prime<span className="brand-highlight">store</span></span>
          <span className="brand-badge">AI 2.0</span>
        </Link>

        {/* Global Search Bar with Category Filter */}
        <div className="navbar-search">
          <select
            value={dropdownCategory}
            onChange={(e) => setDropdownCategory(e.target.value)}
            className="search-category-select"
            aria-label="Filter category"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search Sony headphones, Nike shoes, Apple Watch, mechanical keyboards..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            className="search-input"
          />

          <button
            onClick={handleSearchButtonClick}
            className="search-btn"
            aria-label="Search"
          >
            🔍
          </button>
        </div>

        {/* Right Navigation Actions */}
        <div className="navbar-actions">
          {/* Theme Toggle (Light / Dark) */}
          <ThemeToggle />

          {/* Cart Button with Count Badge */}
          {onOpenCart && (
            <button
              onClick={onOpenCart}
              className="nav-link-btn"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                background: cartItemCount > 0 ? 'rgba(6, 182, 212, 0.15)' : undefined,
                borderColor: cartItemCount > 0 ? 'var(--accent-cyan)' : undefined,
              }}
              title="View Cart & Checkout"
            >
              <span>Cart</span>
              {cartItemCount > 0 && (
                <span
                  style={{
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    padding: '1px 7px',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  {cartItemCount}
                </span>
              )}
            </button>
          )}

          {/* User Account / Profile */}
          <Link href="/account" className="nav-link-btn" title="Your Account & Order History">
            Account
          </Link>

          {/* Merchant Dashboard */}
          <Link href="/dashboard" className="nav-link-btn" title="Merchant Dashboard & Real-Time Audit">
            Dashboard
          </Link>
        </div>
      </div>

      {/* Sub Navigation Bar with Category Pills */}
      <div className="navbar-subbar">
        <div className="subbar-content">
          <div className="category-nav-pills">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`nav-pill ${selectedCategory === cat ? 'active' : ''}`}
              >
                {cat === 'All Categories' ? 'All Deals' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
