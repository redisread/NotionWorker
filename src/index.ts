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
import { summarizeWebPage } from './utils/web'
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

  const response = await summarizeWebPage(url);
  return new Response(JSON.stringify(response));
});

export default app;