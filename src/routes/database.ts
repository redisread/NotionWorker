import { Context, Hono } from 'hono';
//  https://shortcut.jiahongw.com/notion/addPage
import { GetDatabaseResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import NotionService from '../services/notion.service';

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
databaseRouter.post('/query', queryDatabase);


export default databaseRouter;