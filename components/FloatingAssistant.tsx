'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import CartProposal from './CartProposal';
import { Cart } from '@/lib/schemas';
import { PRODUCTS_CATALOG, CATEGORIES, CatalogProduct } from '@/lib/productsData';
import { VoiceEngine } from '@/lib/voiceEngine';
import {
  VoiceSession,
  createVoiceSession,
  generateGreeting,
  processUserInput,
  setSessionAddress,
  setSessionCart,
  markOrderConfirmed,
  markOrderFailed,
  StateTransitionResult,
} from '@/lib/voiceStateMachine';
import { buildSessionLog, saveVoiceSessionLog } from '@/lib/voiceSessionLogger';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cart?: Cart | null;
}

interface FloatingAssistantProps {
  initialPrompt?: string | null;
  onCategoryFilterChange?: (category: string) => void;
  onSearchChange?: (query: string) => void;
  onPriceBandChange?: (band: 'all' | 'budget' | 'mid' | 'premium') => void;
  onProductSelect?: (productId: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export default function FloatingAssistant({
  initialPrompt,
  onCategoryFilterChange,
  onSearchChange,
  onPriceBandChange,
  onProductSelect,
  isOpen,
  onToggle,
  onClose,
}: FloatingAssistantProps) {
  // Mode: 'ai' (Voice/Chat) or 'manual' (Step-by-Step Guided Wizard)
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');
  const [userName, setUserName] = useState<string>('Shopper');
  const [showSpeechBubble, setShowSpeechBubble] = useState(true);

  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice Engine & State Machine
  const voiceEngineRef = useRef<VoiceEngine | null>(null);
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const hasGreetedRef = useRef(false);

  // Manual Wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [manualCategory, setManualCategory] = useState<string>('All Categories');
  const [manualPriceBand, setManualPriceBand] = useState<'all' | 'budget' | 'mid' | 'premium'>('all');
  const [manualSelectedProduct, setManualSelectedProduct] = useState<CatalogProduct | null>(null);
  const [manualQuantity, setManualQuantity] = useState<number>(1);
  const [manualProposedCart, setManualProposedCart] = useState<Cart | null>(null);
  const [manualCreatingCart, setManualCreatingCart] = useState(false);

  // ── Initialize Voice Engine ─────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const engine = new VoiceEngine({
      onInterimTranscript: (text) => {
        setInterimText(text);
      },
      onFinalTranscript: (text) => {
        setInterimText('');
        setInput(text);
        handleVoiceInput(text);
      },
      onListeningChange: (listening) => {
        setIsListening(listening);
        if (!listening) setInterimText('');
      },
      onSpeakingChange: (speaking) => {
        setIsSpeaking(speaking);
      },
      onFallbackToText: (reason) => {
        console.warn('[FloatingAssistant] Fallback to text:', reason);
        setActiveTab('manual');
        setMessages((prev) => [...prev, {
          id: `sys_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${reason}\n\nI've switched to manual mode. You can still type in AI mode or use the guided wizard.`,
        }]);
      },
      onError: (error) => {
        console.error('[FloatingAssistant] Voice error:', error);
      },
    });

    voiceEngineRef.current = engine;

    return () => {
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initialize User & Session ───────────────────────────────

  useEffect(() => {
    const savedUser = localStorage.getItem('primestore_user');
    let name = 'Shopper';
    let userId: string | null = null;
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.name) name = u.name.split(' ')[0];
        if (u.id) userId = u.id;
      } catch {
        // use default
      }
    }
    setUserName(name);

    // Create voice session
    const session = createVoiceSession(userId, name);
    voiceSessionRef.current = session;

    // Initial personalized welcome message
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `👋 **Welcome, ${name}! What would you like to order today?**\n\nI can help you find products, update the page, and place your order — all by voice!\n• *"I want to buy running shoes"*\n• *"Find Sony ANC headphones under ₹20,000"*\n• *"Show me mechanical keyboards"*\n• *"Order AuraPods Pro"*\n\n🎙️ **Tap the mic button to speak, or type below.**`,
      },
    ]);

    // Dismiss speech bubble after 10 seconds if unopened
    const timer = setTimeout(() => setShowSpeechBubble(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  // ── TTS Greeting on first open ──────────────────────────────

  useEffect(() => {
    if (isOpen && !hasGreetedRef.current && voiceEngineRef.current && voiceSessionRef.current) {
      hasGreetedRef.current = true;
      const greetResult = generateGreeting(voiceSessionRef.current);
      // Speak greeting aloud
      voiceEngineRef.current.speak(greetResult.botResponse);
    }
  }, [isOpen]);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen && activeTab === 'ai') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  // Handle external prompts
  useEffect(() => {
    if (initialPrompt) {
      handleVoiceInput(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // ── Apply State Machine Result to UI ────────────────────────

  const applyTransitionResult = useCallback(
    async (result: StateTransitionResult, session: VoiceSession) => {
      // Update UI filters (single source of truth)
      if (result.categoryFilter !== undefined) {
        onCategoryFilterChange?.(result.categoryFilter || 'All Categories');
      }
      if (result.priceBandFilter) {
        onPriceBandChange?.(result.priceBandFilter);
      }

      // Highlight selected product
      onProductSelect?.(result.selectedProduct?.id || null);

      // Handle API actions
      if (result.requiresApiCall && result.apiAction) {
        if (result.apiAction === 'propose_cart' && result.apiPayload) {
          try {
            const res = await fetch('/api/agent/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `Order ${result.selectedProduct?.name || 'the selected product'}`,
                conversationHistory: [],
              }),
            });
            const data = await res.json();
            if (data.cart) {
              setSessionCart(session, data.cart);
              // Add cart proposal message
              setMessages((prev) => [...prev, {
                id: `cart_${Date.now()}`,
                role: 'assistant',
                content: data.response || result.botResponse,
                cart: data.cart,
              }]);
              voiceEngineRef.current?.speak('Your cart is ready. Please review and approve it on screen.');
              return; // Don't add duplicate message
            }
          } catch (err) {
            console.error('[FloatingAssistant] Cart creation error:', err);
          }
        }

        if (result.apiAction === 'resolve_address') {
          try {
            const res = await fetch('/api/geolocation');
            const data = await res.json();
            if (data.address) {
              setSessionAddress(session, data.address);
              const addressMsg = `I found your location: ${data.address}. Shall I deliver here, or would you like to change it?`;
              setMessages((prev) => [...prev, {
                id: `addr_${Date.now()}`,
                role: 'assistant',
                content: addressMsg,
              }]);
              voiceEngineRef.current?.speak(addressMsg);
              return;
            } else {
              const askAddr = 'I couldn\'t determine your location. Please tell me your delivery address.';
              setMessages((prev) => [...prev, {
                id: `addr_${Date.now()}`,
                role: 'assistant',
                content: askAddr,
              }]);
              voiceEngineRef.current?.speak(askAddr);
              return;
            }
          } catch (err) {
            console.error('[FloatingAssistant] Geolocation error:', err);
          }
        }

        if (result.apiAction === 'create_order' && result.apiPayload?.cartId) {
          // The CartProposal component handles the actual Razorpay checkout
          // Just speak the instruction
          voiceEngineRef.current?.speak(result.botResponse);
        }
      }
    },
    [onCategoryFilterChange, onPriceBandChange, onProductSelect]
  );

  // ── Handle Payment Success from CartProposal ─────────────────
  const handlePaymentSuccess = useCallback(
    (details?: { razorpayOrderId: string; razorpayPaymentId: string }) => {
      const session = voiceSessionRef.current;
      if (session) {
        const res = markOrderConfirmed(session);
        setMessages((prev) => [
          ...prev,
          {
            id: `confirm_${Date.now()}`,
            role: 'assistant',
            content: res.botResponse,
          },
        ]);
        voiceEngineRef.current?.speak(res.botResponse);
        onProductSelect?.(null);

        // Save session log immediately on successful payment
        const log = buildSessionLog(
          session,
          'order_placed',
          session.cart?.id || null,
          details?.razorpayOrderId,
          details?.razorpayPaymentId
        );
        saveVoiceSessionLog(log);
      }
    },
    [onProductSelect]
  );

  // ── Handle Payment Failure from CartProposal ─────────────────
  const handlePaymentFailure = useCallback((reason: string) => {
    const session = voiceSessionRef.current;
    if (session) {
      const res = markOrderFailed(session, reason);
      setMessages((prev) => [
        ...prev,
        {
          id: `fail_${Date.now()}`,
          role: 'assistant',
          content: res.botResponse,
        },
      ]);
      voiceEngineRef.current?.speak(res.botResponse);

      // Save failure state to audit log immediately
      const log = buildSessionLog(session, 'payment_failed', session.cart?.id || null);
      saveVoiceSessionLog(log);
    }
  }, []);

  // ── Voice Input Handler (core loop) ─────────────────────────

  const handleVoiceInput = useCallback(
    async (textToSend: string) => {
      const query = textToSend.trim();
      if (!query || loading) return;

      const session = voiceSessionRef.current;
      if (!session) return;

      // Add user message to chat
      const userMsg: Message = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: query,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        // Process through state machine
        const result = processUserInput(session, query);

        if (result.requiresLLM) {
          // Unrecognized intent — fallback to existing LLM pipeline
          // Also apply any category/price filters from query (same as before)
          const qLower = query.toLowerCase();
          if (qLower.includes('shoe') || qLower.includes('footwear') || qLower.includes('sneaker') || qLower.includes('nike') || qLower.includes('adidas')) {
            onCategoryFilterChange?.('Footwear');
          } else if (qLower.includes('audio') || qLower.includes('earbud') || qLower.includes('headphone') || qLower.includes('sony') || qLower.includes('boat')) {
            onCategoryFilterChange?.('Audio');
          } else if (qLower.includes('watch') || qLower.includes('smartwatch') || qLower.includes('wearable')) {
            onCategoryFilterChange?.('Wearables');
          } else if (qLower.includes('keyboard') || qLower.includes('mouse') || qLower.includes('keychron') || qLower.includes('logitech')) {
            onCategoryFilterChange?.('Peripherals');
          } else if (qLower.includes('ssd') || qLower.includes('storage') || qLower.includes('drive')) {
            onCategoryFilterChange?.('Storage');
          } else if (qLower.includes('gaming') || qLower.includes('gamepad') || qLower.includes('controller')) {
            onCategoryFilterChange?.('Gaming');
          }

          if (qLower.includes('budget') || qLower.includes('under 2000') || qLower.includes('cheap')) {
            onPriceBandChange?.('budget');
          } else if (qLower.includes('premium') || qLower.includes('high end') || qLower.includes('expensive')) {
            onPriceBandChange?.('premium');
          }

          try {
            const res = await fetch('/api/agent/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: query,
                conversationHistory: messages.slice(-4),
              }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reach AI');

            const aiMsg: Message = {
              id: `ai_${Date.now()}`,
              role: 'assistant',
              content: data.response,
              cart: data.cart || null,
            };

            setMessages((prev) => [...prev, aiMsg]);

            // Speak the LLM response
            voiceEngineRef.current?.speak(data.response);
          } catch (err) {
            console.error('Chat error:', err);
            setMessages((prev) => [
              ...prev,
              {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: '⚠️ Unable to process request. Please try again or switch to Manual Order mode!',
              },
            ]);
          }
        } else {
          // State machine handled it — add bot response
          const aiMsg: Message = {
            id: `ai_${Date.now()}`,
            role: 'assistant',
            content: result.botResponse,
          };
          setMessages((prev) => [...prev, aiMsg]);

          // Apply UI changes
          await applyTransitionResult(result, session);

          // Speak the response
          voiceEngineRef.current?.speak(result.botResponse);
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, onCategoryFilterChange, onPriceBandChange, applyTransitionResult]
  );

  // ── Toggle Voice ────────────────────────────────────────────

  const toggleVoice = () => {
    if (!voiceEngineRef.current) {
      alert('Voice recognition is not supported in this browser. Please use Chrome, Edge, or text input.');
      return;
    }
    voiceEngineRef.current.toggleListening();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVoiceInput(input);
  };

  // ── Save session on close ───────────────────────────────────

  const handleClose = () => {
    // Save voice session log
    const session = voiceSessionRef.current;
    if (session && session.transcript.length > 0) {
      const outcome = session.state === 'order_confirmed' ? 'order_placed' : 'abandoned';
      const log = buildSessionLog(session, outcome, session.cart?.id || null);
      saveVoiceSessionLog(log);
    }
    onClose();
  };

  // Manual Mode: Step 1 - Select Category & Update Page
  const handleManualSelectCategory = (cat: string) => {
    setManualCategory(cat);
    onCategoryFilterChange?.(cat);
    setWizardStep(2);
  };

  // Manual Mode: Step 2 - Select Price Band & Update Page
  const handleManualSelectPriceBand = (band: 'all' | 'budget' | 'mid' | 'premium') => {
    setManualPriceBand(band);
    onPriceBandChange?.(band);
    setWizardStep(3);
  };

  // Manual Mode: Step 3 - Create Order Proposal
  const handleManualCreateOrder = async (product: CatalogProduct) => {
    setManualCreatingCart(true);
    setManualSelectedProduct(product);
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Order ${manualQuantity > 1 ? `${manualQuantity} ` : ''}${product.name}`,
          conversationHistory: [],
        }),
      });
      const data = await res.json();
      if (res.ok && data.cart) {
        setManualProposedCart(data.cart);
      }
    } catch (err) {
      console.error('Manual order error:', err);
    } finally {
      setManualCreatingCart(false);
    }
  };

  // Filtered products for manual step 3
  const manualFilteredProducts = PRODUCTS_CATALOG.filter((p) => {
    if (manualCategory !== 'All Categories' && p.category !== manualCategory) return false;
    if (manualPriceBand === 'budget' && p.displayPrice > 2000) return false;
    if (manualPriceBand === 'mid' && (p.displayPrice < 2000 || p.displayPrice > 8000)) return false;
    if (manualPriceBand === 'premium' && p.displayPrice < 8000) return false;
    return true;
  });

  return (
    <>
      {/* Floating Robot Mascot Anchor & Welcome Speech Bubble */}
      <div className="floating-copilot-anchor" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        {/* Welcome Speech Bubble */}
        {showSpeechBubble && !isOpen && (
          <div
            onClick={onToggle}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1.5px solid var(--accent-cyan)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg), 0 0 20px rgba(6, 182, 212, 0.25)',
              maxWidth: '280px',
              fontSize: '0.85rem',
              lineHeight: 1.4,
              cursor: 'pointer',
              position: 'relative',
              animation: 'modal-enter 0.3s ease',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeechBubble(false);
              }}
              style={{
                position: 'absolute',
                top: '4px',
                right: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              ✕
            </button>
            <strong>👋 Hi {userName}!</strong>
            <div>What would you like to order today? Click me to speak or type!</div>
          </div>
        )}

        {/* 3D Robot Mascot Trigger Button */}
        <button
          onClick={() => {
            setShowSpeechBubble(false);
            onToggle();
          }}
          className="floating-trigger-btn"
          title="Open Robot Shopping Assistant"
          aria-label="Open Robot Shopping Assistant"
          style={{
            padding: '0.4rem 1rem 0.4rem 0.5rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '2px solid var(--accent-cyan)',
            boxShadow: '0 8px 25px rgba(6, 182, 212, 0.4)',
          }}
        >
          {/* Cute 3D Robot Mascot Avatar */}
          <div
            style={{
              width: '42px',
              height: '42px',
              position: 'relative',
              filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.6))',
              animation: 'bounce-subtle 3s infinite ease-in-out',
            }}
          >
            <Image
              src="/robot-avatar.svg"
              alt="PrimeStore Robot Assistant"
              width={42}
              height={42}
              priority
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Order Bot</span>
              <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }} />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
              Voice &amp; AI Order
            </div>
          </div>
        </button>
      </div>

      {/* Floating Expandable Companion Window */}
      {isOpen && (
        <div className="floating-modal-container" style={{ width: '450px', height: '620px' }}>
          {/* Header with Robot Avatar & Mode Tabs */}
          <div className="copilot-modal-header" style={{ padding: '0.75rem 1rem' }}>
            <div className="copilot-header-info">
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1.5px solid var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                }}
              >
                <Image
                  src="/robot-avatar.svg"
                  alt="Robot Assistant"
                  width={34}
                  height={34}
                />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', margin: 0 }}>PrimeStore Voice Companion</h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)' }}>
                  {isSpeaking ? '🔊 Speaking...' : isListening ? '🎙️ Listening...' : `Ready to assist ${userName}`}
                </span>
              </div>
            </div>

            {/* Mode Switcher: 🤖 AI Mode vs 🛠️ Manual Wizard */}
            <div style={{ display: 'flex', background: 'var(--bg-input)', padding: '2px', borderRadius: '9999px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setActiveTab('ai')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activeTab === 'ai' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'ai' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                🎙️ Voice AI
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activeTab === 'manual' ? 'var(--accent-cyan)' : 'transparent',
                  color: activeTab === 'manual' ? '#000000' : 'var(--text-secondary)',
                }}
              >
                🛠️ Manual
              </button>
            </div>

            <button onClick={handleClose} className="btn-close-copilot" aria-label="Close">
              ✕
            </button>
          </div>

          {/* ========================================================
              TAB 1: 🎙️ Voice AI Conversational Assistant
              ======================================================== */}
          {activeTab === 'ai' && (
            <>
              {/* Voice State Indicator */}
              {voiceSessionRef.current && (
                <div style={{
                  padding: '4px 12px',
                  background: 'rgba(6, 182, 212, 0.08)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                }}>
                  <span>State: <strong style={{ color: 'var(--accent-cyan)' }}>{voiceSessionRef.current.state}</strong></span>
                  <span>
                    {voiceSessionRef.current.category && `📦 ${voiceSessionRef.current.category}`}
                    {voiceSessionRef.current.brand && ` • 🏷️ ${voiceSessionRef.current.brand}`}
                  </span>
                </div>
              )}

              {/* Quick Requirement Chips */}
              <div className="copilot-quick-chips">
                <button onClick={() => handleVoiceInput('I want to buy shoes')} className="quick-chip-btn">
                  👟 Shoes
                </button>
                <button onClick={() => handleVoiceInput('Show Sony headphones')} className="quick-chip-btn">
                  🎧 Sony Audio
                </button>
                <button onClick={() => handleVoiceInput('Show smartwatches under ₹5,000')} className="quick-chip-btn">
                  ⌚ Watches &lt; ₹5k
                </button>
                <button onClick={() => handleVoiceInput('Order 1 AuraPods Pro')} className="quick-chip-btn">
                  ⚡ Order Earbuds
                </button>
              </div>

              {/* Chat Messages Log */}
              <div className="copilot-chat-messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`chat-bubble ${
                      m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'
                    }`}
                  >
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>

                    {/* Render Order Proposal with 1-Click Razorpay Modal */}
                    {m.cart && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <CartProposal
                          cart={m.cart}
                          onPaymentSuccess={handlePaymentSuccess}
                          onPaymentFailure={handlePaymentFailure}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="chat-bubble chat-bubble-ai" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    ✨ Robot is checking the store and updating the page...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Voice & Text Input Form */}
              <form onSubmit={handleSubmit} className="copilot-input-bar">
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`mic-voice-btn ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
                  title={
                    isSpeaking
                      ? 'Bot is speaking — tap to interrupt (barge-in)'
                      : isListening
                      ? 'Listening... tap to stop'
                      : 'Tap to speak'
                  }
                  style={isSpeaking ? {
                    background: 'rgba(16, 185, 129, 0.15)',
                    borderColor: '#10b981',
                  } : undefined}
                >
                  {isSpeaking ? '🔊' : isListening ? '🎙️' : '🎤'}
                </button>

                <input
                  type="text"
                  placeholder={
                    isListening
                      ? (interimText || 'Listening to you...')
                      : isSpeaking
                      ? 'Bot is speaking... tap mic to interrupt'
                      : 'Ask for items or say "Order [Item]"'
                  }
                  value={interimText || input}
                  onChange={(e) => setInput(e.target.value)}
                  className="copilot-text-input"
                  style={isListening ? { color: 'var(--accent-cyan)', fontStyle: 'italic' } : undefined}
                />

                <button
                  type="submit"
                  disabled={loading || (!input.trim() && !interimText)}
                  className="copilot-send-btn"
                  aria-label="Send"
                >
                  ➤
                </button>
              </form>
            </>
          )}

          {/* ========================================================
              TAB 2: 🛠️ Manual Guided Shopping & Order Wizard
              ======================================================== */}
          {activeTab === 'manual' && (
            <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Stepper Progress Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: wizardStep === 1 ? 800 : 500, color: wizardStep === 1 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                  1. Category
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: wizardStep === 2 ? 800 : 500, color: wizardStep === 2 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                  2. Budget &amp; Brand
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: wizardStep === 3 ? 800 : 500, color: wizardStep === 3 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                  3. Select &amp; Order
                </div>
              </div>

              {/* STEP 1: Select Category */}
              {wizardStep === 1 && (
                <div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    📦 Step 1: What category would you like to explore?
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                    Selecting a category will automatically navigate and update the storefront behind this window.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => handleManualSelectCategory(cat)}
                        style={{
                          padding: '0.65rem 0.5rem',
                          background: manualCategory === cat ? 'var(--accent-cyan)' : 'var(--bg-input)',
                          color: manualCategory === cat ? '#000000' : 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: Choose Price Band & Brand Filter */}
              {wizardStep === 2 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-primary)' }}>
                      💰 Step 2: Choose your Budget Band
                    </h4>
                    <button
                      onClick={() => setWizardStep(1)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      ← Back
                    </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                    Selected Category: <strong style={{ color: 'var(--accent-cyan)' }}>{manualCategory}</strong>
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {([
                      { band: 'all' as const, label: '⭐ All Price Bands (Full Selection)' },
                      { band: 'budget' as const, label: '🏷️ Budget Pick (Under ₹2,000)' },
                      { band: 'mid' as const, label: '⚡ Mid-Range Best Value (₹2,000 – ₹8,000)' },
                      { band: 'premium' as const, label: '💎 Flagship & Premium (Over ₹8,000)' },
                    ]).map(({ band, label }) => (
                      <button
                        key={band}
                        onClick={() => handleManualSelectPriceBand(band)}
                        style={{
                          padding: '0.75rem',
                          background: manualPriceBand === band ? 'var(--accent-cyan)' : 'var(--bg-input)',
                          color: manualPriceBand === band ? '#000000' : 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: Pick Product & Create Instant Order */}
              {wizardStep === 3 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-primary)' }}>
                      🛒 Step 3: Select Item &amp; Order
                    </h4>
                    <button
                      onClick={() => {
                        setWizardStep(2);
                        setManualProposedCart(null);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      ← Back
                    </button>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Found <strong>{manualFilteredProducts.length}</strong> matching products:
                  </p>

                  {/* Quantity Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Quantity:</span>
                    {[1, 2, 3].map((qty) => (
                      <button
                        key={qty}
                        onClick={() => setManualQuantity(qty)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          background: manualQuantity === qty ? 'var(--accent-primary)' : 'var(--bg-input)',
                          color: manualQuantity === qty ? '#ffffff' : 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>

                  {/* Products List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '230px', overflowY: 'auto' }}>
                    {manualFilteredProducts.map((prod) => (
                      <div
                        key={prod.id}
                        style={{
                          padding: '0.65rem',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                            {prod.brand}
                          </div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {prod.name}
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-gold)', marginTop: '2px' }}>
                            ₹{prod.displayPrice.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <button
                          onClick={() => handleManualCreateOrder(prod)}
                          disabled={manualCreatingCart}
                          style={{
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.45rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {manualCreatingCart && manualSelectedProduct?.id === prod.id ? 'Creating...' : '⚡ Place Order'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Render Manual Proposed Cart */}
                  {manualProposedCart && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981', marginBottom: '0.4rem' }}>
                        ✓ Order proposal created for {manualQuantity}x {manualSelectedProduct?.name}:
                      </div>
                      <CartProposal cart={manualProposedCart} onPaymentSuccess={handlePaymentSuccess} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
