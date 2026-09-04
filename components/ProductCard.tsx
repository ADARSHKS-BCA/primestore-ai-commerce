'use client';

import { useState } from 'react';
import { CatalogProduct } from '@/lib/productsData';

interface ProductCardProps {
  product: CatalogProduct;
  onAddToCart?: (product: CatalogProduct) => void;
  onOpenAssistantForProduct?: (product: CatalogProduct) => void;
  isHighlighted?: boolean;
}

export default function ProductCard({
  product,
  onAddToCart,
  onOpenAssistantForProduct,
  isHighlighted,
}: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const [imgSrc, setImgSrc] = useState(product.imageUrl);

  const handleAdd = () => {
    setAdded(true);
    onAddToCart?.(product);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div
      className="product-card"
      onClick={() => onOpenAssistantForProduct?.(product)}
      style={isHighlighted ? {
        border: '2px solid var(--accent-cyan)',
        boxShadow: '0 0 20px rgba(6, 182, 212, 0.35), var(--shadow-lg)',
        transform: 'scale(1.02)',
        transition: 'all 0.3s ease',
        position: 'relative',
        cursor: 'pointer',
      } : { cursor: 'pointer' }}
    >
      {/* Voice Selected Badge */}
      {isHighlighted && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          zIndex: 10,
          padding: '3px 8px',
          borderRadius: '9999px',
          fontSize: '0.65rem',
          fontWeight: 800,
          background: 'var(--accent-cyan)',
          color: '#000',
          animation: 'pulse-glow 2s infinite',
        }}>
          Voice Selected
        </div>
      )}
      {/* Product Image & Badges */}
      <div className="card-image-box">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc || product.imageUrl}
          alt={product.name}
          className="card-img"
          loading="lazy"
          onError={() => {
            setImgSrc('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80');
          }}
        />

        {product.badge && (
          <span className="badge-overlay">{product.badge}</span>
        )}

        {product.discountPercent > 0 && (
          <span className="discount-badge">-{product.discountPercent}%</span>
        )}
      </div>

      {/* Card Body */}
      <div className="card-body">
        <div className="card-brand">{product.brand} • {product.category}</div>
        <h3 className="card-name" title={product.name}>
          {product.name}
        </h3>

        {/* Rating & Reviews */}
        <div className="card-rating-row">
          <span className="stars">★ {product.rating}</span>
          <span className="review-count">({product.reviewsCount.toLocaleString('en-IN')})</span>
        </div>

        {/* Feature Specs */}
        <div className="card-specs">
          {product.specs.slice(0, 3).map((spec, i) => (
            <span key={i} className="spec-chip">
              {spec}
            </span>
          ))}
        </div>

        {/* Price Row */}
        <div className="card-price-row">
          <span className="current-price">₹{product.displayPrice.toLocaleString('en-IN')}</span>
          {product.originalPrice > product.displayPrice && (
            <span className="original-price">₹{product.originalPrice.toLocaleString('en-IN')}</span>
          )}
        </div>

        {/* Action Button: Single Clean Add to Cart */}
        <button
          onClick={handleAdd}
          className="btn-add-cart"
        >
          {added ? 'Added to Cart' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
