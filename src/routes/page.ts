import { Hono } from 'hono';
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import NotionService from '../services/notion.service';
import { fetchWebPageInfo } from '../utils/web';
import { RequestError } from '../errors';
import type { PropertyValue } from '../types/notion';

type PageProperties = NonNullable<CreatePageParameters['properties']>;

function textValue(value: PropertyValue['value']): string {
  if (typeof value !== 'string') throw new RequestError('属性值必须是字符串');
  return value;
}

function buildProperties(props: PropertyValue[], title: string, url: string): PageProperties {
  const properties: PageProperties = {};
  for (const prop of props) {
    if (!prop.value && prop.type !== 'url' && prop.type !== 'title') continue;
    switch (prop.type) {
      case 'title':
        properties[prop.name] = { title: [{ text: { content: prop.value ? textValue(prop.value) : title } }] };
        break;
      case 'url':
        properties[prop.name] = { url: prop.value ? textValue(prop.value) : url };
        break;
      case 'select':
        properties[prop.name] = { select: { name: textValue(prop.value) } };
        break;
      case 'multi_select': {
        const values = Array.isArray(prop.value) ? prop.value : textValue(prop.value).split('\n');
        if (values.some(value => typeof value !== 'string')) throw new RequestError('多选属性值必须是字符串数组');
        properties[prop.name] = { multi_select: [...new Set(values.map(value => value.trim()).filter(Boolean))].map(name => ({ name })) };
        break;
      }
      case 'rich_text':
        properties[prop.name] = { rich_text: [{ text: { content: textValue(prop.value) } }] };
        break;
      default:
        throw new RequestError(`不支持属性类型 ${prop.type}`);
    }
  }
  return properties;
}

const pageRouter = new Hono();
pageRouter.post('/retrieve', async (c) => {
  const { notionApiKey, pageId } = await c.req.json();
  return c.json(await new NotionService(notionApiKey).retrievePage(pageId));
});
pageRouter.post('/create', async (c) => {
  const { notionApiKey, databaseId, dataSourceId, url, props } = await c.req.json();
  const webpage = await fetchWebPageInfo(url);
  const properties = buildProperties(props, webpage.title, url);
  const response = await new NotionService(notionApiKey, dataSourceId).createPage({
    parent: { database_id: databaseId }, properties,
  });
  return c.json({ id: response.id, url: 'url' in response ? response.url : undefined, title: webpage.title, properties });
});
pageRouter.post('/prepare', async (c) => {
  const { url } = await c.req.json();
  const webpage = await fetchWebPageInfo(url);
  return c.json({ title: webpage.title });
});
export default pageRouter;
