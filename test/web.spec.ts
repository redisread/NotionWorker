import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import { getWebPageTitle } from '../src/utils/web';

describe('getWebPageTitle', () => {
  it('returns the correct title when present', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('<html><head><title>Test Title</title></head><body></body></html>'),
    });
    global.fetch = mockFetch;

    const ctx = createExecutionContext();
    const title = await getWebPageTitle('https://example.com');
    await waitOnExecutionContext(ctx);

    expect(title).toBe('Test Title');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com');
  });

  it('returns null when title is not present', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('<html><head></head><body></body></html>'),
    });
    global.fetch = mockFetch;

    const ctx = createExecutionContext();
    const title = await getWebPageTitle('https://example.com');
    await waitOnExecutionContext(ctx);

    expect(title).toBeNull();
  });

  it('returns null when fetch fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Fetch failed'));
    global.fetch = mockFetch;

    const ctx = createExecutionContext();
    const title = await getWebPageTitle('https://example.com');
    await waitOnExecutionContext(ctx);

    expect(title).toBeNull();
  });
});
