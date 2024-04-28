

const { Client } = require('@notionhq/client');

// "notionApiKey": "secret_ErU2UH0YKgztfQP3Eb5ywa0Z7U1aKEU7445nsMKNsAa",
// "databaseId": "05c87b65e76b4789a38c5c84809d300f",
let queryDatabase = async (ctx) => {
    const { notionApiKey, databaseId } = await ctx.req.json();
    const notion = new Client({ auth: notionApiKey });
    const response = await notion.databases.retrieve({ database_id: databaseId });
    console.log(response);
	return ctx.text(
		JSON.stringify(response)
	);
};


let queryPage = async (ctx) => {
    const { notionApiKey, databaseId, pageId } = await ctx.req.json();
    console.log(`notionApiKey: ${notionApiKey} databaseId: ${databaseId} pageId: ${pageId}`);
    const notion = new Client({ auth: notionApiKey });
    const response = await notion.pages.retrieve({ page_id: pageId });
    console.log(response);
    return ctx.text(
        JSON.stringify(response)
    );
};

let setup = (route) => {
	route.post('/query/database', (
        ctx => {
            return queryDatabase(ctx);
        }
    ));
    route.post('/query/page', (
        ctx => {
            return queryPage(ctx);
        }
    ));
};

export default { setup };


