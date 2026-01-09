export interface CircuitBreakerOptions {
  failureThreshold?: number; // failures to open
  cooldownMs?: number; // time in open before half-open
  halfOpenMaxAttempts?: number; // trial attempts in half-open
}

type State = "closed" | "open" | "half-open";

export interface CircuitBreakerMetrics {
  state: State;
  failureCount: number;
  failureThreshold: number;
  cooldownMs: number;
  halfOpenMaxAttempts: number;
  openedAt?: number;
  lastFailureAt?: number;
  halfOpenTrialCount?: number;
}

/**
 * Configurable circuit breaker implementation following the classic three-state model.
 * Prevents cascading failures by opening the circuit after a threshold of consecutive failures.
 * 
 * **Concurrency**: Safe for Node.js async operations. Trial counter is incremented atomically
 * in `canProceed()` to prevent concurrent requests from exceeding `halfOpenMaxAttempts`.
 * 
 * States:
 * - **closed**: Normal operation, requests proceed
 * - **open**: Circuit is broken, requests are blocked for cooldown period
 * - **half-open**: Testing if service recovered, limited trial requests allowed
 * 
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({ 
 *   failureThreshold: 5,
 *   cooldownMs: 30000,
 *   halfOpenMaxAttempts: 2
 * });
 * 
 * // Before each request, check if we can proceed
 * if (breaker.canProceed()) {
 *   try {
 *     const result = await riskyOperation();
 *     breaker.onSuccess(); // Mark success to reset failure count
 *     return result;
 *   } catch (error) {
 *     breaker.onFailure(); // Increment failure count
 *     throw error;
 *   }
 * } else {
 *   throw new Error("Circuit breaker is open");
 * }
 * 
 * // Monitor circuit state
 * const metrics = breaker.getMetrics();
 * console.log(`Circuit state: ${metrics.state}`);
 * ```
 */
export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private openedAt = 0;
  private trials = 0;
  private lastFailureAt = 0;
  private readonly opts: Required<CircuitBreakerOptions>;

  constructor(options?: CircuitBreakerOptions) {
    const failureThreshold = options?.failureThreshold ?? 5;
    const cooldownMs = options?.cooldownMs ?? 30000;
    const halfOpenMaxAttempts = options?.halfOpenMaxAttempts ?? 2;

    // Validate parameters
    if (failureThreshold < 1) {
      throw new Error(`failureThreshold must be >= 1, got ${failureThreshold}`);
    }
    if (cooldownMs < 0) {
      throw new Error(`cooldownMs must be non-negative, got ${cooldownMs}`);
    }
    if (halfOpenMaxAttempts < 1) {
      throw new Error(`halfOpenMaxAttempts must be >= 1, got ${halfOpenMaxAttempts}`);
    }

    this.opts = { failureThreshold, cooldownMs, halfOpenMaxAttempts };
  }

  public canProceed(now = Date.now()): boolean {
    switch (this.state) {
      case "closed":
        return true;
      case "open":
        return this.handleOpenState(now);
      case "half-open":
        return this.handleHalfOpenState();
    }
  }

  private handleOpenState(now: number): boolean {
    if (now - this.openedAt >= this.opts.cooldownMs) {
      this.transitionToHalfOpen();
      return this.handleHalfOpenState(); // Allow trial and increment counter
    }
    return false;
  }

  private handleHalfOpenState(): boolean {
    if (this.trials < this.opts.halfOpenMaxAttempts) {
      this.trials++; // Increment immediately to prevent concurrent requests
      return true;
    }
    return false;
  }

  private transitionToHalfOpen(): void {
    this.state = "half-open";
    this.trials = 0;
  }

  public onSuccess(): void {
    if (this.state === "half-open") {
      // success in half-open: close the circuit
      this.state = "closed";
      this.failures = 0;
      this.trials = 0;
    } else if (this.state === "closed") {
      this.failures = 0;
    }
  }

  public onFailure(now = Date.now()): void {
    if (this.state === "half-open") {
      // Note: trials already incremented in canProceed()
      // revert to open immediately on failure in half-open
      this.state = "open";
      this.openedAt = now;
      this.lastFailureAt = now;
      return;
    }
    this.failures++;
    this.lastFailureAt = now;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = "open";
      this.openedAt = now;
    }
  }

  /** Snapshot style metrics for telemetry dashboards */
  public getMetrics(): CircuitBreakerMetrics {
    const base: CircuitBreakerMetrics = {
      state: this.state,
      failureCount: this.failures,
      failureThreshold: this.opts.failureThreshold,
      cooldownMs: this.opts.cooldownMs,
      halfOpenMaxAttempts: this.opts.halfOpenMaxAttempts,
    };
    if (this.openedAt) {
      base.openedAt = this.openedAt;
    }
    if (this.lastFailureAt) {
      base.lastFailureAt = this.lastFailureAt;
    }
    if (this.state === "half-open") {
      base.halfOpenTrialCount = this.trials;
    }
    return base;
  }
}
