// 编写一个根据 URL 获取网页标题的方法 
import { load } from 'cheerio';
import OpenAI from "openai";
import {RelationPage} from '../services/notion.service'
const MAX_CONTENT_LENGTH = 10000; // 限制处理的内容长度

interface WebPageInfo {
    title: string;
    originContent: string;
    parseContent?: string;
}

async function getWebPageTitle(url: string): Promise<string | null> {
    const webPageInfo: WebPageInfo = await fetchWebPageInfo(url);
    return webPageInfo.title;
}

async function fetchWebPageInfo(url: string): Promise<WebPageInfo> {
    try {
        // 获取网页内容
        const html = await fetchWebPage(url);

        // 使用 Cheerio 只解析一次 HTML
        const $ = load(html);

        // 获取标题
        const title = $('title').text().trim() ||
            $('h1').first().text().trim() ||
            $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            'No title found';

        console.log('title:', title);
        const originContent = html;
        var parseContent = $('p').map((_, el) => $(el).text()).get().join("\n").slice(0, MAX_CONTENT_LENGTH);

        if (url.includes('jike')) {
            parseContent = await extractJikeTextFromHTML(html);
        }
        return {
            title,
            originContent,
            parseContent
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${url}`);
        }
        return await response.text();
    } catch (error) {
        console.error("Error fetching webpage:", error);
        throw error;
    }
}


// 分割文本函数
function splitText(text: string, maxLength: number): string[] {
    const sentences = text.split(/(?<=[。！？\n])/); // 按句号、感叹号、换行符分割
    const chunks: string[] = [];
    let currentChunk = "";

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
        apiKey: 'sk-7786e6f6e2ef464e8c2f5924641b6b28'
    });

    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // 或 "gpt-4"
        messages: [
            { role: "system", content: "You are a helpful assistant for text summarization." },
            { role: "user", content: `Summarize the following text: ${chunk}` },
        ],
    });
    return response.choices[0].message.content || "Failed to summarize.";
}

// 主函数：处理长文本
async function summarizeLongText(text: string): Promise<SummaryResult> {
    const chunks = splitText(text, MAX_CONTENT_LENGTH); // 分割文本
    console.log(`Text is split into ${chunks.length} chunks.`);

    const summaries: string[] = [];
    for (const chunk of chunks) {
        const summary = await summarizeChunk(chunk);
        summaries.push(summary);
    }

    // 对所有片段摘要再次整合进行最终摘要
    const combinedSummary = summaries.join(" ");
    const finalSummary = await summarizeChunk(combinedSummary);

    return {
        summary: finalSummary,
        tags: []
    };
}

interface SummaryResult {
    summary: string;
    tags: string[];
    area?: RelationPage;
}

interface SummaryExtentInfo {
    existingTags: string[];
    existingAreas?: RelationPage[];
}


async function summarizeText(text: string, summaryExtentInfo?: SummaryExtentInfo): Promise<SummaryResult> {
    try {
        const openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: 'sk-7786e6f6e2ef464e8c2f5924641b6b28'
        });

        const existingTags = summaryExtentInfo?.existingTags || [];
        const existingAreas = summaryExtentInfo?.existingAreas || [];
        const prompt = `Summarize the following text in Chinese and provide up to 5 relevant tags. 
                Prioritize using tags from the existing list if they are relevant. If the existing tags are not suitable, generate new ones. 
                The total number of tags should not exceed 5.
                
                Also, select the most appropriate area for this text from the existing areas list. If none of the existing areas are suitable, suggest a new one.

                Existing tags: ${JSON.stringify(existingTags)}
                Existing areas: ${JSON.stringify(existingAreas)}

                Return your response in the following JSON format:
                {
                    "summary": "Your summary here",
                    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
                    "area": {
                        "id": "ID of the area",
                        "name": "Name of the area"
                    }
                }
                
                Text to summarize: ${text}`;

        console.log("prompt: ", prompt);

        const completion = await openai.chat.completions.create({
            model: "deepseek-chat", // 或者 "gpt-4"
            messages: [
                { role: "system", content: "You are a helpful assistant for text summarization and tagging. Please provide your response in JSON format with 'summary' and 'tags' fields." },
                { role: "user", content: prompt},
            ],
        });
        const response = completion.choices[0].message.content;
        if (!response) {
            throw new Error("Failed to generate summary and tags.");
        }
        return JSON.parse(response);
    } catch (error) {
        console.error("Error during summarization and tagging:", error);
        return {
            summary: "An error occurred while summarizing the text.",
            tags: []
        };
    }
}


/**
 * 总结网页链接的内容
 * @param url 网页链接
 * @returns 
 */
async function summarizeWebPage(url: string): Promise<SummaryResult> {
    console.log("Fetching webpage...");
    const webPageInfo = await fetchWebPageInfo(url);
    return summarizeWebPageByContent(webPageInfo);
}


async function summarizeWebPageByContent(webPageInfo: WebPageInfo, summaryExtentInfo?: SummaryExtentInfo): Promise<SummaryResult> {
    try {
        console.log("Summarizing content...");
        const content = webPageInfo.parseContent || webPageInfo.originContent;
        if (content.length > MAX_CONTENT_LENGTH) {
            console.log("Content is too long, summarizing in chunks...");
            return summarizeLongText(content);
        }
        const summary: SummaryResult = await summarizeText(webPageInfo.parseContent || webPageInfo.originContent, summaryExtentInfo);
        console.log("Summary:", summary);
        return summary;
    } catch (error) {
        console.error("Error summarizing webpage:", error);
        return {
            summary: "An error occurred while summarizing the webpage.",
            tags: []
        };
    }
}


async function getFirstCoverImage(html: string): Promise<string | null> {
    const patterns = [
        /<meta\s+property="og:image"\s+content="(.*?)"/i,
        /<meta\s+name="twitter:image"\s+content="(.*?)"/i,
        /<img[^>]+class="[^"]*\b(?:cover|hero|banner)\b[^"]*"[^>]+src="(.*?)"/i,
        /<img[^>]+src="(.*?)"[^>]+class="[^"]*\b(?:cover|hero|banner)\b[^"]*"/i,
        /<img[^>]+src="(.*?)"/i
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

export { getWebPageTitle, summarizeWebPage, fetchWebPageInfo ,summarizeWebPageByContent, getFirstCoverImage};
export type { WebPageInfo, SummaryResult ,SummaryExtentInfo};
