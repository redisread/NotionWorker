// ./prisma/testCreate.ts

import { getWebPageTitle, summarizeWebPage, fetchWebPageInfo, WebPageInfo, getFirstCoverImage } from './web';
import {load} from 'cheerio';

import TurndownService from 'turndown';

// npx tsx ./src/utils/test.ts
async function fetchTitle() {

    const title1 = await getWebPageTitle('https://blog.loli.wang/blog/2024-07-06-cfd1prisma/doc/');
    console.log(title1);

    const title2 = await getWebPageTitle('https://mp.weixin.qq.com/s/ZIsPMvtEXVd__FhO9NTgpQ');
    console.log(title2);


    const title3 = await getWebPageTitle('https://m.okjike.com/originalPosts/67639c608d6dd8c09c2b8be8');
    console.log(title3);

    const title4 = await getWebPageTitle('https://blog.csdn.net/J080624/article/details/54345467');
    console.log(title4);

    const title5 = await getWebPageTitle('https://sspai.com/post/73645');
    console.log(title5);

    const title6 = await getWebPageTitle('https://guangzhengli.com/blog/zh/indie-hacker-tech-stack-2024/#cloudflare-worker');
    console.log(title6);
}

function extractTextFromHTML(html: string): string {
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


async function fetchContent() {
    const r: WebPageInfo = await fetchWebPageInfo('https://m.okjike.com/originalPosts/6767fcf38dc13469672f99a0');
    // const turndownService = new TurndownService();
    // turndownService.remove('div');
    // turndownService.remove('script');
    // // console.log("r: " + JSON.stringify(r));
    const parseContent = extractTextFromHTML(r.originContent);
    console.log(parseContent);

    // const content1 = await fetchWebPage('https://blog.loli.wang/blog/2024-07-06-cfd1prisma/doc/');
    // console.log(content1);
    // console.log(extractMainContent(content1));

    // const summarizeText = await summarizeWebPage('https://mp.weixin.qq.com/s/ZIsPMvtEXVd__FhO9NTgpQ');
    // console.log(summarizeText);

}


async function fetchWebCover(url: string) {
    const webInfo = await fetchWebPageInfo(url);
    console.log(webInfo);
    const response = await getFirstCoverImage(webInfo.originContent);
    console.log(response);
}

// fetchTitle()
fetchContent()
// fetchWebCover('https://blog.loli.wang/blog/2024-07-06-cfd1prisma/doc/');