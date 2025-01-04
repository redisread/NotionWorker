import { Client } from '@notionhq/client';
import { 
    GetDatabaseResponse, 
    QueryDatabaseResponse, 
    GetPageResponse, 
    CreatePageResponse, 
    CreatePageParameters,
    PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { 
    PropertyRequest,
    PropertyDetail,
    DatabasePropertiesDetail,
    RelationPage,
} from '../types/notion';

class NotionService {
    private client: Client;

    constructor(apiKey: string) {
        this.client = new Client({ auth: apiKey });
    }

    // 基础数据库操作
    async retrieveDatabase(databaseId: string): Promise<GetDatabaseResponse> {
        try {
            return await this.client.databases.retrieve({ database_id: databaseId });
        } catch (error) {
            this.handleError('查询数据库失败', error);
        }
    }

    async queryDatabase(databaseId: string): Promise<QueryDatabaseResponse> {
        try {
            return await this.client.databases.query({ database_id: databaseId });
        } catch (error) {
            this.handleError('查询数据库内容失败', error);
        }
    }

    // 属性详情获取
    async retrieveDatabasePropertyDetails(
        databaseId: string,
        propertyRequests: PropertyRequest[]
    ): Promise<DatabasePropertiesDetail> {
        try {
            const database = await this.retrieveDatabase(databaseId);
            const properties: Record<string, PropertyDetail> = {};

            for (const request of propertyRequests) {
                const property = database.properties[request.name];
                if (!property) {
                    throw new Error(`属性 "${request.name}" 不存在`);
                }

                this.validatePropertyType(request, property);
                properties[request.name] = await this.buildPropertyDetail(request.name, property);
            }

            return { databaseId, properties };
        } catch (error) {
            this.handleError('获取数据库属性详情失败', error);
        }
    }

    // 页面操作
    async retrievePage(pageId: string): Promise<GetPageResponse> {
        try {
            return await this.client.pages.retrieve({ page_id: pageId });
        } catch (error) {
            this.handleError('获取页面失败', error);
        }
    }

    async createPage(params: CreatePageParameters): Promise<CreatePageResponse> {
        try {
            return await this.client.pages.create(params);
        } catch (error) {
            this.handleError('创建页面失败', error);
        }
    }

    // 辅助方法
    private async buildPropertyDetail(name: string, property: any): Promise<PropertyDetail> {
        const detail: PropertyDetail = {
            name,
            type: property.type,
            id: property.id
        };

        switch (property.type) {
            case 'select':
            case 'multi_select':
                detail.options = property[property.type].options.map(this.mapOption);
                break;
            case 'relation':
                detail.options = await this.getRelationOptions(property.relation.database_id);
                break;
        }

        return detail;
    }

    private async getRelationOptions(databaseId: string): Promise<Array<{ id: string; name: string }>> {
        const pages = await this.queryDatabase(databaseId);
        return pages.results
            .filter((page): page is PageObjectResponse => 'properties' in page)
            .map(page => ({
                id: page.id,
                name: this.getPageTitle(page)
            }))
            .filter(option => option.name); // 过滤掉没有标题的选项
    }

    private getPageTitle(page: PageObjectResponse): string {
        const titleProp = page.properties.Name as any;
        return titleProp?.title?.[0]?.plain_text || '';
    }

    private mapOption(opt: any) {
        return {
            id: opt.id,
            name: opt.name,
            color: opt.color
        };
    }

    private validatePropertyType(request: PropertyRequest, property: any) {
        if (request.type && property.type !== request.type) {
            throw new Error(
                `属性 "${request.name}" 类型不匹配，期望 "${request.type}"，实际 "${property.type}"`
            );
        }
    }

    private handleError(message: string, error: unknown): never {
        console.error(`${message}:`, error);
        throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export default NotionService;
export type { RelationPage, PropertyRequest, PropertyDetail, DatabasePropertiesDetail };