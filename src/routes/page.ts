import { Client } from '@notionhq/client';
import { Context, Hono } from 'hono';
//  https://shortcut.jiahongw.com/notion/addPage
import { GetDatabaseResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import NotionService, { RelationPage } from '../services/notion.service';
import { CreatePageParameters,BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import { fetchWebPageInfo, getWebPageTitle, summarizeWebPageByContent ,WebPageInfo, SummaryExtentInfo} from '../utils/web'

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
    const { notionApiKey, databaseId, url, props, needSummarize } = await ctx.req.json();
    console.log(`notionApiKey: ${notionApiKey}, databaseId: ${databaseId}, url: ${url} props: ${JSON.stringify(props)}`);
    const notionService: NotionService = new NotionService(notionApiKey);
    var title: string | null;
    const webPageInfo: WebPageInfo = await fetchWebPageInfo(url);
    title = webPageInfo.title;
    console.log(`get webPageInfo: ` + JSON.stringify(webPageInfo));
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

        var summaryResult;
        // 如果 needSummarize 为 true，则添加摘要到正文children
        if (needSummarize) {
            const existTagList: string[] = await notionService.retrieveDatabaseAllTags(databaseId);
            const existAreaList: RelationPage[] = await notionService.retrieveDatabaseAllArea(databaseId, '🚩 领域');
            const summaryExtentInfo:SummaryExtentInfo = {
                existingTags: existTagList,
                existingAreas: existAreaList
            }
            summaryResult = await summarizeWebPageByContent(webPageInfo, summaryExtentInfo);
            if (summaryResult) {
                requestBody.children = [
                    { type: 'paragraph', paragraph: { rich_text: [{ text: { content: "摘要:\n" + summaryResult.summary } }] } },
                    // 添加标签 
                    { type: 'paragraph', paragraph: { rich_text: [{ text: { content: "标签:\n" +JSON.stringify(summaryResult.tags )} }] } },
                    // 添加领域
                    { type: 'paragraph', paragraph: { rich_text: [{ text: { content: "领域:\n" +JSON.stringify(summaryResult.area )} }] } }
                ];
                // 设置标签
                if (summaryResult.tags && summaryResult.tags.length > 0) {
                    requestBody.properties["标签"] = {
                        multi_select: summaryResult.tags.map(tag => ({ name: tag }))
                    };
                }
                // 设置领域
                if (summaryResult.area) {
                    requestBody.properties["🚩 领域"] = {
                        relation: [{ id: summaryResult.area.id }]
                    };
                }
            }
        }

        const response = await notionService.createPage(requestBody);
        return ctx.json({
            title: webPageInfo.title,
            summaryText: summaryResult? summaryResult.summary : "",
            tags: summaryResult? summaryResult.tags : [],
            area: summaryResult? summaryResult.area : {},
        });
    } catch (error) {
        console.error("Error creating page:", error);
        return ctx.json({ error: `创建失败: ${error instanceof Error ? error.message : String(error)}` }, 500);
    }
}


const pageRouter = new Hono();
pageRouter.post('/retrieve', retrievePage);
pageRouter.post('/create', createPage);

export default pageRouter;