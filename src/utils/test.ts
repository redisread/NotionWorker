// ./prisma/testCreate.ts

import { getWebPageTitle } from './web';


async function main() {

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

main()