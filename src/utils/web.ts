// 编写一个根据 URL 获取网页标题的方法 
import { load } from 'cheerio';

async function getWebPageTitle(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();

        // 使用 cheerio 解析 HTML
        const $ = load(html);

        // 尝试获取 title 标签内容
        let title = $('title').text().trim();

        // 如果没有找到 title，尝试其他常见的标题元素
        if (!title) {
            title = $('h1').first().text().trim() ||
                $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                '';
        }

        // 对特定网站进行定制处理
        if (url.includes('example.com')) {
            // 假设 example.com 使用特定的 div 作为标题
            title = $('#dynamic-title').text().trim() || title;
        }
        return title;
    } catch (error) {
        console.error('Error fetching web page:', error);
        return null;
    }
}

export { getWebPageTitle };
