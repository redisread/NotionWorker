import { RequestError } from '../errors';
import { Client } from '@notionhq/client';
import {
    GetDataSourceResponse,
    QueryDataSourceResponse,
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

type DatabaseView = Omit<GetDataSourceResponse, 'object' | 'id'> & {
    object: 'database';
    id: string;
    data_source_id: string;
};

class NotionService {
    private client: Client;

    constructor(apiKey: string, private dataSourceId?: string) {
        this.client = new Client({ auth: apiKey, notionVersion: '2025-09-03', logger: () => {}, fetch: (url, init) => fetch(url, init) });
    }

    private async resolveDataSource(databaseId: string): Promise<string> {
        const database = await this.client.databases.retrieve({ database_id: databaseId });
        if (!('data_sources' in database)) throw new RequestError('无法读取数据库数据源', 403);
        if (this.dataSourceId) {
            if (!database.data_sources.some(source => source.id.replace(/-/g, '') === this.dataSourceId!.replace(/-/g, ''))) {
                throw new RequestError('dataSourceId 不属于指定数据库');
            }
            return this.dataSourceId;
        }
        if (database.data_sources.length !== 1) throw new RequestError('该数据库包含多个数据源，请提供 dataSourceId', 409);
        return database.data_sources[0].id;
    }

    async retrieveDatabaseAllTags(databaseId: string): Promise<string[]> {
        const database = await this.retrieveDatabase(databaseId);
        return [...new Set(Object.values(database.properties).flatMap(property =>
            property.type === 'multi_select' ? property.multi_select.options.map(option => option.name) : []
        ))];
    }

    async retrieveDatabaseAllArea(databaseId: string, propertyName: string): Promise<RelationPage[]> {
        const database = await this.retrieveDatabase(databaseId);
        const property = database.properties[propertyName];
        if (!property || property.type !== 'relation') throw new RequestError('领域关联属性不存在');
        return this.getRelationOptions(property.relation.data_source_id);
    }

    // 基础数据库操作
    async retrieveDatabase(databaseId: string): Promise<DatabaseView> {
        try {
            const source = await this.client.dataSources.retrieve({ data_source_id: await this.resolveDataSource(databaseId) });
            const id = databaseId.replace(/-/g, '').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
            return { ...source, object: 'database', id, data_source_id: source.id };
        } catch (error) {
            this.handleError('查询数据库失败', error);
        }
    }

    async queryDatabase(databaseId: string, filter?: any): Promise<QueryDataSourceResponse> {
        try {
            const queryParams: any = { data_source_id: await this.resolveDataSource(databaseId) };
            if (filter) {
                queryParams.filter = filter;

            }
            const response = await this.client.dataSources.query(queryParams);
            return response;
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
                    throw new RequestError(`属性 "${request.name}" 不存在`);
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
            const parent = params.parent;
            if (parent && 'database_id' in parent) {
                params = { ...params, parent: { data_source_id: await this.resolveDataSource(parent.database_id) } };
            }
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
                detail.options = await this.getRelationOptions(property.relation.data_source_id);
                break;
        }

        return detail;
    }

    private async getRelationOptions(databaseId: string): Promise<Array<{ id: string; name: string }>> {
        const results: QueryDataSourceResponse['results'] = [];
        let cursor: string | undefined;
        do {
            const pages = await this.client.dataSources.query({ data_source_id: databaseId, start_cursor: cursor });
            results.push(...pages.results);
            cursor = pages.has_more ? pages.next_cursor ?? undefined : undefined;
        } while (cursor);
        return results
            .filter((page): page is PageObjectResponse => 'properties' in page)
            .map(page => ({
                id: page.id,
                name: this.getPageTitle(page)
            }))
            .filter(option => option.name); // 过滤掉没有标题的选项
    }

    private getPageTitle(page: PageObjectResponse): string {
        const titleProp = Object.values(page.properties).find(prop => prop.type === 'title');
        return titleProp?.type === 'title' ? titleProp.title.map(text => text.plain_text).join('') : '';
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
            throw new RequestError(
                `属性 "${request.name}" 类型不匹配，期望 "${request.type}"，实际 "${property.type}"`
            );
        }
    }

    private handleError(message: string, error: unknown): never {
        throw error;
    }
}

export default NotionService;
export type { RelationPage, PropertyRequest, PropertyDetail, DatabasePropertiesDetail };
