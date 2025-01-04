import { Context, Hono } from 'hono';
//  https://shortcut.jiahongw.com/notion/addPage
import { GetDatabaseResponse, QueryDatabaseResponse, PageObjectResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import NotionService from '../services/notion.service';
import { PropertyRequest, DatabasePropertiesDetail } from '../services/notion.service';

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


async function retrieveDatabasePropertyDetails(ctx: Context): Promise<Response> {
    const { notionApiKey, databaseId ,propertyRequests } = await ctx.req.json();
    console.log(`retrieveDatabasePropertyDetails request: notionApiKey: ${notionApiKey} databaseId: ${databaseId}`);
    const notionService: NotionService = new NotionService(notionApiKey);
    const propertyDetails: DatabasePropertiesDetail = await notionService.retrieveDatabasePropertyDetails(databaseId, propertyRequests);
    return ctx.json(propertyDetails);
}

/**
 * 返回所有的 Page ？
 * @param ctx
 * @returns
 */
async function queryDatabase(ctx: Context): Promise<Response> {
    const { notionApiKey, databaseId, filter } = await ctx.req.json();
    console.log('收到查询请求，过滤条件:', JSON.stringify(filter, null, 2));
    
    if (filter?.and) {
        filter.and.forEach((condition: any, index: number) => {
            console.log(`时间条件 ${index + 1}:`, {
                属性名: condition.property,
                条件类型: condition.date ? Object.keys(condition.date)[0] : '未知',
                时间值: condition.date ? Object.values(condition.date)[0] : '未知'
            });
        });
    }

    try {
        const notionService = new NotionService(notionApiKey);
        const response = await notionService.queryDatabase(databaseId, filter);
        console.log(`查询结果: 找到 ${response.results.length} 条记录`);
        return ctx.json(response);
    } catch (error) {
        console.error('查询失败:', error);
        return ctx.json({ 
            error: `查询失败: ${error instanceof Error ? error.message : String(error)}` 
        }, 500);
    }
}


const databaseRouter = new Hono();
databaseRouter.post('/retrieve', retrieveDatabase);
databaseRouter.post('/retrieveAllTags', retrieveDatabaseAllTags);
databaseRouter.post('/retrieveDatabaseAllArea', retrieveDatabaseAllArea);
databaseRouter.post('/retrieveDatabasePropertyDetails', retrieveDatabasePropertyDetails);
databaseRouter.post('/query', queryDatabase);


export default databaseRouter;