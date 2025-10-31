import { describe, it, expect } from 'vitest';
import { WaitUtils } from '../../src/utils/wait.utils.js';

// Minimal mock wrapper for Playwright Locator isVisible
class MockLocator {
  constructor(private states: boolean[]) {}
  private call = 0;
  async isVisible(): Promise<boolean> {
    const state = this.states[Math.min(this.call, this.states.length - 1)];
    this.call++;
    return state;
  }
  toString() { return 'MockLocator'; }
}

describe('WaitUtils', () => {
  it('returns immediately when desired visibility already matches', async () => {
    const locator = new MockLocator([true, true]);
    const wait = new WaitUtils();
    const start = Date.now();
    await wait.waitForLocatorVisibility(locator, {
      visibility: true,
      delay: 10,
      timeout: 200,
    });
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('waits until visibility becomes true', async () => {
    const locator = new MockLocator([false, false, true]);
    const wait = new WaitUtils();
    await wait.waitForLocatorVisibility(locator, {
      visibility: true,
      delay: 5,
      timeout: 200,
    });
    // If it completed without throwing it's successful
    expect(true).toBe(true);
  });

  it('throws when timeout exceeded', async () => {
    const locator = new MockLocator([false, false, false, false]);
    const wait = new WaitUtils();
    await expect(
      wait.waitForLocatorVisibility(locator, {
        visibility: true,
        delay: 10,
        timeout: 30,
      })
    ).rejects.toThrow(/Timeout/);
  });
});
