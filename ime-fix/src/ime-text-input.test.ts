/**
 * Comprehensive test suite for IME TextInput component
 * 
 * Tests various scenarios including Japanese, Chinese, Korean input
 * and performance characteristics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IMETextInput } from './ime-text-input';
import { IMEHandler, requiresIME, containsIMECharacters } from './ime-handler';
import { DebouncedCallback, FrameRateLimiter } from './performance-optimizations';

// Mock performance.now for consistent testing
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
  },
});

describe('IMETextInput', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;
  let mockOnSubmit: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockOnChange = vi.fn();
    mockOnSubmit = vi.fn();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  
  describe('Basic functionality', () => {
    it('renders with placeholder text', () => {
      render(<IMETextInput value="" placeholder="Type here..." />);
      expect(screen.getByText(/Type here.../)).toBeInTheDocument();
    });
    
    it('displays input value', () => {
      render(<IMETextInput value="Hello World" />);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
    
    it('shows cursor when focused', () => {
      render(<IMETextInput value="test" focus={true} showCursor={true} />);
      // Cursor should be visible (█ character)
      expect(screen.getByText(/█/)).toBeInTheDocument();
    });
    
    it('applies mask when specified', () => {
      render(<IMETextInput value="password" mask="*" />);
      expect(screen.getByText('********')).toBeInTheDocument();
    });
  });
  
  describe('IME Composition', () => {
    it('shows composition text with visual indicator', () => {
      const { container } = render(
        <IMETextInput 
          value="hello" 
          onChange={mockOnChange}
          focus={true}
        />
      );
      
      // Simulate composition start
      const input = container.querySelector('input');
      if (input) {
        // Mock composition events
        input.dispatchEvent(new CompositionEvent('compositionstart'));
        input.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'kon' }));
        
        vi.runAllTimers();
        
        expect(screen.getByText(/IME: kon/)).toBeInTheDocument();
      }
    });
    
    it('handles Japanese input correctly', async () => {
      render(
        <IMETextInput 
          value="" 
          onChange={mockOnChange}
          focus={true}
        />
      );
      
      // Simulate typing "konnichiwa" -> "こんにちは"
      const compositions = [
        { type: 'compositionstart', data: '' },
        { type: 'compositionupdate', data: 'k' },
        { type: 'compositionupdate', data: 'ko' },
        { type: 'compositionupdate', data: 'kon' },
        { type: 'compositionupdate', data: 'こん' },
        { type: 'compositionupdate', data: 'こんに' },
        { type: 'compositionupdate', data: 'こんにち' },
        { type: 'compositionupdate', data: 'こんにちは' },
        { type: 'compositionend', data: 'こんにちは' },
      ];
      
      // Process each composition event
      compositions.forEach(comp => {
        const event = new CompositionEvent(comp.type as any, { data: comp.data });
        document.dispatchEvent(event);
      });
      
      vi.runAllTimers();
      
      expect(mockOnChange).toHaveBeenCalledWith('こんにちは');
    });
    
    it('prevents submission during composition', () => {
      render(
        <IMETextInput 
          value="test" 
          onSubmit={mockOnSubmit}
          focus={true}
        />
      );
      
      // Start composition
      document.dispatchEvent(new CompositionEvent('compositionstart'));
      
      // Try to submit (should be prevented)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(mockOnSubmit).not.toHaveBeenCalled();
      
      // End composition
      document.dispatchEvent(new CompositionEvent('compositionend', { data: 'テスト' }));
      
      // Now submission should work
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(mockOnSubmit).toHaveBeenCalledWith('test');
    });
  });
  
  describe('Performance', () => {
    it('debounces onChange calls', () => {
      render(
        <IMETextInput 
          value="" 
          onChange={mockOnChange}
        />
      );
      
      // Simulate rapid input changes
      for (let i = 0; i < 10; i++) {
        document.dispatchEvent(new InputEvent('input', { data: `test${i}` }));
      }
      
      // Before timer runs, onChange should not be called
      expect(mockOnChange).not.toHaveBeenCalled();
      
      // After timer runs, onChange should be called only once
      vi.runAllTimers();
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
    
    it('maintains 60fps target during rapid input', () => {
      const startTime = performance.now();
      const limiter = new FrameRateLimiter(60);
      
      let renderCount = 0;
      const mockRender = () => { renderCount++; };
      
      // Simulate 1 second of rapid input at 120 attempts per second
      for (let i = 0; i < 120; i++) {
        vi.advanceTimersByTime(1000 / 120); // ~8.33ms intervals
        limiter.scheduleRender(mockRender);
      }
      
      vi.runAllTimers();
      
      // Should have limited to ~60 renders (allowing some variance)
      expect(renderCount).toBeLessThanOrEqual(70);
      expect(renderCount).toBeGreaterThanOrEqual(50);
    });
  });
});

describe('IMEHandler', () => {
  let handler: IMEHandler;
  let mockCallbacks: {
    onCompositionStart: ReturnType<typeof vi.fn>;
    onCompositionUpdate: ReturnType<typeof vi.fn>;
    onCompositionEnd: ReturnType<typeof vi.fn>;
    onInput: ReturnType<typeof vi.fn>;
  };
  
  beforeEach(() => {
    mockCallbacks = {
      onCompositionStart: vi.fn(),
      onCompositionUpdate: vi.fn(),
      onCompositionEnd: vi.fn(),
      onInput: vi.fn(),
    };
    
    handler = new IMEHandler(mockCallbacks);
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });
  
  it('handles composition lifecycle correctly', () => {
    // Start composition
    handler.handleEvent({ type: 'compositionstart', data: '' });
    expect(mockCallbacks.onCompositionStart).toHaveBeenCalled();
    expect(handler.isIMEComposing()).toBe(true);
    
    // Update composition
    handler.handleEvent({ type: 'compositionupdate', data: 'test' });
    vi.runAllTimers();
    expect(mockCallbacks.onCompositionUpdate).toHaveBeenCalledWith('test');
    expect(handler.getCompositionData()).toBe('test');
    
    // End composition
    handler.handleEvent({ type: 'compositionend', data: 'テスト' });
    expect(mockCallbacks.onCompositionEnd).toHaveBeenCalledWith('テスト');
    expect(handler.isIMEComposing()).toBe(false);
  });
  
  it('ignores input events during composition', () => {
    // Start composition
    handler.handleEvent({ type: 'compositionstart', data: '' });
    
    // Input during composition should be ignored
    handler.handleEvent({ type: 'input', data: 'test', isComposing: true });
    vi.runAllTimers();
    
    expect(mockCallbacks.onInput).not.toHaveBeenCalled();
    
    // End composition
    handler.handleEvent({ type: 'compositionend', data: 'テスト' });
    
    // Now input should work
    handler.handleEvent({ type: 'input', data: 'test', isComposing: false });
    vi.runAllTimers();
    
    expect(mockCallbacks.onInput).toHaveBeenCalledWith('test');
  });
});

describe('IME Utilities', () => {
  describe('requiresIME', () => {
    it('detects Japanese characters', () => {
      expect(requiresIME('あ')).toBe(true); // Hiragana
      expect(requiresIME('ア')).toBe(true); // Katakana
      expect(requiresIME('漢')).toBe(true); // Kanji
      expect(requiresIME('a')).toBe(false); // ASCII
    });
    
    it('detects Chinese characters', () => {
      expect(requiresIME('中')).toBe(true);
      expect(requiresIME('文')).toBe(true);
      expect(requiresIME('字')).toBe(true);
    });
    
    it('detects Korean characters', () => {
      expect(requiresIME('한')).toBe(true);
      expect(requiresIME('글')).toBe(true);
      expect(requiresIME('입')).toBe(true);
    });
    
    it('handles edge cases', () => {
      expect(requiresIME('')).toBe(false);
      expect(requiresIME(' ')).toBe(false);
      expect(requiresIME('123')).toBe(false);
      expect(requiresIME('!@#')).toBe(false);
    });
  });
  
  describe('containsIMECharacters', () => {
    it('detects IME characters in mixed text', () => {
      expect(containsIMECharacters('Hello こんにちは World')).toBe(true);
      expect(containsIMECharacters('你好 World')).toBe(true);
      expect(containsIMECharacters('안녕하세요 Hello')).toBe(true);
      expect(containsIMECharacters('Hello World')).toBe(false);
    });
    
    it('handles empty and edge cases', () => {
      expect(containsIMECharacters('')).toBe(false);
      expect(containsIMECharacters('123 ABC !@#')).toBe(false);
    });
  });
});

describe('Performance Optimizations', () => {
  describe('DebouncedCallback', () => {
    let callback: ReturnType<typeof vi.fn>;
    let debouncedCallback: DebouncedCallback;
    
    beforeEach(() => {
      callback = vi.fn();
      debouncedCallback = new DebouncedCallback(callback, 100);
      vi.useFakeTimers();
    });
    
    afterEach(() => {
      debouncedCallback.cancel();
      vi.useRealTimers();
    });
    
    it('debounces multiple rapid calls', () => {
      // Make multiple rapid calls
      debouncedCallback.call('arg1');
      debouncedCallback.call('arg2');
      debouncedCallback.call('arg3');
      
      // Callback should not be called yet
      expect(callback).not.toHaveBeenCalled();
      
      // Advance time and check that only the last call is executed
      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('arg3');
    });
    
    it('respects maxWait parameter', () => {
      const debouncedWithMaxWait = new DebouncedCallback(callback, 100, 200);
      
      // Make calls every 50ms (within debounce window)
      for (let i = 0; i < 5; i++) {
        debouncedWithMaxWait.call(`arg${i}`);
        vi.advanceTimersByTime(50);
      }
      
      // Should have been called due to maxWait
      expect(callback).toHaveBeenCalled();
      
      debouncedWithMaxWait.cancel();
    });
  });
  
  describe('FrameRateLimiter', () => {
    let limiter: FrameRateLimiter;
    
    beforeEach(() => {
      limiter = new FrameRateLimiter(30); // 30 FPS for easier testing
      vi.useFakeTimers();
    });
    
    afterEach(() => {
      vi.useRealTimers();
    });
    
    it('limits render rate correctly', () => {
      const frameInterval = 1000 / 30; // ~33.33ms
      
      // First call should render
      expect(limiter.shouldRender()).toBe(true);
      
      // Immediate second call should be blocked
      expect(limiter.shouldRender()).toBe(false);
      
      // After frame interval, should render again
      vi.advanceTimersByTime(frameInterval);
      expect(limiter.shouldRender()).toBe(true);
    });
    
    it('schedules renders correctly', () => {
      const mockRender = vi.fn();
      
      // Schedule multiple renders rapidly
      limiter.scheduleRender(mockRender);
      limiter.scheduleRender(mockRender);
      limiter.scheduleRender(mockRender);
      
      // Should only render once immediately
      expect(mockRender).toHaveBeenCalledTimes(1);
      
      // No additional renders should be scheduled
      vi.runAllTimers();
      expect(mockRender).toHaveBeenCalledTimes(1);
    });
  });
});

// Integration tests
describe('Integration Tests', () => {
  it('handles complete Japanese input scenario', async () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <IMETextInput 
        value="" 
        onChange={mockOnChange}
        placeholder="日本語を入力してください"
        focus={true}
      />
    );
    
    // Simulate complete Japanese input: "arigatou" -> "ありがとう"
    const sequence = [
      { type: 'compositionstart', data: '' },
      { type: 'compositionupdate', data: 'a' },
      { type: 'compositionupdate', data: 'ar' },
      { type: 'compositionupdate', data: 'ari' },
      { type: 'compositionupdate', data: 'arig' },
      { type: 'compositionupdate', data: 'ariga' },
      { type: 'compositionupdate', data: 'arigatou' },
      { type: 'compositionupdate', data: 'ありがとう' },
      { type: 'compositionend', data: 'ありがとう' },
    ];
    
    sequence.forEach(event => {
      const compEvent = new CompositionEvent(event.type as any, { data: event.data });
      document.dispatchEvent(compEvent);
    });
    
    vi.runAllTimers();
    
    expect(mockOnChange).toHaveBeenCalledWith('ありがとう');
  });
  
  it('maintains performance with rapid CJK input', () => {
    const startTime = Date.now();
    const mockOnChange = vi.fn();
    
    render(
      <IMETextInput 
        value="" 
        onChange={mockOnChange}
      />
    );
    
    // Simulate 100 rapid composition updates
    document.dispatchEvent(new CompositionEvent('compositionstart'));
    
    for (let i = 0; i < 100; i++) {
      document.dispatchEvent(new CompositionEvent('compositionupdate', { 
        data: `テスト${i}`
      }));
      vi.advanceTimersByTime(1); // 1ms between updates
    }
    
    document.dispatchEvent(new CompositionEvent('compositionend', { 
      data: 'テスト最終'
    }));
    
    vi.runAllTimers();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (< 100ms)
    expect(duration).toBeLessThan(100);
    expect(mockOnChange).toHaveBeenCalledWith('テスト最終');
  });
});