import { Client } from '@notionhq/client';
import { marked } from 'marked';
import { Token, Tokens } from 'marked';

class NotionMarkdownConverter {

  constructor() {
  }

  async createPage(parentPageId: string, markdown: string, title: string): Promise<void> {
    // try {
    //   const blocks = await this.convertMarkdownToBlocks(markdown);
      
    //   await this.notion.pages.create({
    //     parent: {
    //       page_id: parentPageId,
    //     },
    //     properties: {
    //       title: {
    //         title: [{ text: { content: title } }]
    //       }
    //     },
    //     children: blocks
    //   });
    // } catch (error) {
    //   console.error('Error creating page:', error);
    //   throw error;
    // }
  }

  public async convertMarkdownToBlocks(markdown: string): Promise<any[]> {
    const tokens = marked.lexer(markdown);
    return this.tokensToBlocks(tokens);
  }

  private tokensToBlocks(tokens: Token[]): any[] {
    const blocks: any[] = [];

    for (const token of tokens) {
      const block = this.tokenToBlock(token);
      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  private tokenToBlock(token: Token): any {
    switch (token.type) {
      case 'heading':
        return this.createHeadingBlock(token as Tokens.Heading);
      
      case 'paragraph':
        return this.createParagraphBlock(token as Tokens.Paragraph);
      
      case 'list':
        return this.createListBlock(token as Tokens.List);
      
      case 'code':
        return this.createCodeBlock(token as Tokens.Code);
      
      case 'blockquote':
        return this.createQuoteBlock(token as Tokens.Blockquote);
      
      case 'hr':
        return this.createDividerBlock();
      
      default:
        return null;
    }
  }

  private createHeadingBlock(token: Tokens.Heading): any {
    const headingType = `heading_${token.depth}` as const;
    return {
      object: 'block',
      type: headingType,
      [headingType]: {
        rich_text: [{ 
          type: 'text',
          text: { content: token.text }
        }]
      }
    };
  }

  private createParagraphBlock(token: Tokens.Paragraph): any {
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: this.parseInlineTokens(token.text)
      }
    };
  }

  private createListBlock(token: Tokens.List): any {
    const listType = token.ordered ? 'numbered_list_item' : 'bulleted_list_item';
    return token.items.map(item => ({
      object: 'block',
      type: listType,
      [listType]: {
        rich_text: this.parseInlineTokens(item.text)
      }
    }));
  }

  private createCodeBlock(token: Tokens.Code): any {
    return {
      object: 'block',
      type: 'code',
      code: {
        rich_text: [{ 
          type: 'text',
          text: { content: token.text }
        }],
        language: token.lang || 'plain text'
      }
    };
  }

  private createQuoteBlock(token: Tokens.Blockquote): any {
    return {
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [{ 
          type: 'text',
          text: { content: token.text }
        }]
      }
    };
  }

  private createDividerBlock(): any {
    return {
      object: 'block',
      type: 'divider',
      divider: {}
    };
  }

  private parseInlineTokens(text: string): any[] {
    const inlineTokens = marked.lexer(text, { gfm: true });
    return inlineTokens.map(token => {
      if (token.type === 'text') {
        return {
          type: 'text',
          text: { content: token.text }
        };
      } else if (token.type === 'strong') {
        return {
          type: 'text',
          text: { content: token.text },
          annotations: { bold: true }
        };
      } else if (token.type === 'em') {
        return {
          type: 'text',
          text: { content: token.text },
          annotations: { italic: true }
        };
      } else if (token.type === 'link') {
        return {
          type: 'text',
          text: { content: token.text },
          href: token.href
        };
      }
      return {
        type: 'text',
        text: { content: token.raw }
      };
    });
  }
}


export default NotionMarkdownConverter;
