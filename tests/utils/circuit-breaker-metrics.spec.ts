import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../../src/utils/circuit-breaker.js';

describe('CircuitBreaker metrics', () => {
  it('reports metrics across state transitions', () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 50, halfOpenMaxAttempts: 1 });

    // Initial state
    let metrics = breaker.getMetrics();
    expect(metrics.state).toBe('closed');
    expect(metrics.failureCount).toBe(0);
    expect(metrics.openedAt).toBeUndefined();
    expect(metrics.lastFailureAt).toBeUndefined();

    // First failure (still closed)
    breaker.onFailure(Date.now());
    metrics = breaker.getMetrics();
    expect(metrics.state).toBe('closed');
    expect(metrics.failureCount).toBe(1);
    expect(metrics.lastFailureAt).toBeDefined();
    const firstFailureTime = metrics.lastFailureAt!;
    expect(metrics.openedAt).toBeUndefined();

    // Second failure triggers open
    breaker.onFailure(Date.now());
    metrics = breaker.getMetrics();
    expect(metrics.state).toBe('open');
    expect(metrics.failureCount).toBe(2);
    expect(metrics.openedAt).toBeDefined();
    const openedAt = metrics.openedAt!;
    expect(openedAt).toBeGreaterThanOrEqual(firstFailureTime);

    // While open and cooldown not elapsed, cannot proceed
    expect(breaker.canProceed(openedAt + 10)).toBe(false);
    metrics = breaker.getMetrics();
    expect(metrics.state).toBe('open');

    // After cooldown elapses, canProceed transitions to half-open
    const afterCooldown = openedAt + 60; // > cooldownMs
    expect(breaker.canProceed(afterCooldown)).toBe(true);
    metrics = breaker.getMetrics();
    expect(metrics.state).toBe('half-open');
    expect(metrics.halfOpenTrialCount).toBe(0);

    // Failure in half-open re-opens circuit
    breaker.onFailure(afterCooldown + 1);
    metrics = breaker.getMetrics();
    expect(metrics.state).toBe('open');
    expect(metrics.halfOpenTrialCount).toBeUndefined(); // trials not relevant when open

    // Cooldown again then success in half-open closes circuit and resets failures
    const reopenedAt = metrics.openedAt!;
    const secondHalfOpenTime = reopenedAt + 60;
    expect(breaker.canProceed(secondHalfOpenTime)).toBe(true); // transitions to half-open
    breaker.onSuccess(); // success closes circuit
    metrics = breaker.getMetrics();
    expect(metrics.state).toBe('closed');
    expect(metrics.failureCount).toBe(0);
    expect(metrics.halfOpenTrialCount).toBeUndefined();

    vi.useRealTimers();
  });
});
