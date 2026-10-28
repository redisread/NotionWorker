import { fetchMock } from 'cloudflare:test';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { fetchWebPageInfo } from '../src/utils/web';
beforeEach(() => { fetchMock.activate(); fetchMock.disableNetConnect(); });
afterEach(() => { fetchMock.assertNoPendingInterceptors(); fetchMock.deactivate(); });
it('uses a single Reader response', async () => {
  fetchMock.get('https://r.jina.ai').intercept({ path: '/https://example.com', method: 'GET' })
    .reply(200, { data: { title: 'Title', content: 'Content' } });
  expect(await fetchWebPageInfo('https://example.com')).toEqual({ title: 'Title', originContent: 'Content', parseContent: 'Content' });
});
it('reports webpage failure instead of pretending to save successfully', async () => {
  fetchMock.get('https://r.jina.ai').intercept({ path: '/https://example.com', method: 'GET' }).reply(429, {});
  fetchMock.get('https://example.com').intercept({ path: '/', method: 'GET' }).reply(503, 'unavailable');
  await expect(fetchWebPageInfo('https://example.com')).rejects.toThrow('网页内容获取失败');
});
