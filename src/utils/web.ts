// 编写一个根据 URL 获取网页标题的方法 
import { load } from 'cheerio';
import OpenAI from "openai";

const MAX_CONTENT_LENGTH = 2000; // 限制处理的内容长度

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
        const parseContent = $('p').map((_, el) => $(el).text()).get().join("\n").slice(0, MAX_CONTENT_LENGTH);

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
async function summarizeLongText(text: string): Promise<string> {
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

    return finalSummary;
}


async function summarizeText(text: string): Promise<string> {
    try {
        const openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: 'sk-7786e6f6e2ef464e8c2f5924641b6b28'
        });
        const completion = await openai.chat.completions.create({
            model: "deepseek-chat", // 或者 "gpt-4"
            messages: [
                { role: "system", content: "You are a helpful assistant for text summarization." },
                { role: "user", content: `Summarize the following text with chinese: ${text}` },
            ],
        });

        const summary = completion.choices[0].message.content;
        return summary || "Failed to generate summary.";
    } catch (error) {
        console.error("Error during summarization:", error);
        return "An error occurred while summarizing the text.";
    }
}


/**
 * 总结网页链接的内容
 * @param url 网页链接
 * @returns 
 */
async function summarizeWebPage(url: string): Promise<string> {
    try {
        console.log("Fetching webpage...");
        const webPageInfo = await fetchWebPageInfo(url);

        console.log("Summarizing content...");

        const content = webPageInfo.parseContent || webPageInfo.originContent;
        if (content.length > MAX_CONTENT_LENGTH) {
            console.log("Content is too long, summarizing in chunks...");
            return summarizeLongText(content);
        } 
        const summary = await summarizeText(webPageInfo.parseContent || webPageInfo.originContent);
        return summary;
    } catch (error) {
        console.error("Error summarizing webpage:", error);
        return "Failed to summarize webpage.";
    }
}

export { getWebPageTitle, summarizeWebPage, fetchWebPageInfo };
export type { WebPageInfo };
