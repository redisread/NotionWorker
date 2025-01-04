/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import pageRouter from './routes/page';
import databaseRouter from './routes/database';
import { summarizeWebPage, SummaryResult } from './utils/web'
export interface Env {
  // If you set another name in wrangler.toml as the value for 'binding',
  // replace "AI" with the variable name you defined.
  AI: Ai;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => {
  const name = 'World';
  return c.html(`
	  <html>
		<body>
		  <h1>Hello ${name}</h1>
		</body>
	  </html>
	`);
});

const notFoundHtml = `
  <html>
    <head>
      <title>404 Not Found</title>
    </head>
    <body>
      <h1>404 Not Found</h1>
      <p>The requested URL was not found on this server.</p>
    </body>
  </html>
`;
app.notFound((c) => c.html(notFoundHtml));


const errorHtmlTemplate = `
  <html>
    <head>
      <title>Error</title>
    </head>
    <body>
      <h1>Error</h1>
      <p>{ERROR_MESSAGE}</p>
      <pre>{ERROR_STACK}</pre>
    </body>
  </html>
`;

app.onError((err, c) => {
  const stackArr = err.stack?.split('\n').join('<br>') || '';
  const result = errorHtmlTemplate
    .replace('{ERROR_MESSAGE}', err.message)
    .replace('{ERROR_STACK}', stackArr);
  return c.html(result, 500);
});

app.use('/*', cors());


app.route('/notion/page', pageRouter);
app.route('/notion/database', databaseRouter);

app.post('/notion/ai', async (c) => {
  // const response = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
  //   prompt: "如何整理笔记？",
  // });
  const { url } = await c.req.json();

  const response: SummaryResult = await summarizeWebPage(url);
  return new Response(JSON.stringify(response));
});

app.get('/notion/query', (c) => {
  return c.html(`
    <html>
      <head>
        <title>Notion Database Query</title>
        <style>
          body { padding: 20px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; }
          input { width: 100%; padding: 8px; margin-bottom: 10px; }
          button { padding: 10px 15px; background: #0070f3; color: white; border: none; cursor: pointer; }
          #result { margin-top: 20px; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>Notion Database Query</h1>
        <div class="form-group">
          <label for="token">Notion Token:</label>
          <input type="password" id="token" required>
        </div>
        <div class="form-group">
          <label for="databaseId">Database ID:</label>
          <input type="text" id="databaseId" required>
        </div>
        <button onclick="queryDatabase()">查询</button>
        <pre id="result"></pre>

        <script>
          async function queryDatabase() {
            const token = document.getElementById('token').value;
            const databaseId = document.getElementById('databaseId').value;
            const resultDiv = document.getElementById('result');
            
            try {
              const response = await fetch('/notion/database/retrieve', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  notionApiKey: token,
                  databaseId: databaseId
                })
              });
              
              const data = await response.json();
              resultDiv.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
              resultDiv.textContent = '查询失败: ' + error.message;
            }
          }
        </script>
      </body>
    </html>
  `);
});

app.get('/notion/pages', (c) => {
  return c.html(`
    <html>
      <head>
        <title>Notion Pages Query</title>
        <style>
          body { padding: 20px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; }
          input { width: 100%; padding: 8px; margin-bottom: 10px; }
          button { padding: 10px 15px; background: #0070f3; color: white; border: none; cursor: pointer; }
          #result { margin-top: 20px; }
          .page-item { margin-bottom: 10px; padding: 10px; border: 1px solid #eee; cursor: pointer; transition: all 0.2s ease; text-decoration: none; color: inherit; display: block; }
          .page-item:hover { background-color: #f5f5f5; border-color: #0070f3; transform: translateY(-2px); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .page-title { font-weight: bold; }
          .filter-group { display: flex; gap: 10px; margin-bottom: 15px; }
          .filter-group input { width: auto; }
          .page-content {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            max-height: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        </style>
      </head>
      <body>
        <h1>Notion Pages Query</h1>
        <div class="form-group">
          <label for="token">Notion Token:</label>
          <input type="password" id="token" required>
        </div>
        <div class="form-group">
          <label for="databaseId">Database ID:</label>
          <input type="text" id="databaseId" required>
        </div>
        <div class="form-group">
          <label for="dateProp">日期属性名称:</label>
          <input type="text" id="dateProp" placeholder="输入日期类型的属性名">
        </div>
        <div class="filter-group">
          <div>
            <label for="startDate">开始日期:</label>
            <input type="date" id="startDate">
          </div>
          <div>
            <label for="endDate">结束日期:</label>
            <input type="date" id="endDate">
          </div>
        </div>
        <button onclick="queryPages()">查询页面</button>
        <div id="result"></div>

        <script>
          async function queryPages() {
            const token = document.getElementById('token').value;
            const databaseId = document.getElementById('databaseId').value;
            const dateProp = document.getElementById('dateProp').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const resultDiv = document.getElementById('result');
            
            try {
              const filter = {};
              if (dateProp && (startDate || endDate)) {
                filter.and = [];
                if (startDate) {
                  filter.and.push({
                    property: dateProp,
                    date: {
                      after: startDate + 'T00:00:00.000Z'
                    }
                  });
                }
                if (endDate) {
                  filter.and.push({
                    property: dateProp,
                    date: {
                      before: endDate + 'T23:59:59.999Z'
                    }
                  });
                }
              }

              const response = await fetch('/notion/database/query', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  notionApiKey: token,
                  databaseId: databaseId,
                  filter: Object.keys(filter).length > 0 ? filter : undefined
                })
              });
              
              const data = await response.json();
              
              resultDiv.innerHTML = '<h2>查询结果：</h2>';
              if (data.results && data.results.length > 0) {
                const pagesHtml = data.results.map(page => {
                  const title = getPageTitle(page);
                  const dateValue = getPropertyValue(page, dateProp);
                  const content = getPageContent(page);
                  const pageUrl = \`https://notion.so/\${page.id.replace(/-/g, '')}\`;
                  
                  return \`
                    <a href="\${pageUrl}" class="page-item" target="_blank" rel="noopener noreferrer">
                      <div class="page-title">标题: \${title}</div>
                      <div>ID: \${page.id}</div>
                      <div>创建时间: \${new Date(page.created_time).toLocaleString()}</div>
                      \${dateValue ? \`<div>日期属性(\${dateProp}): \${dateValue}</div>\` : ''}
                      \${content ? \`<div class="page-content">正文内容：\${content}</div>\` : ''}
                    </a>
                  \`;
                }).join('');
                resultDiv.innerHTML += pagesHtml;
              } else {
                resultDiv.innerHTML += '<p>没有找到页面</p>';
              }
            } catch (error) {
              resultDiv.innerHTML = '<p style="color: red;">查询失败: ' + error.message + '</p>';
            }
          }

          function getPageTitle(page) {
            const properties = page.properties;
            for (const key in properties) {
              const prop = properties[key];
              if (prop.type === 'title' && prop.title.length > 0) {
                return prop.title[0].plain_text;
              }
            }
            return '无标题';
          }

          function getPropertyValue(page, propertyName) {
            if (!propertyName || !page.properties[propertyName]) return null;
            const prop = page.properties[propertyName];
            if (prop.type === 'date' && prop.date) {
              return prop.date.start;
            }
            return null;
          }

          function getPageContent(page) {
            const properties = page.properties;
            for (const key in properties) {
              const prop = properties[key];
              if (prop.type === 'rich_text' && prop.rich_text.length > 0) {
                return prop.rich_text.map(text => text.plain_text).join('\\n');
              }
            }
            return null;
          }
        </script>
      </body>
    </html>
  `);
});

export default app;