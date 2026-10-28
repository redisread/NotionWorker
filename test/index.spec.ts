import { SELF, fetchMock } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

const databaseId = '11111111-1111-1111-1111-111111111111';
const sourceId = '22222222-2222-2222-2222-222222222222';
const token = 'test-token-never-log';
const body = { notionApiKey: token, databaseId, url: 'https://example.com', needSummarize: false,
  props: [{ name: 'Name', type: 'title', value: '接口测试' }, { name: 'URL', type: 'url' }] };
const post = (path: string, data: unknown) => SELF.fetch(`https://worker.test${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
function database(sources = [{ id: sourceId, name: 'Test' }]) {
  fetchMock.get('https://api.notion.com').intercept({ path: `/v1/databases/${databaseId}`, method: 'GET' })
    .reply(200, { object: 'database', id: databaseId, data_sources: sources });
}
function webpage() {
  fetchMock.get('https://r.jina.ai').intercept({ path: '/https://example.com', method: 'GET' }).reply(429, {});
  fetchMock.get('https://example.com').intercept({ path: '/', method: 'GET' }).reply(200, '<html><title>Example Domain</title><p>Example content</p></html>');
}
beforeEach(() => { fetchMock.activate(); fetchMock.disableNetConnect(); });
afterEach(() => { fetchMock.assertNoPendingInterceptors(); fetchMock.deactivate(); vi.restoreAllMocks(); });

describe('backend API', () => {
  it('serves health JSON and returns real JSON 404s for retired webpages', async () => {
    expect(await (await SELF.fetch('https://worker.test/health')).json()).toEqual({ status: 'ok' });
    for (const path of ['/notion/query', '/notion/pages', '/missing']) {
      const response = await SELF.fetch(`https://worker.test${path}`);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
    }
  });
  it('rejects missing credentials and malformed JSON', async () => {
    expect((await post('/notion/page/create', {})).status).toBe(400);
    expect((await SELF.fetch('https://worker.test/notion/page/create', { method: 'POST', body: '{' })).status).toBe(400);
  });
  it('retires the AI endpoint and rejects legacy requests that require a summary', async () => {
    expect((await post('/notion/ai', { url: body.url })).status).toBe(404);
    expect((await post('/notion/page/create', { ...body, needSummarize: true })).status).toBe(400);
  });
  it('saves through a discovered data source after Jina throttles, returning the page identity', async () => {
    webpage(); database();
    let submitted: any;
    fetchMock.get('https://api.notion.com').intercept({ path: '/v1/pages', method: 'POST' }).reply(200, (request) => {
      submitted = JSON.parse(String(request.body));
      return { object: 'page', id: 'saved-page', url: 'https://www.notion.so/saved-page' };
    });
    const response = await post('/notion/page/create', body);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 'saved-page', url: 'https://www.notion.so/saved-page' });
    expect(submitted.parent).toEqual({ data_source_id: sourceId });
    expect(submitted.properties.Name.title[0].text.content).toBe('接口测试');
    expect(submitted.properties.URL.url).toBe('https://example.com');
  });
  it('keeps manual properties when saving without any AI dependency', async () => {
    webpage(); database();
    let submitted: any;
    fetchMock.get('https://api.notion.com').intercept({ path: '/v1/pages', method: 'POST' }).reply(200, (request) => {
      submitted = JSON.parse(String(request.body));
      return { object: 'page', id: 'manual-page' };
    });
    const response = await post('/notion/page/create', { ...body, needSummarize: undefined, props: [
      { name: 'Name', type: 'title' },
      { name: 'Category', type: 'select', value: 'Tool' },
      { name: 'Tags', type: 'multi_select', value: ' A\nB\nA\n ' },
      { name: 'Description', type: 'rich_text', value: '手动简介' },
    ] });
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty('summary');
    expect(submitted.properties).toMatchObject({
      Name: { title: [{ text: { content: 'Example Domain' } }] },
      Category: { select: { name: 'Tool' } },
      Tags: { multi_select: [{ name: 'A' }, { name: 'B' }] },
      Description: { rich_text: [{ text: { content: '手动简介' } }] },
    });
    expect(submitted).not.toHaveProperty('children');
  });
  it('prepares only the title without writing a page', async () => {
    webpage();
    const response = await post('/notion/page/prepare', body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ title: 'Example Domain' });
  });
  it('refuses an ambiguous multi-source database', async () => {
    database([{ id: sourceId, name: 'A' }, { id: 'another', name: 'B' }]);
    expect((await post('/notion/database/retrieve', body)).status).toBe(409);
  });
  it('preserves the database ID in retrieve responses', async () => {
    database();
    fetchMock.get('https://api.notion.com').intercept({ path: `/v1/data_sources/${sourceId}`, method: 'GET' }).reply(200, { object: 'data_source', id: sourceId, properties: {} });
    const response = await post('/notion/database/retrieve', body);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ object: 'database', id: databaseId, data_source_id: sourceId });
  });
  it('selects the explicit data source and restores tag retrieval', async () => {
    database([{ id: sourceId, name: 'A' }, { id: 'another', name: 'B' }]);
    fetchMock.get('https://api.notion.com').intercept({ path: `/v1/data_sources/${sourceId}`, method: 'GET' })
      .reply(200, { object: 'data_source', properties: { Tags: { type: 'multi_select', multi_select: { options: [{ name: 'API' }] } } } });
    const response = await post('/notion/database/retrieveAllTags', { ...body, dataSourceId: sourceId });
    expect(response.status).toBe(200); expect(await response.json()).toEqual(['API']);
  });
  it('does not expose upstream token errors in responses or logs', async () => {
    const log = vi.spyOn(console, 'log'); const errorLog = vi.spyOn(console, 'error');
    fetchMock.get('https://api.notion.com').intercept({ path: `/v1/databases/${databaseId}`, method: 'GET' })
      .reply(401, { object: 'error', status: 401, code: 'unauthorized', message: `invalid ${token}` });
    const response = await worker.fetch(new Request('https://worker.test/notion/database/retrieve', { method: 'POST', body: JSON.stringify(body) }), {});
    expect(response.status).toBe(401); expect(await response.text()).not.toContain(token);
    expect(JSON.stringify([...log.mock.calls, ...errorLog.mock.calls])).not.toContain(token);
  });
});
