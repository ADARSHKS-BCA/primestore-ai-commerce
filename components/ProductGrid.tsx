'use client';

import { useState, useMemo } from 'react';
import ProductCard from './ProductCard';
import { CatalogProduct } from '@/lib/productsData';

interface ProductGridProps {
  products: CatalogProduct[];
  selectedCategory: string;
  searchQuery: string;
  selectedPriceBand?: 'all' | 'budget' | 'mid' | 'premium';
  onPriceBandChange?: (band: 'all' | 'budget' | 'mid' | 'premium') => void;
  onAddToCart?: (product: CatalogProduct) => void;
  onOpenAssistantForProduct?: (product: CatalogProduct) => void;
  highlightedProductId?: string | null;
}

export default function ProductGrid({
  products,
  selectedCategory,
  searchQuery,
  selectedPriceBand: controlledPriceBand,
  onPriceBandChange,
  onAddToCart,
  onOpenAssistantForProduct,
  highlightedProductId,
}: ProductGridProps) {
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [internalPriceBand, setInternalPriceBand] = useState<'all' | 'budget' | 'mid' | 'premium'>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating' | 'discount'>('featured');

  const activePriceBand = controlledPriceBand !== undefined ? controlledPriceBand : internalPriceBand;

  const handlePriceBandClick = (band: 'all' | 'budget' | 'mid' | 'premium') => {
    setInternalPriceBand(band);
    onPriceBandChange?.(band);
  };

  // Extract distinct brands from products
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach((p) => {
      if (selectedCategory === 'All Categories' || p.category === selectedCategory) {
        brands.add(p.brand);
      }
    });
    return ['All', ...Array.from(brands).sort()];
  }, [products, selectedCategory]);

  // Filter and Sort Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Category Filter
        if (selectedCategory !== 'All Categories' && product.category !== selectedCategory) {
          return false;
        }

        // Brand Filter
        if (selectedBrand !== 'All' && product.brand !== selectedBrand) {
          return false;
        }

        // Price Band Filter
        if (activePriceBand === 'budget' && product.displayPrice > 2000) return false;
        if (activePriceBand === 'mid' && (product.displayPrice < 2000 || product.displayPrice > 8000)) return false;
        if (activePriceBand === 'premium' && product.displayPrice < 8000) return false;

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = product.name.toLowerCase().includes(q);
          const matchBrand = product.brand.toLowerCase().includes(q);
          const matchDesc = product.description.toLowerCase().includes(q);
          const matchCategory = product.category.toLowerCase().includes(q);
          return matchName || matchBrand || matchDesc || matchCategory;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.displayPrice - b.displayPrice;
        if (sortBy === 'price-desc') return b.displayPrice - a.displayPrice;
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'discount') return b.discountPercent - a.discountPercent;
        return 0;
      });
  }, [products, selectedCategory, selectedBrand, activePriceBand, searchQuery, sortBy]);

  return (
    <section className="storefront-main">
      {/* Header & Product Count */}
      <div className="catalog-header">
        <div className="catalog-title-box">
          <h2>
            {selectedCategory === 'All Categories' ? 'Explore All Products' : `${selectedCategory} Collection`}
          </h2>
          <p>
            Showing <strong>{filteredProducts.length}</strong> items from top global brands
          </p>
        </div>
      </div>

      {/* Filter & Sort Toolbar */}
      <div className="catalog-toolbar">
        {/* Brand Filter */}
        <div className="filter-group">
          <span className="filter-label">Brand:</span>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="filter-select"
            aria-label="Filter by brand"
          >
            {availableBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Price Band Pills */}
        <div className="filter-group">
          <span className="filter-label">Price Range:</span>
          <div className="filter-pills">
            <button
              onClick={() => handlePriceBandClick('all')}
              className={`price-pill ${activePriceBand === 'all' ? 'active' : ''}`}
            >
              All
            </button>
            <button
              onClick={() => handlePriceBandClick('budget')}
              className={`price-pill ${activePriceBand === 'budget' ? 'active' : ''}`}
            >
              Budget (&lt; ₹2k)
            </button>
            <button
              onClick={() => handlePriceBandClick('mid')}
              className={`price-pill ${activePriceBand === 'mid' ? 'active' : ''}`}
            >
              Mid (₹2k – ₹8k)
            </button>
            <button
              onClick={() => handlePriceBandClick('premium')}
              className={`price-pill ${activePriceBand === 'premium' ? 'active' : ''}`}
            >
              Premium (&gt; ₹8k)
            </button>
          </div>
        </div>

        {/* Sort By Dropdown */}
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <span className="filter-label">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="filter-select"
            aria-label="Sort products"
          >
            <option value="featured">Featured Deals</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
            <option value="discount">Biggest Discounts</option>
          </select>
        </div>
      </div>

      {/* Product Cards Grid */}
      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h3>No products match your filters</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Try resetting your price range or brand filter to see more items.
          </p>
          <button
            onClick={() => {
              setSelectedBrand('All');
              handlePriceBandClick('all');
            }}
            className="price-pill"
            style={{ marginTop: '1.25rem', padding: '0.5rem 1.25rem', background: 'var(--accent-primary)', color: '#fff' }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              onOpenAssistantForProduct={onOpenAssistantForProduct}
              isHighlighted={highlightedProductId === product.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
