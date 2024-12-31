import { Client } from '@notionhq/client';
import { Context, Hono } from 'hono';
//  https://shortcut.jiahongw.com/notion/addPage
import { GetDatabaseResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import NotionService from '../services/notion.service';
import { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import { getWebPageTitle } from '../utils/web'

// page ===== /notion/page
async function retrievePage(ctx: Context): Promise<Response> {
    const { notionApiKey, databaseId, pageId } = await ctx.req.json();
    console.log(`notionApiKey: ${notionApiKey} databaseId: ${databaseId} pageId: ${pageId}`);
    const notionService: NotionService = new NotionService(notionApiKey);
    try {
        const response = await notionService.retrievePage(pageId);
        console.log(response);
        return ctx.json(response);
    } catch (error) {
        console.error("Error querying page:", error);
        return ctx.json({ error: `查询失败: ${error instanceof Error ? error.message : String(error)}` }, 500);
    }
}


async function createPage(ctx: Context): Promise<Response> {
    const { notionApiKey, databaseId, url, props } = await ctx.req.json();
    console.log(`notionApiKey: ${notionApiKey}, databaseId: ${databaseId}, url: ${url} props: ${JSON.stringify(props)}`);
    const notionService: NotionService = new NotionService(notionApiKey);
    var title: string | null;
    try {
        title = await getWebPageTitle(url);
    } catch (error) {
        console.error("Error querying title:", error);
        title = null;
    }
    console.log(`get title: ${title}`);
    try {
        const properties: Record<string, any> = {};

        // 处理 props
        if (props && Array.isArray(props)) {
            props.forEach(prop => {
                switch (prop.type) {
                    case 'select':
                        properties[prop.name] = {
                            select: { name: prop.value }
                        };
                        break;
                    case 'url':
                        properties[prop.name] = {
                            url: prop.value ? prop.value : url
                        };
                        break;
                    case 'title':
                        properties[prop.name] = {
                            title: [{ text: { content: prop.value ? prop.value : title } }]
                        };
                        break;
                    case 'multi_select':
                        var multi_select_list;
                        if (typeof prop.value === 'string') {
                            multi_select_list = prop.value.split("\n").map((item: string) => {
                                return { "name": item }
                            });
                        } else {
                            multi_select_list = prop.value.map((item: string) => {
                                return { "name": item }
                            });
                        }
                        properties[prop.name] = {
                            multi_select: multi_select_list
                        };
                        break;
                    case 'rich_text':
                        properties[prop.name] = {
                            rich_text: [{ text: { content: prop.value } }]
                        };
                    // 可以根据需要添加更多类型的处理
                }
            });
        }

        const requestBody: CreatePageParameters = {
            parent: { database_id: databaseId },
            properties: properties
        };
        const response = await notionService.createPage(requestBody);
        return ctx.json(response);
    } catch (error) {
        console.error("Error creating page:", error);
        return ctx.json({ error: `创建失败: ${error instanceof Error ? error.message : String(error)}` }, 500);
    }
}


const pageRouter = new Hono();
pageRouter.post('/retrieve', retrievePage);
pageRouter.post('/create', createPage);

export default pageRouter;