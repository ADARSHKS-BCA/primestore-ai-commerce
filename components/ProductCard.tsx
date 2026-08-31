'use client';

import React from 'react';
import { CatalogProduct } from '@/lib/productsData';

interface ProductCardProps {
  product: CatalogProduct;
  onAskAiToOrder: (product: CatalogProduct) => void;
  onAddToCart: (product: CatalogProduct) => void;
}

export default function ProductCard({
  product,
  onAskAiToOrder,
  onAddToCart,
}: ProductCardProps) {
  // Render star ratings
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="product-stars" title={`${rating} out of 5 stars`}>
        <span className="stars-filled">{'★'.repeat(fullStars)}</span>
        {hasHalfStar && <span className="star-half">★</span>}
        <span className="stars-empty">{'☆'.repeat(emptyStars)}</span>
        <span className="rating-number">{rating.toFixed(1)}</span>
        <span className="review-count">({product.reviewCount.toLocaleString('en-IN')})</span>
      </div>
    );
  };

  return (
    <div className="amazon-product-card">
      {/* Top Badges */}
      <div className="product-badge-row">
        {product.badge && (
          <span
            className={`product-badge ${
              product.badge === 'Best Seller'
                ? 'badge-bestseller'
                : product.badge === "Amazon's Choice"
                ? 'badge-choice'
                : 'badge-deal'
            }`}
          >
            {product.badge}
          </span>
        )}
        {product.discountPercent > 0 && (
          <span className="discount-tag">-{product.discountPercent}% OFF</span>
        )}
      </div>

      {/* Product Image */}
      <div className="product-image-container">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="product-image"
          loading="lazy"
        />
      </div>

      {/* Product Information */}
      <div className="product-info">
        <span className="product-category-label">{product.category}</span>
        <h3 className="product-title" title={product.name}>
          {product.name}
        </h3>

        {/* Rating */}
        {renderStars(product.rating)}

        {/* Key Features */}
        <ul className="product-features-list">
          {product.features.slice(0, 2).map((feat, idx) => (
            <li key={idx}>✓ {feat}</li>
          ))}
        </ul>

        {/* Price Row */}
        <div className="product-price-row">
          <span className="currency-symbol">₹</span>
          <span className="price-main">{product.displayPrice.toLocaleString('en-IN')}</span>
          {product.originalPrice > product.displayPrice && (
            <span className="price-original">
              M.R.P: <s>₹{product.originalPrice.toLocaleString('en-IN')}</s>
            </span>
          )}
        </div>

        {/* Prime & Delivery */}
        {product.primeEligible && (
          <div className="product-prime-row">
            <span className="prime-badge">prime</span>
            <span className="delivery-time">FREE One-Day Delivery</span>
          </div>
        )}

        <div className="stock-status">
          {product.inStock ? (
            <span className="in-stock-text">✓ In Stock</span>
          ) : (
            <span className="out-stock-text">Currently Unavailable</span>
          )}
        </div>

        {/* Card Actions */}
        <div className="product-card-actions">
          <button
            onClick={() => onAskAiToOrder(product)}
            className="btn-ask-ai"
            title="Tell AI assistant to order this item"
          >
            <span className="btn-ai-icon">🤖</span>
            <span>Ask AI to Order</span>
          </button>

          <button
            onClick={() => onAddToCart(product)}
            className="btn-add-cart"
            title="Add item to your cart"
          >
            🛒 Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
