import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timingSafeEqual } from 'hono/utils/buffer';
import pageRouter from './routes/page';
import databaseRouter from './routes/database';
import { summarizeWebPage } from './utils/web';
import { publicError, RequestError } from './errors';

export interface Env {
  DEEPSEEK_API_KEY?: string;
  AI_ACCESS_TOKEN?: string;
}

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());
app.get('/', (c) => c.json({ service: 'notion-worker', status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok' }));
app.notFound((c) => c.json({ error: '接口不存在' }, 404));
app.onError((error, c) => {
  const safe = publicError(error);
  // Never log upstream errors, request bodies, credentials or saved content.
  console.error(JSON.stringify({ event: 'request_failed', status: safe.status }));
  return c.json({ error: safe.message }, safe.status);
});

app.use('/notion/*', async (c, next) => {
  if (c.req.method !== 'POST') return next();
  const body = await c.req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('请求必须是 JSON 对象');
  if (c.req.path !== '/notion/ai') {
    if (typeof body.notionApiKey !== 'string' || !body.notionApiKey.trim()) throw new RequestError('缺少 notionApiKey');
  }
  const idPattern = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  if (c.req.path === '/notion/page/retrieve') {
    if (typeof body.pageId !== 'string' || !idPattern.test(body.pageId)) throw new RequestError('pageId 必须是 Notion 页面 ID');
  } else if (c.req.path !== '/notion/ai') {
    if (typeof body.databaseId !== 'string' || !idPattern.test(body.databaseId)) throw new RequestError('databaseId 必须是 Notion 数据库 ID');
  }
  if (body.dataSourceId !== undefined && (typeof body.dataSourceId !== 'string' || !body.dataSourceId.trim())) throw new RequestError('dataSourceId 必须是非空字符串');
  if (['/notion/page/create', '/notion/page/prepare', '/notion/ai'].includes(c.req.path)) {
    let url: URL;
    try { url = new URL(body.url); } catch { throw new RequestError('url 必须是有效 HTTP(S) 地址'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new RequestError('url 必须是有效 HTTP(S) 地址');
    if (body.needSummarize !== undefined && typeof body.needSummarize !== 'boolean') throw new RequestError('needSummarize 必须是布尔值');
    if (c.req.path !== '/notion/ai' && (!Array.isArray(body.props) || body.props.some((p: unknown) => !p || typeof p !== 'object' || !('name' in p) || typeof p.name !== 'string' || !('type' in p) || typeof p.type !== 'string'))) throw new RequestError('props 必须是属性数组');
    if (body.needSummarize || c.req.path === '/notion/ai') {
      if (!c.env?.DEEPSEEK_API_KEY || !c.env.AI_ACCESS_TOKEN) throw new RequestError('尚未配置 AI 摘要服务', 503);
      const bearer = c.req.header('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!bearer || !await timingSafeEqual(bearer, c.env.AI_ACCESS_TOKEN)) throw new RequestError('AI 服务访问凭据无效', 401);
    }
  }
  await next();
});
app.route('/notion/page', pageRouter);
app.route('/notion/database', databaseRouter);
app.post('/notion/ai', async (c) => {
  const { url } = await c.req.json();
  return c.json(await summarizeWebPage(url, c.env.DEEPSEEK_API_KEY));
});
export default app;
