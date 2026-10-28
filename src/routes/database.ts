import { Hono } from 'hono';
import NotionService from '../services/notion.service';
import { RequestError } from '../errors';

const databaseRouter = new Hono();
databaseRouter.post('/retrieve', async (c) => {
  const { notionApiKey, databaseId, dataSourceId } = await c.req.json();
  return c.json(await new NotionService(notionApiKey, dataSourceId).retrieveDatabase(databaseId));
});
databaseRouter.post('/retrieveAllTags', async (c) => {
  const { notionApiKey, databaseId, dataSourceId } = await c.req.json();
  return c.json(await new NotionService(notionApiKey, dataSourceId).retrieveDatabaseAllTags(databaseId));
});
databaseRouter.post('/retrieveDatabaseAllArea', async (c) => {
  const { notionApiKey, databaseId, dataSourceId } = await c.req.json();
  return c.json(await new NotionService(notionApiKey, dataSourceId).retrieveDatabaseAllArea(databaseId, '🚩 领域'));
});
databaseRouter.post('/retrieveDatabasePropertyDetails', async (c) => {
  const { notionApiKey, databaseId, dataSourceId, propertyRequests } = await c.req.json();
  if (!Array.isArray(propertyRequests) || propertyRequests.some(p => !p || typeof p.name !== 'string')) throw new RequestError('propertyRequests 必须是属性数组');
  return c.json(await new NotionService(notionApiKey, dataSourceId).retrieveDatabasePropertyDetails(databaseId, propertyRequests));
});
databaseRouter.post('/query', async (c) => {
  const { notionApiKey, databaseId, dataSourceId, filter } = await c.req.json();
  return c.json(await new NotionService(notionApiKey, dataSourceId).queryDatabase(databaseId, filter));
});
export default databaseRouter;
