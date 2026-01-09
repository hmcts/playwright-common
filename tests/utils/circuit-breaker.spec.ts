import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "../../src/utils/circuit-breaker";

describe("CircuitBreaker transitions", () => {
  it("closed → open after threshold failures, stays open until cooldown, then half-open", () => {
    const now = Date.now();
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, halfOpenMaxAttempts: 2 });

    // Initially closed
    expect(cb.canProceed(now)).toBe(true);

    // Fail 3 times -> should open
    cb.onFailure(now);
    cb.onFailure(now);
    cb.onFailure(now);

    // While open and within cooldown, cannot proceed
    expect(cb.canProceed(now + 500)).toBe(false);

    // After cooldown, should move to half-open and allow a trial
    expect(cb.canProceed(now + 1001)).toBe(true);

    // Success in half-open closes the circuit
    cb.onSuccess();
    expect(cb.canProceed(now + 1002)).toBe(true);
  });

  it("half-open failure returns to open immediately", () => {
    const now = Date.now();
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100, halfOpenMaxAttempts: 1 });

    // Trip to open
    cb.onFailure(now);
    expect(cb.canProceed(now)).toBe(false);

    // Move to half-open after cooldown
    expect(cb.canProceed(now + 200)).toBe(true);

    // Failure in half-open -> back to open
    cb.onFailure(now + 200);
    expect(cb.canProceed(now + 250)).toBe(false);
  });
});
