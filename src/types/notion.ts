import { Client } from '@notionhq/client';
import type { RichTextItemResponse, PartialUserObjectResponse, BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// 在文件顶部添加颜色类型定义
type Color =
	| 'default'
	| 'gray'
	| 'brown'
	| 'orange'
	| 'yellow'
	| 'green'
	| 'blue'
	| 'purple'
	| 'pink'
	| 'red'
	| 'gray_background'
	| 'brown_background'
	| 'orange_background'
	| 'yellow_background'
	| 'green_background'
	| 'blue_background'
	| 'purple_background'
	| 'pink_background'
	| 'red_background';

// 基础块类型
export interface BaseBlock {
	object: 'block';
	id: string;
	created_time: string;
	created_by: PartialUserObjectResponse;
	last_edited_time: string;
	last_edited_by: PartialUserObjectResponse;
	has_children: boolean;
	archived: boolean;
	in_trash: boolean;
}

// 父块类型
export type BlockParent = {
	type: 'database_id' | 'page_id' | 'block_id' | 'workspace';
	database_id?: string;
	page_id?: string;
	block_id?: string;
	workspace?: boolean;
};

// 标题块类型
export interface HeadingBlock extends BaseBlock {
	type: 'heading_1' | 'heading_2' | 'heading_3';
	heading_1?: {
		rich_text: Array<RichTextItemResponse>;
		color: Color;
		is_toggleable: boolean;
	};
	heading_2?: {
		rich_text: Array<RichTextItemResponse>;
		color: Color;
		is_toggleable: boolean;
	};
	heading_3?: {
		rich_text: Array<RichTextItemResponse>;
		color: Color;
		is_toggleable: boolean;
	};
	parent: BlockParent;
}

// 待办事项块类型
export interface TodoBlock extends BaseBlock {
	type: 'to_do';
	to_do: {
		rich_text: Array<RichTextItemResponse>;
		color: Color;
		checked: boolean;
	};
	parent: BlockParent;
}

// 导出所有块类型的联合类型
export type NotionBlock = HeadingBlock | TodoBlock;
// ... 其他块类型


// 定义Database的属性 
export type DatabaseProperty = {
    name: string;
    type: string;
    id: string;
    options?: Array<{
        id: string;
        name: string;
        color?: string;
    }>;
};

// 添加以下类型定义
export interface RelationPage {
    id: string;
    name: string;
}

export interface PropertyRequest {
    name: string;
    type?: string;
}

export interface PropertyDetail {
    name: string;
    type: string;
    id: string;
    options?: Array<{
        id: string;
        name: string;
        color?: string;
    }>;
}

export interface DatabasePropertiesDetail {
    databaseId: string;
    properties: Record<string, PropertyDetail>;
}

export type PropertyType = 
    | 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' 
    | 'date' | 'people' | 'files' | 'checkbox' | 'url' | 'email' 
    | 'phone_number' | 'formula' | 'relation' | 'rollup' | 'created_time' 
    | 'created_by' | 'last_edited_time' | 'last_edited_by' | 'status';

export interface PropertyQueryRequest {
    name: string;
    type?: PropertyType;
}

// 添加新的类型定义
export interface PropertyValue {
    name: string;
    type: string;
    value?: string | string[];
}

// 首先定义一个通用的选项接口
interface Option {
	name: string;
	id: string;
}

// 定义属性选项的接口
export interface PropertyOptions {
	name: string;
	options: Option[];
}

export interface SummaryExtentInfo {
	selectOptions?: PropertyOptions[];
	multiSelectOptions?: PropertyOptions[];
	relationPages?: PropertyOptions[];
}



  