import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "../../src/utils/circuit-breaker";

describe("CircuitBreaker validation and edge cases", () => {
  it("throws error when failureThreshold < 1", () => {
    expect(() => new CircuitBreaker({ failureThreshold: 0 })).toThrow(
      "failureThreshold must be >= 1, got 0"
    );
    expect(() => new CircuitBreaker({ failureThreshold: -1 })).toThrow(
      "failureThreshold must be >= 1, got -1"
    );
  });

  it("throws error when cooldownMs is negative", () => {
    expect(() => new CircuitBreaker({ cooldownMs: -1 })).toThrow(
      "cooldownMs must be non-negative, got -1"
    );
  });

  it("throws error when halfOpenMaxAttempts < 1", () => {
    expect(() => new CircuitBreaker({ halfOpenMaxAttempts: 0 })).toThrow(
      "halfOpenMaxAttempts must be >= 1, got 0"
    );
    expect(() => new CircuitBreaker({ halfOpenMaxAttempts: -1 })).toThrow(
      "halfOpenMaxAttempts must be >= 1, got -1"
    );
  });

  it("allows exactly halfOpenMaxAttempts trials (no double-counting)", () => {
    const now = Date.now();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 100,
      halfOpenMaxAttempts: 3,
    });

    // Trip to open
    cb.onFailure(now);
    expect(cb.canProceed(now)).toBe(false);

    // Move to half-open after cooldown
    const afterCooldown = now + 200;
    
    // Should allow exactly 3 trials
    expect(cb.canProceed(afterCooldown)).toBe(true);  // Trial 1
    expect(cb.canProceed(afterCooldown)).toBe(true);  // Trial 2
    expect(cb.canProceed(afterCooldown)).toBe(true);  // Trial 3
    expect(cb.canProceed(afterCooldown)).toBe(false); // Should block (trials exhausted)
  });

  it("doesn't double-count trials when onFailure is called in half-open", () => {
    const now = Date.now();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 100,
      halfOpenMaxAttempts: 2,
    });

    // Trip to open
    cb.onFailure(now);

    // Move to half-open
    const afterCooldown = now + 200;
    expect(cb.canProceed(afterCooldown)).toBe(true);  // Trial 1 (trials: 0→1)

    // Failure should NOT double-increment trials
    cb.onFailure(afterCooldown + 10);  // Should not increment trials again

    // After another cooldown, should allow 2 trials (not 1)
    const secondHalfOpen = afterCooldown + 200;
    expect(cb.canProceed(secondHalfOpen)).toBe(true);   // Trial 1
    expect(cb.canProceed(secondHalfOpen)).toBe(true);   // Trial 2
    expect(cb.canProceed(secondHalfOpen)).toBe(false);  // Should block
  });

  it("resets trial count when transitioning from half-open to closed on success", () => {
    const now = Date.now();
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 100,
      halfOpenMaxAttempts: 3,
    });

    // Trip to open
    cb.onFailure(now);

    // Move to half-open
    const afterCooldown = now + 200;
    expect(cb.canProceed(afterCooldown)).toBe(true);  // Trial 1

    // Success closes circuit
    cb.onSuccess();

    // Should be fully closed now
    expect(cb.canProceed(afterCooldown + 10)).toBe(true);
    
    // Metrics should show closed state with zero failures
    const metrics = cb.getMetrics();
    expect(metrics.state).toBe("closed");
    expect(metrics.failureCount).toBe(0);
  });
});
