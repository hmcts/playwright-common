export interface CircuitBreakerOptions {
  failureThreshold?: number; // failures to open
  cooldownMs?: number; // time in open before half-open
  halfOpenMaxAttempts?: number; // trial attempts in half-open
}

type State = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private openedAt = 0;
  private trials = 0;
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
      return;
    }
    this.failures++;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = "open";
      this.openedAt = now;
    }
  }
}
