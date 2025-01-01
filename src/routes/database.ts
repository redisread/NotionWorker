import { Context, Hono } from 'hono';
//  https://shortcut.jiahongw.com/notion/addPage
import { GetDatabaseResponse, QueryDatabaseResponse, PageObjectResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import NotionService from '../services/notion.service';

interface RelationPage {
    id: string;
    name: string;
}


// database ===== /notion/database
async function retrieveDatabase(ctx: Context): Promise<Response> {
    const { notionApiKey, databaseId } = await ctx.req.json();
    console.log(`retrieveDatabase request: notionApiKey: ${notionApiKey} databaseId: ${databaseId}`);
    const notionService: NotionService = new NotionService(notionApiKey);
    try {
        const response: GetDatabaseResponse = await notionService.retrieveDatabase(databaseId);
        return ctx.json(response);
    } catch (error) {
        console.error("Error querying database:", error);
        return ctx.json({ error: `查询失败: ${error instanceof Error ? error.message : String(error)}` }, 500);
    }
}

async function retrieveDatabaseAllTags(ctx: Context): Promise<Response> {
    const { notionApiKey, databaseId } = await ctx.req.json();
    console.log(`retrieveDatabaseAllTags request: notionApiKey: ${notionApiKey} databaseId: ${databaseId}`);
    const notionService: NotionService = new NotionService(notionApiKey);
    try {
        const tags: string[] = await notionService.retrieveDatabaseAllTags(databaseId);
        return ctx.json(tags);
    } catch (error) {
        console.error("Error retrieving database tags:", error);
        return ctx.json({ error: `获取标签失败: ${error instanceof Error ? error.message : String(error)}` }, 500);
    }
}


async function retrieveDatabaseAllArea(ctx: Context): Promise<Response> {
    const { notionApiKey, databaseId } = await ctx.req.json();
    console.log(`retrieveDatabaseAllArea request: notionApiKey: ${notionApiKey} databaseId: ${databaseId}`);
    const notionService: NotionService = new NotionService(notionApiKey);
    const relationPages: RelationPage[] = await notionService.retrieveDatabaseAllArea(databaseId, '🚩 领域');
    return ctx.json(relationPages);
}


/**
 * 返回所有的 Page ？
 * @param ctx
 * @returns
 */
async function queryDatabase(ctx: Context): Promise<Response> {
    const { notionApiKey, databaseId } = await ctx.req.json();
    console.log(`notionApiKey: ${notionApiKey} databaseId: ${databaseId}`);
    const notionService: NotionService = new NotionService(notionApiKey);
    try {
        const response: QueryDatabaseResponse = await notionService.queryDatabase(databaseId);
        console.log(response);
        return ctx.json(response);
    } catch (error) {
        console.error("Error querying database:", error);
        return ctx.json({ error: `查询失败: ${error instanceof Error ? error.message : String(error)}` }, 500);
    }
}


const databaseRouter = new Hono();
databaseRouter.post('/retrieve', retrieveDatabase);
databaseRouter.post('/retrieveAllTags', retrieveDatabaseAllTags);
databaseRouter.post('/retrieveDatabaseAllArea', retrieveDatabaseAllArea);
databaseRouter.post('/query', queryDatabase);


export default databaseRouter;