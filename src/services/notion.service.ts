import { Client } from '@notionhq/client';
import { GetDatabaseResponse, QueryDatabaseResponse, GetPageResponse, CreatePageResponse, CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';

/**
 * Interface for a relation page
 */

interface RelationPage {
    id: string;
    name: string;
}



class NotionService {

    private client: Client;

    constructor(apiKey: string) {
        this.client = new Client({ auth: apiKey });
    }

    async retrieveDatabase(databaseId: string): Promise<GetDatabaseResponse> {
        try {
            const response: GetDatabaseResponse = await this.client.databases.retrieve({
                database_id: databaseId,
            });
            return response;
        } catch (error) {
            console.error("Error retrieving database:", error);
            throw new Error(`查询失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    async retrieveDatabaseAllArea(databaseId: string, relationName: string): Promise<RelationPage[]> {
        try {
            const response: GetDatabaseResponse = await this.retrieveDatabase(databaseId);
            const relations: RelationPage[] = [];

            for (const key in response.properties) {
                if (key !== relationName) {
                    continue;
                }
                const propConfig = response.properties[key];
                if (propConfig.type !== 'relation') {
                    continue;
                }
                const options = propConfig.relation;
                const relationDataBaseId = options.database_id;

                const queryResponse = await this.queryDatabase(relationDataBaseId);

                queryResponse.results.forEach((page) => {
                    if ('properties' in page) {
                        const titleProperty = page.properties['Name'];
                        if (titleProperty && titleProperty.type === 'title') {
                            const titleArray = titleProperty.title;
                            if (Array.isArray(titleArray) && titleArray.length > 0) {
                                const titleItem = titleArray[0];
                                if ('text' in titleItem) {
                                    relations.push({
                                        id: page.id,
                                        name: titleItem.text.content
                                    });
                                }
                            }
                        }
                    }
                });
            }

            return relations;
        } catch (error) {
            console.error("Error retrieving database relations:", error);
            throw new Error(`获取关系数据失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }


    async retrieveDatabaseAllTags(databaseId: string, tagPropertyName: string = '标签'): Promise<string[]> {
        try {
            const response: GetDatabaseResponse = await this.retrieveDatabase(databaseId);
            const tags: string[] = [];

            for (const key in response.properties) {
                if (key !== tagPropertyName) {
                    continue;
                }
                const propConfig = response.properties[key];
                if (propConfig.type !== 'multi_select') {
                    continue;
                }
                const options = propConfig.multi_select.options;
                const keyTags = options.map(option => option.name);
                tags.push(...keyTags);
            }

            return tags;
        } catch (error) {
            console.error("Error retrieving database tags:", error);
            throw new Error(`获取标签失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async queryDatabase(databaseId: string): Promise<QueryDatabaseResponse> {
        try {
            const response = await this.client.databases.query({ database_id: databaseId });
            return response;
        } catch (error) {
            console.error("Error querying database:", error);
            throw new Error(`查询失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }


    async retrievePage(pageId: string): Promise<GetPageResponse> {
        try {
            const response = await this.client.pages.retrieve({ page_id: pageId });
            return response;
        } catch (error) {
            console.error("Error querying page:", error);
            throw new Error(`查询失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }


    async createPage(createPageParam: CreatePageParameters): Promise<CreatePageResponse> {
        try {
            const response: CreatePageResponse = await this.client.pages.create(createPageParam);
            return response;
        } catch (error) {
            console.error("Error creating page:", error);
            throw new Error(`创建失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

}

export default NotionService;
export type { RelationPage };