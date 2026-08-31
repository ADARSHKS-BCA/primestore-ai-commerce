'use client';

import React from 'react';

interface HeroBannerProps {
  onQuickOrderClick?: (prompt: string) => void;
}

export default function HeroBanner({ onQuickOrderClick }: HeroBannerProps) {
  return (
    <div className="amazon-hero-banner">
      <div className="hero-content">
        <div className="hero-badge-pill">
          <span className="hero-pill-icon">✨</span>
          <span>Next-Gen AI Powered Commerce</span>
        </div>

        <h1 className="hero-title">
          Shop Top Tech Deals with <span className="gradient-text">AI Voice & Chat Copilot</span>
        </h1>

        <p className="hero-subtitle">
          Browse premium electronics below, or simply tell your sidekick AI bot to order whatever you want. Fast, safe, and instant Razorpay checkout!
        </p>

        <div className="hero-action-chips">
          <span className="chips-label">Try commanding the AI:</span>
          <button
            className="hero-chip"
            onClick={() => onQuickOrderClick?.('Order 2 Wireless Earbuds Pro')}
          >
            🎙️ &quot;Order 2 Wireless Earbuds Pro&quot;
          </button>
          <button
            className="hero-chip"
            onClick={() => onQuickOrderClick?.('I want the CyberMech Mechanical Keyboard')}
          >
            ⌨️ &quot;I want the CyberMech Keyboard&quot;
          </button>
          <button
            className="hero-chip"
            onClick={() => onQuickOrderClick?.('Suggest the best smartwatch under ₹5,000')}
          >
            ⌚ &quot;Best smartwatch under ₹5k&quot;
          </button>
        </div>
      </div>

      <div className="hero-trust-bar">
        <div className="trust-item">
          <span className="trust-icon">⚡</span>
          <div className="trust-text">
            <strong>Instant AI Carting</strong>
            <span>Commands parsed in milliseconds</span>
          </div>
        </div>

        <div className="trust-item">
          <span className="trust-icon">🛡️</span>
          <div className="trust-text">
            <strong>100% Human Approval</strong>
            <span>Zero blind charges — you review first</span>
          </div>
        </div>

        <div className="trust-item">
          <span className="trust-icon">💳</span>
          <div className="trust-text">
            <strong>Razorpay Secured</strong>
            <span>Official UPI, Cards & Netbanking test gateway</span>
          </div>
        </div>
      </div>
    </div>
  );
}
