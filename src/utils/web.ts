import { RequestError } from '../errors';
// 编写一个根据 URL 获取网页标题的方法
import { load } from 'cheerio';
import OpenAI from 'openai';
import { RelationPage } from '../services/notion.service';
import { SummaryExtentInfo } from '../types/notion';

const MAX_CONTENT_LENGTH = 10000; // 限制处理的内容长度

interface WebPageInfo {
	title: string;
	originContent: string;
	parseContent?: string;
}


interface JinaPageParseInfo {
	
	code: number;
	status: number;
	data: 
	{
		url: string;
		content: string;
		title: string;
	};
}

async function getWebPageTitle(url: string): Promise<string | null> {
	const webPageInfo: WebPageInfo = await fetchWebPageInfo(url);
	return webPageInfo.title;
}

async function fetchWebPageInfo(url: string): Promise<WebPageInfo> {
	try {

        if (!url.includes('jike')) {
            try {
                const response = await fetch(`https://r.jina.ai/${url}`, {
                    headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000),
                });
                if (response.ok) {
                    const result = await response.json() as JinaPageParseInfo;
                    if (typeof result.data?.title === 'string' && typeof result.data?.content === 'string') {
                        return { title: result.data.title, originContent: result.data.content, parseContent: result.data.content };
                    }
                }
            } catch { /* Fall back to the public webpage if Reader is unavailable. */ }
        }

		// 获取网页内容
		const html = await fetchWebPage(url);

		// 使用 Cheerio 只解析一次 HTML
		const $ = load(html);

		// 获取标题
		const title =
			$('title').text().trim() ||
			$('h1').first().text().trim() ||
			$('meta[property="og:title"]').attr('content') ||
			$('meta[name="twitter:title"]').attr('content') ||
			'No title found';

		const originContent = html;
		var parseContent = $('p')
			.map((_, el) => $(el).text())
			.get()
			.join('\n')
			.slice(0, MAX_CONTENT_LENGTH);

		if (url.includes('jike')) {
			parseContent = await extractJikeTextFromHTML(html);
		}
		return {
			title,
			originContent,
			parseContent,
		};
	} catch (error) {
		throw new RequestError('网页内容获取失败，请稍后重试', 502);
	}
}

async function extractJikeTextFromHTML(html: string): Promise<string> {
	// 使用 cheerio 加载 HTML 字符串
	const $ = load(html);

	// 查找 .jsx-3930310120.wrap 元素
	const wrapElement = $('.jsx-3930310120.wrap');

	if (wrapElement.length > 0) {
		// 获取并返回元素中的纯文本内容（去除所有 HTML 标签）
		return wrapElement.text().trim();
	}

	return '';
}

async function fetchWebPage(url: string): Promise<string> {
	try {
		const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			},
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch URL: ${url}`);
		}
		return await response.text();

	} catch (error) {
		throw error;
	}
}


export interface SelectChoice {
	name: string;
	choice: string;
}

export interface MultiSelectChoice {
	name: string;
	choiceList: string[];
}

export interface RelationChoice {
	name: string;
	choice: {
		id: string;
		name: string;
	};
}

export interface SummaryResult {
	summary: string;
	select: SelectChoice[];
	multiSelect: MultiSelectChoice[];
	relation: RelationChoice[];
}

async function summarizeText(text: string, summaryExtentInfo?: SummaryExtentInfo, apiKey?: string): Promise<SummaryResult> {
	if (!apiKey) throw new RequestError('尚未配置 AI 摘要服务', 503);
	try {
		const openai = new OpenAI({
			baseURL: 'https://api.deepseek.com',
            timeout: 30000,
            maxRetries: 0,
			apiKey,
		});

		// 转换 selectOptions 为 map
		const selectOptionsMap = summaryExtentInfo?.selectOptions?.reduce((acc, curr) => {
			acc[curr.name] = curr.options.map((option) => option.name);
			return acc;
		}, {} as Record<string, string[]>) || {};

		// 转换 multiSelectOptions 为 map
		const multiSelectOptionsMap = summaryExtentInfo?.multiSelectOptions?.reduce((acc, curr) => {
			acc[curr.name] = curr.options.map((option) => option.name);
			return acc;
		}, {} as Record<string, string[]>) || {};

		// 转换 relationPages 为 map
		const relationPagesMap = summaryExtentInfo?.relationPages?.reduce((acc, curr) => {
			acc[curr.name] = curr.options.map((option) => option.name);
			return acc;
		}, {} as Record<string, string[]>) || {};

		const prompt = `Analyze the following text and provide a structured response:

1. Summarize the main content in Chinese.

2. For each select option provided, choose the most appropriate option:
${JSON.stringify(selectOptionsMap)}

3. For each multi-select option provided, choose up to 5 most relevant options. If suitable options are not found, suggest new ones:
${JSON.stringify(multiSelectOptionsMap)}

4. For each relation page provided, select the most appropriate one:
${JSON.stringify(summaryExtentInfo?.relationPages || [], null, 2)}

Return your response in the following JSON format:
{
    "summary": "Chinese summary here",
    "select": [{
        "name": "selectName",
        "choice": "selected option"
    }],
    "multiSelect": [{
        "name": "multiSelectName",
        "choiceList": ["option1", "option2", "option3", "option4", "option5"]
    }],
    "relation": [{
        "name": "relationName",
        "choice": {
            "id": "page_id",
            "name": "page_name"
        }
    }]
}

Text to analyze: ${text}`;

		const completion = await openai.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{
					role: 'system',
					content: 'You are a helpful assistant for content analysis and categorization. Please provide your response in JSON format.',
				},
				{ role: 'user', content: prompt },
			],
			response_format: {
				type: 'json_object',
			},
		});

		const response = completion.choices[0].message.content;
		if (!response) {
			throw new Error('Failed to generate analysis.');
		}

		return JSON.parse(response);
	} catch (error) {
		throw new RequestError('AI 摘要生成失败，请稍后重试', 502);
	}
}

/**
 * 总结网页链接的内容
 * @param url 网页链接
 * @returns
 */
async function summarizeWebPage(url: string, apiKey?: string): Promise<SummaryResult> {
	const webPageInfo = await fetchWebPageInfo(url);
	return summarizeWebPageByContent(webPageInfo, undefined, apiKey);
}

async function summarizeWebPageByContent(webPageInfo: WebPageInfo, summaryExtentInfo?: SummaryExtentInfo, apiKey?: string): Promise<SummaryResult> {
	try {
		const summary: SummaryResult = await summarizeText(webPageInfo.parseContent || webPageInfo.originContent, summaryExtentInfo, apiKey);
		return summary;
	} catch (error) {
		throw new RequestError('AI 摘要生成失败，请稍后重试', 502);
	}
}

async function getFirstCoverImage(html: string): Promise<string | null> {
	const patterns = [
		/<meta\s+property="og:image"\s+content="(.*?)"/i,
		/<meta\s+name="twitter:image"\s+content="(.*?)"/i,
		/<img[^>]+class="[^"]*\b(?:cover|hero|banner)\b[^"]*"[^>]+src="(.*?)"/i,
		/<img[^>]+src="(.*?)"[^>]+class="[^"]*\b(?:cover|hero|banner)\b[^"]*"/i,
		/<img[^>]+src="(.*?)"/i,
	];

	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match && match[1]) {
			// 解码 URL 以处理可能的编码字符
			return match[1];
		}
	}

	return null;
}


export { getWebPageTitle, summarizeWebPage, fetchWebPageInfo, summarizeWebPageByContent, getFirstCoverImage };
export type { WebPageInfo, SummaryExtentInfo };
