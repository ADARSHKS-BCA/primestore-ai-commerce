'use client';

/**
 * VoiceEngine — Client-side STT/TTS engine with barge-in, push-to-talk,
 * interim results, and permission fallback.
 *
 * This module is the ONLY place that touches Web Speech APIs.
 * All voice I/O flows through here — FloatingAssistant consumes events.
 *
 * Interaction model: tap-to-start / tap-to-stop (toggle).
 * The mic is NEVER continuously listening between turns.
 */

// ─── Types ────────────────────────────────────────────────────────

export interface VoiceEngineEvents {
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onFallbackToText: (reason: string) => void;
  onError: (error: string) => void;
}

interface IWindow extends Window {
  webkitSpeechRecognition?: new () => SpeechRecognition;
  SpeechRecognition?: new () => SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string; confidence: number };
}

// ─── Engine ───────────────────────────────────────────────────────

export class VoiceEngine {
  private recognition: SpeechRecognition | null = null;
  private events: VoiceEngineEvents;
  private _isListening = false;
  private _isSpeaking = false;
  private noSpeechCount = 0;
  private supported = false;
  private ttsVoice: SpeechSynthesisVoice | null = null;

  constructor(events: VoiceEngineEvents) {
    this.events = events;
    this.initSTT();
    this.initTTSVoice();
  }

  // ── STT Setup ─────────────────────────────────────────────────

  private initSTT() {
    if (typeof window === 'undefined') return;

    const w = window as unknown as IWindow;
    const SpeechRecognitionClass = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.supported = false;
      return;
    }

    this.supported = true;
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;          // Single utterance per activation
    recognition.interimResults = true;       // Stream partial results for low latency
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      this._isListening = true;
      this.events.onListeningChange(true);
    };

    recognition.onend = () => {
      this._isListening = false;
      this.events.onListeningChange(false);
    };

    recognition.onerror = (event: { error: string }) => {
      console.warn('[VoiceEngine] STT event:', event.error);

      if (event.error === 'network') {
        this._isListening = false;
        this.events.onListeningChange(false);
        this.events.onFallbackToText('Voice recognition network is currently offline or unreachable. Switched to text typing.');
        return;
      }

      if (event.error === 'aborted') {
        this._isListening = false;
        this.events.onListeningChange(false);
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this._isListening = false;
        this.events.onListeningChange(false);
        this.events.onFallbackToText('Microphone permission denied. Switching to text mode.');
        return;
      }

      if (event.error === 'no-speech') {
        this.noSpeechCount++;
        if (this.noSpeechCount >= 3) {
          this.events.onFallbackToText('No speech detected. You can type or click below.');
          this.noSpeechCount = 0;
        }
        return;
      }

      if (event.error === 'audio-capture') {
        this._isListening = false;
        this.events.onListeningChange(false);
        this.events.onFallbackToText('Microphone unavailable. Switching to text mode.');
        return;
      }

      this.events.onError(`Voice event: ${event.error}`);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.noSpeechCount = 0; // Reset counter on any result
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (interimText) {
        this.events.onInterimTranscript(interimText);
      }

      if (finalText.trim()) {
        this.events.onFinalTranscript(finalText.trim());
      }
    };

    this.recognition = recognition;
  }

  // ── TTS Voice Selection ───────────────────────────────────────

  private initTTSVoice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer Indian English, then any English female voice, then default
      this.ttsVoice =
        voices.find((v) => v.lang === 'en-IN' && v.name.toLowerCase().includes('female')) ||
        voices.find((v) => v.lang === 'en-IN') ||
        voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        null;
    };

    pickVoice();
    // Voices may load asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  // ── Public API ────────────────────────────────────────────────

  get isSupported(): boolean {
    return this.supported;
  }

  get isListening(): boolean {
    return this._isListening;
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /**
   * Start listening (tap-to-start). If bot is speaking, barge-in:
   * cancel TTS first, then start STT.
   */
  startListening(): void {
    if (!this.recognition) {
      this.events.onFallbackToText('Voice recognition not supported in this browser. Using text mode.');
      return;
    }

    // Barge-in: cancel any ongoing TTS
    if (this._isSpeaking) {
      this.cancelSpeech();
    }

    if (this._isListening) return; // Already listening

    try {
      this.recognition.start();
    } catch (err) {
      console.warn('[VoiceEngine] Failed to start recognition:', err);
      // Might already be running; abort and retry
      try {
        this.recognition.abort();
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch {
            this.events.onError('Could not start voice recognition.');
          }
        }, 100);
      } catch {
        this.events.onError('Could not start voice recognition.');
      }
    }
  }

  /**
   * Stop listening (tap-to-stop).
   */
  stopListening(): void {
    if (!this.recognition || !this._isListening) return;
    try {
      this.recognition.stop();
    } catch {
      // Already stopped
    }
  }

  /**
   * Toggle listening state (primary UI action).
   */
  toggleListening(): void {
    if (this._isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  /**
   * Speak text aloud via TTS. Returns a promise that resolves when
   * speech finishes (or is cancelled via barge-in).
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }

      // Strip markdown formatting for cleaner TTS
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1')   // Bold
        .replace(/\*(.*?)\*/g, '$1')       // Italic
        .replace(/[•●▪]/g, ', ')           // Bullets
        .replace(/#{1,6}\s/g, '')          // Headings
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
        .replace(/[_~`]/g, '')             // Other markdown
        .replace(/\n+/g, '. ')             // Newlines to pauses
        .replace(/₹/g, 'rupees ')          // Currency symbol
        .replace(/\s+/g, ' ')             // Collapse whitespace
        .trim();

      if (!cleanText) {
        resolve();
        return;
      }

      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;   // Slightly faster than default for snappier feel
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (this.ttsVoice) {
        utterance.voice = this.ttsVoice;
      }

      utterance.onstart = () => {
        this._isSpeaking = true;
        this.events.onSpeakingChange(true);
      };

      utterance.onend = () => {
        this._isSpeaking = false;
        this.events.onSpeakingChange(false);
        resolve();
      };

      utterance.onerror = (event) => {
        // 'interrupted' is expected during barge-in, not a real error
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          console.warn('[VoiceEngine] TTS error:', event.error);
        }
        this._isSpeaking = false;
        this.events.onSpeakingChange(false);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Cancel ongoing TTS immediately (used for barge-in).
   */
  cancelSpeech(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    this._isSpeaking = false;
    this.events.onSpeakingChange(false);
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.stopListening();
    this.cancelSpeech();
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition.onresult = null;
    }
  }
}
