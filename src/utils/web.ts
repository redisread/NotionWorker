import { RequestError } from '../errors';
// 编写一个根据 URL 获取网页标题的方法
import { load } from 'cheerio';

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


export { getWebPageTitle, fetchWebPageInfo, getFirstCoverImage };
export type { WebPageInfo };
