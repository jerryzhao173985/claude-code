/**
 * IME (Input Method Editor) event handling utilities
 * 
 * This module provides utilities for handling IME composition events
 * which are essential for proper Japanese, Chinese, Korean input support.
 */

export interface IMEEvent {
  type: 'compositionstart' | 'compositionupdate' | 'compositionend' | 'input';
  data: string;
  inputType?: string;
  isComposing?: boolean;
}

export interface IMEHandlerOptions {
  debounceMs?: number;
  onCompositionStart?: () => void;
  onCompositionUpdate?: (data: string) => void;
  onCompositionEnd?: (data: string) => void;
  onInput?: (value: string) => void;
}

export class IMEHandler {
  private isComposing = false;
  private compositionData = '';
  private debounceTimer?: NodeJS.Timeout;
  private options: IMEHandlerOptions;
  
  constructor(options: IMEHandlerOptions = {}) {
    this.options = {
      debounceMs: 16, // ~60fps
      ...options,
    };
  }
  
  /**
   * Process an IME event and call appropriate handlers
   */
  handleEvent(event: IMEEvent): void {
    switch (event.type) {
      case 'compositionstart':
        this.handleCompositionStart();
        break;
        
      case 'compositionupdate':
        this.handleCompositionUpdate(event.data);
        break;
        
      case 'compositionend':
        this.handleCompositionEnd(event.data);
        break;
        
      case 'input':
        this.handleInput(event.data, event.isComposing || false);
        break;
    }
  }
  
  private handleCompositionStart(): void {
    this.isComposing = true;
    this.compositionData = '';
    this.options.onCompositionStart?.();
  }
  
  private handleCompositionUpdate(data: string): void {
    if (!this.isComposing) return;
    
    this.compositionData = data;
    this.debouncedCall(() => {
      this.options.onCompositionUpdate?.(data);
    });
  }
  
  private handleCompositionEnd(data: string): void {
    this.isComposing = false;
    this.compositionData = '';
    
    // Clear any pending debounced calls
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    
    this.options.onCompositionEnd?.(data);
  }
  
  private handleInput(value: string, isComposing: boolean): void {
    // During IME composition, input events should be ignored
    // as they will be handled by composition events
    if (isComposing || this.isComposing) {
      return;
    }
    
    this.debouncedCall(() => {
      this.options.onInput?.(value);
    });
  }
  
  private debouncedCall(callback: () => void): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(callback, this.options.debounceMs);
  }
  
  /**
   * Check if IME is currently composing
   */
  isIMEComposing(): boolean {
    return this.isComposing;
  }
  
  /**
   * Get current composition data
   */
  getCompositionData(): string {
    return this.compositionData;
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this.isComposing = false;
    this.compositionData = '';
  }
}

/**
 * Utility function to detect if a character requires IME input
 * Useful for performance optimizations
 */
export function requiresIME(char: string): boolean {
  if (!char) return false;
  
  const code = char.charCodeAt(0);
  
  // Japanese Hiragana and Katakana
  if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) {
    return true;
  }
  
  // CJK Unified Ideographs (Chinese/Japanese Kanji)
  if (code >= 0x4E00 && code <= 0x9FAF) {
    return true;
  }
  
  // Korean Hangul
  if (code >= 0xAC00 && code <= 0xD7AF) {
    return true;
  }
  
  // Additional CJK ranges
  if ((code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
      (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
      (code >= 0x2A700 && code <= 0x2B73F) || // CJK Extension C
      (code >= 0x2B740 && code <= 0x2B81F) || // CJK Extension D
      (code >= 0x2B820 && code <= 0x2CEAF)) { // CJK Extension E
    return true;
  }
  
  return false;
}

/**
 * Utility function to detect if text contains IME characters
 */
export function containsIMECharacters(text: string): boolean {
  return Array.from(text).some(requiresIME);
}

/**
 * Performance metrics for IME input
 */
export interface IMEPerformanceMetrics {
  compositionStartTime: number;
  compositionEndTime: number;
  compositionDuration: number;
  inputLatency: number;
  rerenderCount: number;
}

export class IMEPerformanceMonitor {
  private metrics: Partial<IMEPerformanceMetrics> = {};
  private rerenderCount = 0;
  
  startComposition(): void {
    this.metrics.compositionStartTime = performance.now();
    this.rerenderCount = 0;
  }
  
  endComposition(): void {
    const endTime = performance.now();
    this.metrics.compositionEndTime = endTime;
    
    if (this.metrics.compositionStartTime) {
      this.metrics.compositionDuration = endTime - this.metrics.compositionStartTime;
    }
    
    this.metrics.rerenderCount = this.rerenderCount;
  }
  
  recordRerender(): void {
    this.rerenderCount++;
  }
  
  recordInputLatency(startTime: number): void {
    this.metrics.inputLatency = performance.now() - startTime;
  }
  
  getMetrics(): IMEPerformanceMetrics {
    return this.metrics as IMEPerformanceMetrics;
  }
  
  reset(): void {
    this.metrics = {};
    this.rerenderCount = 0;
  }
}