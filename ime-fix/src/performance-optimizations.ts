/**
 * Performance optimizations for IME input handling
 * 
 * This module provides various optimizations to ensure smooth IME input
 * even with complex composition sequences.
 */

export interface PerformanceConfig {
  debounceMs: number;
  maxRerenderRate: number;
  enableVirtualization: boolean;
  batchUpdates: boolean;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  debounceMs: 16, // ~60fps
  maxRerenderRate: 60, // Max 60 FPS
  enableVirtualization: true,
  batchUpdates: true,
};

/**
 * Debounced function wrapper for high-frequency IME events
 */
export class DebouncedCallback {
  private timer?: NodeJS.Timeout;
  private lastCall = 0;
  private readonly callback: (...args: any[]) => void;
  private readonly delay: number;
  private readonly maxWait?: number;
  
  constructor(callback: (...args: any[]) => void, delay: number, maxWait?: number) {
    this.callback = callback;
    this.delay = delay;
    this.maxWait = maxWait;
  }
  
  call(...args: any[]): void {
    const now = Date.now();
    
    if (this.timer) {
      clearTimeout(this.timer);
    }
    
    // Force execution if max wait time exceeded
    if (this.maxWait && (now - this.lastCall) >= this.maxWait) {
      this.execute(args);
      return;
    }
    
    this.timer = setTimeout(() => {
      this.execute(args);
    }, this.delay);
  }
  
  private execute(args: any[]): void {
    this.lastCall = Date.now();
    this.callback(...args);
  }
  
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
  
  cancel(): void {
    this.flush();
  }
}

/**
 * Frame rate limiter to prevent excessive re-renders during IME input
 */
export class FrameRateLimiter {
  private lastFrame = 0;
  private readonly targetFPS: number;
  private readonly frameInterval: number;
  
  constructor(targetFPS: number = 60) {
    this.targetFPS = targetFPS;
    this.frameInterval = 1000 / targetFPS;
  }
  
  shouldRender(): boolean {
    const now = performance.now();
    if (now - this.lastFrame >= this.frameInterval) {
      this.lastFrame = now;
      return true;
    }
    return false;
  }
  
  scheduleRender(callback: () => void): void {
    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrame;
    
    if (timeSinceLastFrame >= this.frameInterval) {
      this.lastFrame = now;
      callback();
    } else {
      const delay = this.frameInterval - timeSinceLastFrame;
      setTimeout(() => {
        this.lastFrame = performance.now();
        callback();
      }, delay);
    }
  }
}

/**
 * Batch updater for multiple state changes
 */
export class BatchUpdater {
  private pendingUpdates: Map<string, any> = new Map();
  private updateTimer?: NodeJS.Timeout;
  private readonly batchDelay: number;
  private readonly onFlush: (updates: Map<string, any>) => void;
  
  constructor(onFlush: (updates: Map<string, any>) => void, batchDelay: number = 16) {
    this.onFlush = onFlush;
    this.batchDelay = batchDelay;
  }
  
  schedule(key: string, value: any): void {
    this.pendingUpdates.set(key, value);
    
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    this.updateTimer = setTimeout(() => {
      this.flush();
    }, this.batchDelay);
  }
  
  flush(): void {
    if (this.pendingUpdates.size > 0) {
      const updates = new Map(this.pendingUpdates);
      this.pendingUpdates.clear();
      this.onFlush(updates);
    }
    
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }
  }
  
  cancel(): void {
    this.pendingUpdates.clear();
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }
  }
}

/**
 * Memory pool for reducing garbage collection during rapid IME input
 */
export class StringPool {
  private pool: string[] = [];
  private readonly maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }
  
  get(value: string): string {
    const index = this.pool.indexOf(value);
    if (index !== -1) {
      // Move to front (LRU)
      const str = this.pool.splice(index, 1)[0];
      this.pool.unshift(str);
      return str;
    }
    
    // Add new string
    this.pool.unshift(value);
    if (this.pool.length > this.maxSize) {
      this.pool.pop();
    }
    
    return value;
  }
  
  clear(): void {
    this.pool = [];
  }
  
  size(): number {
    return this.pool.length;
  }
}

/**
 * Performance monitor for IME operations
 */
export class IMEPerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();
  private activeTimers: Map<string, number> = new Map();
  
  start(label: string): void {
    this.activeTimers.set(label, performance.now());
  }
  
  end(label: string): number {
    const startTime = this.activeTimers.get(label);
    if (!startTime) {
      console.warn(`No active timer found for label: ${label}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.activeTimers.delete(label);
    
    // Store measurement
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);
    
    return duration;
  }
  
  getStats(label: string): { avg: number; min: number; max: number; count: number } | null {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) {
      return null;
    }
    
    const sum = measurements.reduce((a, b) => a + b, 0);
    return {
      avg: sum / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      count: measurements.length,
    };
  }
  
  getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
    const stats: Record<string, ReturnType<typeof this.getStats>> = {};
    for (const label of this.measurements.keys()) {
      stats[label] = this.getStats(label);
    }
    return stats;
  }
  
  clear(): void {
    this.measurements.clear();
    this.activeTimers.clear();
  }
  
  report(): void {
    const stats = this.getAllStats();
    console.group('IME Performance Report');
    for (const [label, stat] of Object.entries(stats)) {
      if (stat) {
        console.log(`${label}: avg=${stat.avg.toFixed(2)}ms, min=${stat.min.toFixed(2)}ms, max=${stat.max.toFixed(2)}ms, count=${stat.count}`);
      }
    }
    console.groupEnd();
  }
}

/**
 * Utility to optimize React re-renders during IME input
 */
export function createIMEOptimizedState<T>(initialValue: T) {
  let currentValue = initialValue;
  let listeners: ((value: T) => void)[] = [];
  const rateLimiter = new FrameRateLimiter(60);
  
  return {
    get: () => currentValue,
    set: (newValue: T) => {
      if (currentValue !== newValue) {
        currentValue = newValue;
        
        // Throttle notifications to prevent excessive re-renders
        rateLimiter.scheduleRender(() => {
          listeners.forEach(listener => listener(currentValue));
        });
      }
    },
    subscribe: (listener: (value: T) => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(l => l !== listener);
      };
    },
  };
}

/**
 * Hook for using IME-optimized state in React components
 */
export function useIMEOptimizedState<T>(initialValue: T): [T, (value: T) => void] {
  const [state, setState] = React.useState(initialValue);
  const optimizedState = React.useMemo(() => createIMEOptimizedState(initialValue), [initialValue]);
  
  React.useEffect(() => {
    return optimizedState.subscribe(setState);
  }, [optimizedState]);
  
  const setValue = React.useCallback((newValue: T) => {
    optimizedState.set(newValue);
  }, [optimizedState]);
  
  return [state, setValue];
}