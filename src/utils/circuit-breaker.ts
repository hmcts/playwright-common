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

export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private openedAt = 0;
  private trials = 0;
  private lastFailureAt = 0;
  private readonly opts: Required<CircuitBreakerOptions>;

  constructor(options?: CircuitBreakerOptions) {
    this.opts = {
      failureThreshold: options?.failureThreshold ?? 5,
      cooldownMs: options?.cooldownMs ?? 30000,
      halfOpenMaxAttempts: options?.halfOpenMaxAttempts ?? 2,
    };
  }

  public canProceed(now = Date.now()): boolean {
    switch (this.state) {
      case "closed":
        return true;
      case "open":
        if (now - this.openedAt >= this.opts.cooldownMs) {
          this.state = "half-open";
          this.trials = 0;
          return true; // allow a trial request
        }
        return false;
      case "half-open":
        return this.trials < this.opts.halfOpenMaxAttempts;
    }
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
      this.trials++;
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
