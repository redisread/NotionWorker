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
			// 获取网页内容
			const jinaContent = await fetchLLMMarkdownContent(url);
			const jinaPageParseInfo: JinaPageParseInfo = JSON.parse(jinaContent);

			const jinaContentMarkdown = await fetchMarkdownContent(url);
			const jinaMarkdownPageParseInfo: JinaPageParseInfo = JSON.parse(jinaContentMarkdown);


			return {
				title: jinaPageParseInfo.data.title,
				originContent: jinaMarkdownPageParseInfo.data.content,
				parseContent: jinaPageParseInfo.data.content,
			};
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

		console.log('title:', title);
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
		console.error('Error fetching web page info:', error);
		throw new Error(`Failed to fetch web page info: ${error instanceof Error ? error.message : String(error)}`);
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
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
			},
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch URL: ${url}`);
		}
		return await response.text();

	} catch (error) {
		console.error('Error fetching webpage:', error);
		throw error;
	}
}


async function fetchLLMMarkdownContent(url: string): Promise<string> {
    const proxyUrl = 'https://r.jina.ai/';
    const fullUrl = `${proxyUrl}${encodeURIComponent(url)}`;

	// 'x-return-format:': 'true',
    const headers = {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    };

    try {
        const response = await fetch(fullUrl, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
		const text = await response.text();
		console.log('response:', text);
        return text;
    } catch (error) {
        console.error('Error fetching web content:', error);
        throw error;
    }
}



async function fetchMarkdownContent(url: string): Promise<string> {
    const proxyUrl = 'https://r.jina.ai/';
    const fullUrl = `${proxyUrl}${encodeURIComponent(url)}`;

	// 'x-return-format:': 'true',
    const headers = {
        'accept': 'application/json',
		'x-return-format': 'html',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    };

    try {
        const response = await fetch(fullUrl, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
		const text = await response.text();
		// console.log('response:', text);
        return text;
    } catch (error) {
        console.error('Error fetching web content:', error);
        throw error;
    }
}


// 分割文本函数
function splitText(text: string, maxLength: number): string[] {
	const sentences = text.split(/(?<=[。！？\n])/); // 按句号、感叹号、换行符分割
	const chunks: string[] = [];
	let currentChunk = '';

	for (const sentence of sentences) {
		if ((currentChunk + sentence).length > maxLength) {
			chunks.push(currentChunk);
			currentChunk = sentence; // 开始新的片段
		} else {
			currentChunk += sentence; // 追加到当前片段
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk); // 添加最后的片段
	}

	return chunks;
}

// 调用 OpenAI 生成摘要
async function summarizeChunk(chunk: string): Promise<string> {
	const openai = new OpenAI({
		baseURL: 'https://api.deepseek.com',
		apiKey: 'sk-7786e6f6e2ef464e8c2f5924641b6b28',
	});

	const response = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo', // 或 "gpt-4"
		messages: [
			{ role: 'system', content: 'You are a helpful assistant for text summarization.' },
			{ role: 'user', content: `Summarize the following text: ${chunk}` },
		],
	});
	return response.choices[0].message.content || 'Failed to summarize.';
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

async function summarizeText(text: string, summaryExtentInfo?: SummaryExtentInfo): Promise<SummaryResult> {
	try {
		const openai = new OpenAI({
			baseURL: 'https://api.deepseek.com',
			apiKey: 'sk-7786e6f6e2ef464e8c2f5924641b6b28',
		});

		// 转换 selectOptions 为 map
		const selectOptionsMap = summaryExtentInfo?.selectOptions?.reduce((acc, curr) => {
			acc[curr.name] = curr.options.map((option) => option.name);
			return acc;
		}, {} as Record<string, string[]>) || {};
		console.log('selectOptionsMap:', selectOptionsMap);

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

		console.log('prompt:', prompt);
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

		console.log('ai response:', response);
		return JSON.parse(response);
	} catch (error) {
		console.error('Error during content analysis:', error);
		return {
			summary: 'An error occurred while analyzing the text.',
			select: [],
			multiSelect: [],
			relation: []
		};
	}
}

/**
 * 总结网页链接的内容
 * @param url 网页链接
 * @returns
 */
async function summarizeWebPage(url: string): Promise<SummaryResult> {
	console.log('Fetching webpage...');
	const webPageInfo = await fetchWebPageInfo(url);
	return summarizeWebPageByContent(webPageInfo);
}

async function summarizeWebPageByContent(webPageInfo: WebPageInfo, summaryExtentInfo?: SummaryExtentInfo): Promise<SummaryResult> {
	try {
		console.log('Summarizing content...');
		const summary: SummaryResult = await summarizeText(webPageInfo.parseContent || webPageInfo.originContent, summaryExtentInfo);
		console.log('Summary:', summary);
		return summary;
	} catch (error) {
		console.error('Error summarizing webpage:', error);
		return {
			summary: 'An error occurred while summarizing the webpage.',
			select: [],
			multiSelect: [],
			relation: []
		};
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
