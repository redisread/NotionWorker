// 该库用于获取网页标题
import { load } from 'cheerio';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})


// 这两个作为入参传过来
// Notion的token，配置选择对应的database写入权限
// const NOTION_API_KEY = 'secret_dBdkIIPXAnbM1IAQLNMd9cg6cUbfPXy0wFezX5XEEud'
// 写入database的id
// const DATABASE_ID = 'e0e1dd7d81f24ac1915522c02666bda7'

async function handleRequest(request) {
  if (request.method === 'POST') {
    // 从请求中获取相关信息
    const { NOTION_API_KEY, DATABASE_ID, title, articleUrl, type } = await request.json()

    if (!NOTION_API_KEY) {
      return new Response('入参缺少: NOTION_API_KEY', { status: 400 })
    }
    if (!DATABASE_ID) {
      return new Response('入参缺少: DATABASE_ID', { status: 400 })
    }
    if (!articleUrl) {
      return new Response('入参缺少: articleUrl', { status: 400 })
    }
    if (title) {
      // 如果传了标题，使用传入标题创建 Notion Page
      const createPageResponse = await createPage(NOTION_API_KEY, DATABASE_ID, title, articleUrl, type)
      return new Response(`创建[${title}]成功`, {
        headers: { 'content-type': 'application/json' },
      })
    } else {
      // 使用url获取标题创建 Notion Page
      var articleTitle = await getTitle(articleUrl);
      articleTitle = articleTitle.replace(/[\s\n]/g, "");
      const createPageResponse = await createPage(NOTION_API_KEY, DATABASE_ID, articleTitle, articleUrl, type)
      return new Response(`创建[${articleTitle}]成功`, {
        headers: { 'content-type': 'application/json' },
      })
    }
  } else if (request.method = 'GET') {
    const pageTitle = await getTitle("https://sspai.com/post/78322");
    console.log(pageTitle);
    return new Response(pageTitle, { status: 200 })

  } else {
    return new Response('Method not supported', { status: 405 })
  }
}


async function fetchHtml(url) {
  const response = await fetch(url);
  if (response.ok) {
    const html = await response.text();
    return html;
  } else {
    throw new Error('Failed to fetch the HTML content');
  }
}

async function getTitle(url) {
  try {
    const html = await fetchHtml(url);
    const $ = load(html);
    const title = $('title').text();
    return title;
  } catch (error) {
    console.error(`Error fetching title: ${error.message}`);
    return null;
  }
}


async function createPage(NOTION_API_KEY, DATABASE_ID, title, infoUrl, type) {
  const url = `https://api.notion.com/v1/pages`

  const headers = {
    'content-type': 'application/json',
    'Notion-Version': '2022-06-28',
    'Authorization': `Bearer ${NOTION_API_KEY}`,
  }

  const requestBody = {
    "parent": {
      "database_id": `${DATABASE_ID}`
    },
    "properties": {
      "title": {
        "title": [
          {
            "text": {
              "content": `${title}`
            }
          }
        ]
      },
      "类型": {
        "select": {
          "name": `${type}`
        }
      },
      "卡片类型": {
        "select": {
          "name": "文献笔记"
        }
      },
      "URL": {
        "url": `${infoUrl}`
      }
    }
  };
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  if (response.ok) {
    const data = await response.json()
    return JSON.stringify(data, null, 2)
  } else {
    throw new Error(`Error creating page: ${response.statusText}`)
  }
}