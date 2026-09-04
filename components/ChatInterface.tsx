'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import CartProposal from './CartProposal';
import { Cart } from '@/lib/schemas';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  cart?: Cart;
}

interface ChatInterfaceProps {
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
  onClose?: () => void;
}

// Speech recognition type interface for browser Web Speech API
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

interface ISpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
}

export default function ChatInterface({
  externalPrompt,
  onClearExternalPrompt,
  onClose,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Welcome! I am your AI Shopping Copilot.\n\nYou can ask me for product recommendations or directly command me to order items like:\n• "Order 2 Wireless Earbuds Pro"\n• "I want to buy the RGB Mechanical Keyboard"\n• "Find the best portable SSD and build a cart"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: string; parts: Array<{ text: string }> }>
  >([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognitionInstance | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Core send message logic
  const handleSendMessage = useCallback(
    async (textToSend: string) => {
      if (!textToSend.trim() || loading) return;

      const userMessage = textToSend.trim();
      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      setLoading(true);

      try {
        const savedUser = typeof window !== 'undefined' ? localStorage.getItem('primestore_user') : null;
        let userId: string | undefined = undefined;
        if (savedUser) {
          try {
            userId = JSON.parse(savedUser).id;
          } catch {}
        }

        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            userId: userId,
            conversationHistory,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error('[UI Chat] Error response:', data);
          throw new Error(data.error || 'Failed to get response');
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response,
            cart: data.cart || undefined,
          },
        ]);

        if (data.history) {
          setConversationHistory(data.history);
        }
      } catch (error) {
        console.error('[UI Chat] Request failed:', error);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [conversationHistory, loading]
  );

  // Handle external prompts triggered from product cards or hero banner
  useEffect(() => {
    if (externalPrompt) {
      handleSendMessage(externalPrompt);
      onClearExternalPrompt?.();
    }
  }, [externalPrompt, handleSendMessage, onClearExternalPrompt]);

  // Web Speech API Voice Command toggle
  const toggleVoiceRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = typeof window !== 'undefined' ? (window as unknown as IWindowWithSpeech) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Voice recognition is not supported in this browser. Please type your command.');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognitionClass as any)() as ISpeechRecognitionInstance;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0]?.transcript;
        if (transcript) {
          setInput(transcript);
          handleSendMessage(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setIsListening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  const quickPrompts = [
    'Order 2 Wireless Earbuds Pro',
    'Buy Mechanical Keyboard RGB',
    'I want 1TB Portable SSD',
    'Show me gaming accessories',
  ];

  return (
    <aside className="ai-chat-dock">
      {/* Bot Header */}
      <div className="chat-dock-header">
        <div className="bot-status-wrap">
          <div className="bot-avatar-glow">🤖</div>
          <div className="bot-title-meta">
            <div className="bot-name">
              PrimeStore AI Copilot
              <span className="live-badge">Online</span>
            </div>
            <p className="bot-desc">Voice & Text Ordering Assistant</p>
          </div>
        </div>

        <div className="header-dock-actions">
          {onClose && (
            <button onClick={onClose} className="dock-close-btn" title="Close AI Assistant">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Quick Prompts Strip */}
      <div className="chat-quick-strip">
        <span className="quick-label">Quick:</span>
        <div className="quick-scroll-wrap">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSendMessage(prompt)}
              className="quick-chip-btn"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="chat-messages-body">
        {messages.map((msg, i) => (
          <div key={i} className={`copilot-msg ${msg.role}`}>
            <div className="msg-avatar-icon">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="msg-bubble-wrap">
              <div className="msg-text" style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
              {msg.cart && (
                <div className="msg-embedded-cart">
                  <CartProposal cart={msg.cart} />
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="copilot-msg assistant">
            <div className="msg-avatar-icon">🤖</div>
            <div className="msg-bubble-wrap">
              <div className="msg-text thinking-loader">
                <span className="dot-pulse"></span>
                <span>Copilot is searching & assembling your request...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area with Voice Support */}
      <div className="chat-dock-input-area">
        {isListening && (
          <div className="listening-indicator-bar">
            <span className="mic-wave">🎙️</span> Listening to your voice command... Speak now!
          </div>
        )}

        <div className="input-row">
          <button
            type="button"
            onClick={toggleVoiceRecognition}
            className={`voice-mic-btn ${isListening ? 'listening' : ''}`}
            title={isListening ? 'Stop listening' : 'Speak command with voice'}
          >
            {isListening ? '🔴' : '🎙️'}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening...' : 'Tell AI: "Order 2 earbuds" or ask...'}
            disabled={loading}
            className="dock-text-input"
          />

          <button
            onClick={() => handleSendMessage(input)}
            disabled={loading || !input.trim()}
            className="dock-send-btn"
            title="Send command"
          >
            {loading ? '⏳' : '➤'}
          </button>
        </div>

        <div className="dock-footer-note">
          <span>🔒 Human Gated</span> • <span>₹10k Max Limit</span> • <span>Razorpay Test Sandbox</span>
        </div>
      </div>
    </aside>
  );
}
