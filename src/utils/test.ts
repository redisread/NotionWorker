// ./prisma/testCreate.ts

import { getWebPageTitle, summarizeWebPage, fetchWebPageInfo, WebPageInfo } from './web';


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
}



async function fetchContent() {
//     const r: WebPageInfo = await fetchWebPageInfo('https://blog.loli.wang/blog/2024-07-06-cfd1prisma/doc/');
//     console.log(JSON.stringify(r, null, 2));

    // const content1 = await fetchWebPage('https://blog.loli.wang/blog/2024-07-06-cfd1prisma/doc/');
    // console.log(content1);
    // console.log(extractMainContent(content1));

    const summarizeText = await summarizeWebPage('https://mp.weixin.qq.com/s/ZIsPMvtEXVd__FhO9NTgpQ');
    console.log(summarizeText);

}

// fetchTitle()
fetchContent()