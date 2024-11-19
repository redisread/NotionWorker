const { Client } = require('@notionhq/client');
import { load } from 'cheerio';

async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        }
    });
    if (response.ok) {
        const html = await response.text();
        return html;
    } else {
        throw new Error('Failed to fetch the HTML content');
    }
}

async function fetchPageTitle(url) {
    try {
        const html = await fetchHtml(url);
        const $ = load(html);
        const title = $('title').text();
        if (!title) {
            console.log("title is null , try to get title from weixin meta tag");
            if (url.includes('weixin.qq.com')) {
                return await getPageTitleForWeixin(html);
            }
            
        }
        return title;
    } catch (error) {
        console.error(`Error fetching title: ${error.message}`);
        return null;
    }
}


async function getPageTitleForWeixin(html) {
    const regex = /<meta\s+property="og:title"\s+content="(.*?)"\s*\/?>/i;
    const match = html.match(regex);
    const title = match ? match[1] : null;
    return title;
}



async function getRequestParentBody(databaseId) {
    return {
        "type": "database_id",
        "database_id": `${databaseId}`
    };
}


async function getRequestProps(props, url, title) {
    var propsBody = {}
    props.forEach((prop) => {
        const name = prop.name;
        const type = prop.type;
        if (type == "url") {
            if (!prop.value) {
                prop.value = url;
            }
        }
        if (type == "title") {
            if (!prop.value) {
                prop.value = title;
            }
        }
    });
    props.forEach((prop) => {
        const name = prop.name;
        const type = prop.type;
        const value = prop.value;
        if (type == "select") {
            propsBody[name] ={
                "select": {
                    "name": value
                }
            }
        } else if (type == "title") {
            propsBody[name] = {
                "title": [
                    {
                        "text": {
                            "content": value
                        }
                    }
                ]
            }
        } else if (type == "url") {
            propsBody[name] = {
                "url": value
            }
        } else if (type == 'multi_select') {
            var multi_select_list;
            if (typeof value === 'string') {
                multi_select_list = value.split("\n").map((item) => {
                    return { "name": item }
                });
            } else {
                multi_select_list = value.map((item) => {
                    return { "name": item }
                });
            }
            propsBody[name] = {
                "multi_select": multi_select_list
            }
        } else if (type == 'rich_text') {
            const text = value ? value: title;
            propsBody[name] = {
                "rich_text": [{
                    "text": {
                        "content": text
                    }
                }]
            }
        } else if (type == 'number') {
            propsBody[name] = {
                "number": parseInt(value)
            }
        }
    });

    return propsBody;
}

async function getAddPageRequestContent(databaseId, url, title, props) {
    var requestBody = {}
    requestBody.parent = await getRequestParentBody(databaseId);
    requestBody.properties = await getRequestProps(props, url, title);
    return requestBody;
}


async function createPage(ctx, notionApiKey, databaseId, url, props) {
    const title = await fetchPageTitle(url);
    console.log("title: " + title);
    const requestBody = await getAddPageRequestContent(databaseId, url, title, props);
    console.log("requestBody: " + JSON.stringify(requestBody));
    const notion = new Client({ auth: notionApiKey });
    const r = await notion.pages.create(requestBody).then((response) => {console.log(response);});
    return ctx.text(`创建成功 --- ${title}`)
}



let deal = async (ctx) => {
    const { notionApiKey, databaseId, url, props } = await ctx.req.json();
    console.log("request json: " + JSON.stringify(await ctx.req.json()));
    console.log(`notionApiKey: ${notionApiKey} databaseId: ${databaseId} url: ${url} props: ${props}`);
    return await createPage(ctx, notionApiKey, databaseId, url, props);
};


let setup = (route) => {
    route.post('/addPage', (
        ctx => {
            return deal(ctx);
        }
    ));
};


export default { setup };