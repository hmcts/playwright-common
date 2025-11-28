import { describe, it, expect } from 'vitest';
import { formatEndpointHitsMarkdown, type EndpointScanResult } from '../../src/utils/api-endpoints.utils.js';

describe('formatEndpointHitsMarkdown', () => {
  it('formats a non-empty result into a markdown table with total', () => {
    const result: EndpointScanResult = {
      endpoints: [
        { endpoint: '/cases', hits: 3 },
        { endpoint: '/health', hits: 1 },
        { endpoint: '/token', hits: 2 },
      ],
      totalHits: 6,
    };
    const md = formatEndpointHitsMarkdown(result);
    expect(md).toContain('| Endpoint | Hits |');
    expect(md).toMatch(/\| \/cases \| 3 \|/);
    expect(md).toMatch(/Total Hits: 6/);
  });

  it('supports passing an array + inferred total when second arg omitted', () => {
    const endpoints = [
      { endpoint: '/a', hits: 1 },
      { endpoint: '/b', hits: 2 },
    ];
    const md = formatEndpointHitsMarkdown(endpoints);
    expect(md).toMatch(/Total Hits: 3/);
  });

  it('prints none found table when empty', () => {
    const md = formatEndpointHitsMarkdown([]);
    expect(md).toMatch(/\(none found\)/);
    expect(md).toMatch(/Total Hits: 0/);
  });
});
