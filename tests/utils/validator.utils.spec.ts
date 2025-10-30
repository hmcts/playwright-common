import { describe, it, expect } from 'vitest';
import { ValidatorUtils } from '../../src/utils/validator.utils.js';

describe('ValidatorUtils', () => {
  describe('validateCaseNumber', () => {
    it('accepts digits only', () => {
      expect(() => ValidatorUtils.validateCaseNumber('123456')).not.toThrow();
    });
    it('rejects alphanumeric', () => {
      expect(() => ValidatorUtils.validateCaseNumber('AB123')).toThrow();
    });
  });

  describe('validateDate', () => {
    it('accepts valid date format', () => {
      expect(() => ValidatorUtils.validateDate('18 Oct 2024')).not.toThrow();
    });
    it('rejects invalid format', () => {
      expect(() => ValidatorUtils.validateDate('2024-10-18')).toThrow();
    });
    it('rejects impossible date', () => {
      expect(() => ValidatorUtils.validateDate('32 Oct 2024')).toThrow();
    });
  });
});
