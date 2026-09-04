'use client';

interface HeroShowcaseProps {
  onSelectCategory: (category: string) => void;
  onOpenAssistantWithPrompt: (prompt: string) => void;
}

export default function HeroShowcase({
  onSelectCategory,
  onOpenAssistantWithPrompt,
}: HeroShowcaseProps) {
  return (
    <section className="hero-showcase">
      <div className="hero-banner-card">
        <div className="hero-content">
          <div className="hero-tag">
            Voice &amp; AI Powered Commerce
          </div>
          <h1 className="hero-title">
            Shop Top Global Brands with Your AI Copilot
          </h1>
          <p className="hero-subtitle">
            Explore 40+ premium products from Sony, Apple, Nike, Logitech, Samsung &amp; more. 
            Use your persistent AI Copilot in the bottom right for instant voice navigation and seamless 1-click Razorpay checkout.
          </p>

          <div className="hero-voice-tip">
            <span>Voice Tip:</span> Try saying <em>&quot;I want to buy Nike shoes&quot;</em> or <em>&quot;Find Sony ANC headphones&quot;</em>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => onSelectCategory('Footwear')}
              className="quick-chip-btn"
              style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.3)' }}
            >
              Nike &amp; Adidas Shoes
            </button>
            <button
              onClick={() => onSelectCategory('Audio')}
              className="quick-chip-btn"
              style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.3)' }}
            >
              Sony &amp; Bose ANC
            </button>
            <button
              onClick={() => onSelectCategory('Wearables')}
              className="quick-chip-btn"
              style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.3)' }}
            >
              Apple &amp; Samsung Watches
            </button>
            <button
              onClick={() => onOpenAssistantWithPrompt('Show me gaming mechanical keyboards under ₹5,000')}
              className="quick-chip-btn"
              style={{ background: 'var(--accent-gold)', color: '#000000', borderColor: 'var(--accent-gold)' }}
            >
              Ask AI: Keyboards &lt; ₹5k
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
