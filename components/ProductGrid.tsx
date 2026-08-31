'use client';

import React, { useState, useMemo } from 'react';
import ProductCard from './ProductCard';
import { CatalogProduct } from '@/lib/productsData';

interface ProductGridProps {
  products: CatalogProduct[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  searchQuery: string;
  onAskAiToOrder: (product: CatalogProduct) => void;
  onAddToCart: (product: CatalogProduct) => void;
}

export default function ProductGrid({
  products,
  selectedCategory,
  onCategorySelect,
  searchQuery,
  onAskAiToOrder,
  onAddToCart,
}: ProductGridProps) {
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'rating'>('featured');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under2k' | '2k-4k' | 'above4k'>('all');

  const categories = [
    'All Categories',
    'Audio',
    'Peripherals',
    'Wearables',
    'Storage',
    'Gaming',
    'Accessories',
  ];

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Category filter
        if (selectedCategory !== 'All Categories' && product.category !== selectedCategory) {
          return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = product.name.toLowerCase().includes(q);
          const matchDesc = product.description.toLowerCase().includes(q);
          const matchCategory = product.category.toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchCategory) {
            return false;
          }
        }

        // Price filter
        if (priceFilter === 'under2k' && product.displayPrice >= 2000) return false;
        if (priceFilter === '2k-4k' && (product.displayPrice < 2000 || product.displayPrice > 4000)) return false;
        if (priceFilter === 'above4k' && product.displayPrice <= 4000) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.displayPrice - b.displayPrice;
        if (sortBy === 'price-high') return b.displayPrice - a.displayPrice;
        if (sortBy === 'rating') return b.rating - a.rating;
        return 0; // featured default
      });
  }, [products, selectedCategory, searchQuery, priceFilter, sortBy]);

  return (
    <section className="product-catalog-section">
      {/* Catalog Controls Strip */}
      <div className="catalog-header-bar">
        <div className="catalog-title-wrap">
          <h2 className="catalog-heading">
            {selectedCategory === 'All Categories' ? 'Featured Tech & Electronics' : selectedCategory}
          </h2>
          <span className="results-count">
            Showing {filteredProducts.length} of {products.length} products
          </span>
        </div>

        {/* Filter & Sort Controls */}
        <div className="catalog-filters">
          {/* Price Range Filter */}
          <div className="filter-group">
            <label htmlFor="priceFilterSelect">Price:</label>
            <select
              id="priceFilterSelect"
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as typeof priceFilter)}
              className="filter-select"
            >
              <option value="all">All Prices</option>
              <option value="under2k">Under ₹2,000</option>
              <option value="2k-4k">₹2,000 - ₹4,000</option>
              <option value="above4k">Above ₹4,000</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="filter-group">
            <label htmlFor="sortBySelect">Sort by:</label>
            <select
              id="sortBySelect"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="filter-select"
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Avg. Customer Review</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="category-pills-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategorySelect(cat)}
            className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Cards Grid */}
      {filteredProducts.length === 0 ? (
        <div className="empty-catalog-state">
          <div className="empty-icon">🔍</div>
          <h3>No products match your criteria</h3>
          <p>Try clearing filters or searching for something else.</p>
          <button
            onClick={() => {
              onCategorySelect('All Categories');
              setPriceFilter('all');
            }}
            className="btn-reset-filters"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="amazon-product-grid">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAskAiToOrder={onAskAiToOrder}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      )}
    </section>
  );
}
