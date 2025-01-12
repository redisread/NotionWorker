import { Client } from '@notionhq/client';
import { Context, Hono } from 'hono';
//  https://shortcut.jiahongw.com/notion/addPage
import { GetDatabaseResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import NotionService, { RelationPage } from '../services/notion.service';
import { CreatePageParameters, BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import { fetchWebPageInfo, getWebPageTitle, summarizeWebPageByContent, WebPageInfo, SummaryExtentInfo, SummaryResult } from '../utils/web';
import { DatabasePropertiesDetail } from '../services/notion.service';
import { PropertyValue } from '../types/notion';
import { PropertyDetail } from '../types/notion';
import { SelectChoice, MultiSelectChoice, RelationChoice } from '../utils/web';

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
		console.error('Error querying page:', error);
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
    // props 中 type 为 title 的属性，value 为 webPageInfo.title
    const titleProp = props?.find((prop: PropertyValue) => prop.type === 'title');
    if (!titleProp.value) {
        titleProp.value = webPageInfo.title;
    }
	console.log(`get webPageInfo: ` + JSON.stringify(webPageInfo));
	try {
		const properties: Record<string, any> = {};
		// 处理 props
		if (props && Array.isArray(props)) {
			props.forEach((prop) => {
				if (!prop.value) {
					return;
				}
				switch (prop.type) {
					case 'select':
						properties[prop.name] = {
							select: { name: prop.value },
						};
						break;
					case 'url':
						properties[prop.name] = {
							url: prop.value ? prop.value : url,
						};
						break;
					case 'title':
						properties[prop.name] = {
							title: [{ text: { content: prop.value ? prop.value : title } }],
						};
						break;
					case 'multi_select':
						var multi_select_list = [];  // 默认为空数组
						if (prop.value) {  // 首先检查 value 是否存在
							if (typeof prop.value === 'string') {
								multi_select_list = prop.value.split('\n').map((item: string) => ({
									name: item.trim()
								}));
							} else if (Array.isArray(prop.value)) {
								multi_select_list = prop.value.map((item: string) => ({
									name: item.trim()
								}));
							}
						}
						properties[prop.name] = {
							multi_select: multi_select_list
						};
						break;
					case 'rich_text':
						properties[prop.name] = {
							rich_text: [{ text: { content: prop.value } }],
						};
					// 可以根据需要添加更多类型的处理
				}
			});
		}

		const requestBody: CreatePageParameters = {
			parent: { database_id: databaseId },
			properties: properties,
		};

		let summaryResult: SummaryResult | undefined;
		// 如果 needSummarize 为 true，则添加摘要到正文children
		if (needSummarize) {
			// 从 props 获取 multi_select、select、relation 的参数列表 ，转换成 PropertyRequest[]
			const propertyRequestList = props
				.filter((prop: PropertyValue) => prop.type === 'multi_select' || prop.type === 'select' || prop.type === 'relation')
				.map((prop: PropertyValue) => ({
					name: prop.name,
					type: prop.type,
				}));
			console.log('propertyRequestList:', propertyRequestList);
			const databasePropertiesDetail: DatabasePropertiesDetail = await notionService.retrieveDatabasePropertyDetails(
				databaseId,
				propertyRequestList
			);
			// databasePropertiesDetail 转换成  SummaryExtentInfo
			const summaryExtentInfo: SummaryExtentInfo = {
				selectOptions: extractPropertyDetails(databasePropertiesDetail.properties, 'select'),
				multiSelectOptions: extractPropertyDetails(databasePropertiesDetail.properties, 'multi_select'),
				relationPages: extractPropertyDetails(databasePropertiesDetail.properties, 'relation')
			};
            console.log('summaryExtentInfo:', JSON.stringify(summaryExtentInfo));
			summaryResult = await summarizeWebPageByContent(webPageInfo, summaryExtentInfo);
			if (summaryResult) {
				// 构建页面内容块
				const contentBlocks: BlockObjectRequest[] = [];
				// 添加摘要块
				if (summaryResult.summary) {
					contentBlocks.push({
						type: 'paragraph',
						paragraph: {
							rich_text: [
								{
									type: 'text',
									text: { content: `摘要:\n${summaryResult.summary}` },
								},
							],
						},
					});
				}

				// 添加select块
				if (summaryResult.select && summaryResult.select?.length > 0) {
					summaryResult.select.forEach((select: SelectChoice) => {
						// 更新页面属性中的select选项
						// 如果prop里面有select选项，且value有值，这里则不更新
						if (!(props && props.some((prop: PropertyValue) => prop.type === 'select' && prop.name === select.name && prop.value))) {
							requestBody.properties[select.name] = {
								select: { name: select.choice },
							};
						}
						// contentBlocks.push({
						// 	type: 'paragraph',
						// 	paragraph: {
						// 		rich_text: [{ type: 'text', text: { content: `selectName:\n${select.name}  selectValue:\n${select.choice}` } }],
						// 	},
						// });
					});
				}

				// 添加multiSelect块
				if (summaryResult.multiSelect && summaryResult.multiSelect?.length > 0) {
					// 更新页面属性中的multiSelect选项
					summaryResult.multiSelect.forEach((multiSelect: MultiSelectChoice) => {
						// 如果prop里面有multiSelect选项，且value有值，这里则不更新
						if (
							!(props && props.some((prop: PropertyValue) => prop.type === 'multi_select' && prop.name === multiSelect.name && prop.value))
						) {
							requestBody.properties[multiSelect.name] = {
								multi_select: multiSelect.choiceList.map((choice: string) => ({ name: choice })),
							};
						}
					});
					// summaryResult.multiSelect.forEach((multiSelect: MultiSelectChoice) => {
					// 	contentBlocks.push({
					// 		type: 'paragraph',
					// 		paragraph: {
					// 			rich_text: [
					// 				{
					// 					type: 'text',
					// 					text: { content: `multiSelectName:\n${multiSelect.name}  multiSelectValue:\n${multiSelect.choiceList.join(', ')}` },
					// 				},
					// 			],
					// 		},
					// 	});
					// });
				}

				// 添加relation块
				if (summaryResult.relation && summaryResult.relation?.length > 0) {
					// 更新页面属性中的relation选项
					summaryResult.relation.forEach((relation: RelationChoice) => {
						// 如果prop里面有relation选项，且value有值，这里则不更新
						if (!(props && props.some((prop: PropertyValue) => prop.type === 'relation' && prop.name === relation.name && prop.value))) {
							
							// get relation page id by summaryExtentInfo relation options
							const relationPage = summaryExtentInfo.relationPages?.find((relationPage: PropertyOptions) => relationPage.name === relation.name);
							const choicePage = relationPage?.options.find((option) => option.name === relation.choice.name);
							requestBody.properties[relation.name] = {
								relation: [{ id: choicePage?.id || '' }],
							};
						}
						// contentBlocks.push({
						// 	type: 'paragraph',
						// 	paragraph: {
						// 		rich_text: [
						// 			{ type: 'text', text: { content: `relationName:\n${relation.name}  relationValue:\n${relation.choice.name}` } },
						// 		],
						// 	},
						// });
					});
				}
				// 将所有内容块添加到请求体
				if (contentBlocks.length > 0) {
					requestBody.children = contentBlocks;
				}
			}
		}

		const response = await notionService.createPage(requestBody);
		return ctx.json({
			title: webPageInfo.title,
			properties: requestBody.properties,
			summary: summaryResult?.summary || '',
		});
	} catch (error) {
		console.error('Error creating page:', error);
		return ctx.json({ error: `创建失败: ${error instanceof Error ? error.message : String(error)}` }, 500);
	}
}

async function preparePage(ctx: Context): Promise<Response> {
	const { notionApiKey, databaseId, url, props, needSummarize } = await ctx.req.json();
	console.log(`notionApiKey: ${notionApiKey}, databaseId: ${databaseId}, url: ${url} props: ${JSON.stringify(props)}`);
	const notionService: NotionService = new NotionService(notionApiKey);
	var title: string | null;
	const webPageInfo: WebPageInfo = await fetchWebPageInfo(url);
	title = webPageInfo.title;
    // props 中 type 为 title 的属性，value 为 webPageInfo.title
    const titleProp = props?.find((prop: PropertyValue) => prop.type === 'title');
    if (!titleProp.value) {
        titleProp.value = webPageInfo.title;
    }
	console.log(`get webPageInfo: ` + JSON.stringify(webPageInfo));
	try {
		const properties: Record<string, any> = {};
		// 处理 props
		if (props && Array.isArray(props)) {
			props.forEach((prop) => {
				if (!prop.value) {
					return;
				}
				switch (prop.type) {
					case 'select':
						properties[prop.name] = {
							select: { name: prop.value },
						};
						break;
					case 'url':
						properties[prop.name] = {
							url: prop.value ? prop.value : url,
						};
						break;
					case 'title':
						properties[prop.name] = {
							title: [{ text: { content: prop.value ? prop.value : title } }],
						};
						break;
					case 'multi_select':
						var multi_select_list = [];  // 默认为空数组
						if (prop.value) {  // 首先检查 value 是否存在
							if (typeof prop.value === 'string') {
								multi_select_list = prop.value.split('\n').map((item: string) => ({
									name: item.trim()
								}));
							} else if (Array.isArray(prop.value)) {
								multi_select_list = prop.value.map((item: string) => ({
									name: item.trim()
								}));
							}
						}
						properties[prop.name] = {
							multi_select: multi_select_list
						};
						break;
					case 'rich_text':
						properties[prop.name] = {
							rich_text: [{ text: { content: prop.value } }],
						};
					// 可以根据需要添加更多类型的处理
				}
			});
		}

		const requestBody: CreatePageParameters = {
			parent: { database_id: databaseId },
			properties: properties,
		};

		let summaryResult: SummaryResult | undefined;
		// 如果 needSummarize 为 true，则添加摘要到正文children
		if (needSummarize) {
			// 从 props 获取 multi_select、select、relation 的参数列表 ，转换成 PropertyRequest[]
			const propertyRequestList = props
				.filter((prop: PropertyValue) => prop.type === 'multi_select' || prop.type === 'select' || prop.type === 'relation')
				.map((prop: PropertyValue) => ({
					name: prop.name,
					type: prop.type,
				}));
			console.log('propertyRequestList:', propertyRequestList);
			const databasePropertiesDetail: DatabasePropertiesDetail = await notionService.retrieveDatabasePropertyDetails(
				databaseId,
				propertyRequestList
			);
			// databasePropertiesDetail 转换成  SummaryExtentInfo
			const summaryExtentInfo: SummaryExtentInfo = {
				selectOptions: extractPropertyDetails(databasePropertiesDetail.properties, 'select'),
				multiSelectOptions: extractPropertyDetails(databasePropertiesDetail.properties, 'multi_select'),
				relationPages: extractPropertyDetails(databasePropertiesDetail.properties, 'relation')
			};
            console.log('summaryExtentInfo:', JSON.stringify(summaryExtentInfo));
			summaryResult = await summarizeWebPageByContent(webPageInfo, summaryExtentInfo);
			if (summaryResult) {
				// 构建页面内容块
				const contentBlocks: BlockObjectRequest[] = [];
				// 添加摘要块
				if (summaryResult.summary) {
					contentBlocks.push({
						type: 'paragraph',
						paragraph: {
							rich_text: [
								{
									type: 'text',
									text: { content: `摘要:\n${summaryResult.summary}` },
								},
							],
						},
					});
				}

				// 添加select块
				if (summaryResult.select && summaryResult.select?.length > 0) {
					summaryResult.select.forEach((select: SelectChoice) => {
						// 更新页面属性中的select选项
						// 如果prop里面有select选项，且value有值，这里则不更新
						if (!(props && props.some((prop: PropertyValue) => prop.type === 'select' && prop.name === select.name && prop.value))) {
							requestBody.properties[select.name] = {
								select: { name: select.choice },
							};
						}
					});
				}

				// 添加multiSelect块
				if (summaryResult.multiSelect && summaryResult.multiSelect?.length > 0) {
					// 更新页面属性中的multiSelect选项
					summaryResult.multiSelect.forEach((multiSelect: MultiSelectChoice) => {
						// 如果prop里面有multiSelect选项，且value有值，这里则不更新
						if (
							!(props && props.some((prop: PropertyValue) => prop.type === 'multi_select' && prop.name === multiSelect.name && prop.value))
						) {
							requestBody.properties[multiSelect.name] = {
								multi_select: multiSelect.choiceList.map((choice: string) => ({ name: choice })),
							};
						}
					});
				}

				// 添加relation块
				if (summaryResult.relation && summaryResult.relation?.length > 0) {
					// 更新页面属性中的relation选项
					summaryResult.relation.forEach((relation: RelationChoice) => {
						// 如果prop里面有relation选项，且value有值，这里则不更新
						if (!(props && props.some((prop: PropertyValue) => prop.type === 'relation' && prop.name === relation.name && prop.value))) {
							requestBody.properties[relation.name] = {
								relation: [{ id: relation.choice.id }],
							};
						}
					});
				}
				// 将所有内容块添加到请求体
				if (contentBlocks.length > 0) {
					requestBody.children = contentBlocks;
				}
			}
		}


		// convert summaryResult?.select to map,name is key, choice is value
		const multiSelectMap = summaryResult?.multiSelect?.reduce((acc, curr) => {
			acc[curr.name] = curr.choiceList;
			return acc;
		  }, {} as Record<string, string[]>) || {};
		// Convert select to map structure
		const selectMap = summaryResult?.select?.reduce((acc, curr) => {
			acc[curr.name] = curr.choice;
			return acc;
		}, {} as Record<string, string>) || {};

		const relationMap = summaryResult?.relation?.reduce((acc, curr) => {
			acc[curr.name] = curr.choice.name;
			return acc;
		}, {} as Record<string, string>) || {};
  
		return ctx.json({
			title: webPageInfo.title,
			select: selectMap,
			multiSelect: multiSelectMap,
			relation: relationMap,
			summary: summaryResult?.summary || '',
		});
	} catch (error) {
		console.error('Error preparing page:', error);
		return ctx.json({ error: `准备失败: ${error instanceof Error ? error.message : String(error)}` }, 500);
	}
}

const pageRouter = new Hono();
pageRouter.post('/retrieve', retrievePage);
pageRouter.post('/create', createPage);
pageRouter.post('/prepare', preparePage);

export default pageRouter;

interface PropertyOptions {
  name: string;
  options: Array<{name: string, id: string}>;
}

function extractPropertyDetails(properties: Record<string, PropertyDetail>, type: string): PropertyOptions[] {
	return Object.values(properties)
		.filter(prop => prop.type === type)
		.map(({ name, options = [] }) => ({
			name,
			options: options?.map(opt => ({ name: opt.name, id: opt.id })) || []
		}));
}
