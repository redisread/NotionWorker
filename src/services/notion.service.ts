import { Client } from '@notionhq/client';
import { GetDatabaseResponse, QueryDatabaseResponse, GetPageResponse, CreatePageResponse, CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';



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