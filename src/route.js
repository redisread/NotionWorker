import { Hono } from 'hono';

import notion_query from './notion/query';
import notion_add_page from './notion/add_page';


const route = new Hono();


let plugins = [notion_query, notion_add_page];

for (let plugin of plugins) {
	plugin.setup(route);
}

export default route;
