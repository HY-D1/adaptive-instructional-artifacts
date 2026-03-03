/**
 * Textbook Content Renderer
 *
 * Renders textbook unit content from markdown to HTML.
 * This module is separate from React components to enable unit testing.
 *
 * Rules:
 * - Markdown is the canonical storage format
 * - HTML is rendered at display time
 * - All output is sanitized with DOMPurify
 */

import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

export type ContentFormat = 'markdown' | 'html';

export interface RenderOptions {
  /** Content to render */
  content: string;
  /** Format hint - if 'html', content is displayed directly after sanitization */
  contentFormat?: ContentFormat;
}

/**
 * Renders textbook content to safe HTML
 *
 * Pipeline:
 * 1. If contentFormat === 'html': sanitize and return directly (legacy support)
 * 2. Otherwise: parse as markdown → sanitize → return HTML
 *
 * @param options - Render options
 * @returns Sanitized HTML string
 */
export function renderTextbookContent(options: RenderOptions): string {
  const { content, contentFormat } = options;
  const rawContent = content || '';

  // If content is explicitly marked as HTML (legacy), sanitize and display directly
  if (contentFormat === 'html') {
    return sanitizeHtml(rawContent);
  }

  // Canonical path: markdown -> HTML
  return renderMarkdownToHtml(rawContent);
}

/**
 * Renders markdown to HTML using marked
 */
function renderMarkdownToHtml(markdown: string): string {
  // Create a custom renderer that escapes raw HTML to prevent XSS
  const renderer = new Renderer();
  renderer.html = (token: { text?: string; raw?: string }) => {
    // Marked v14+ passes a token object with text/raw property
    // Escape raw HTML by converting < and > to entities
    const raw = token.text ?? token.raw ?? '';
    return raw.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  const renderedMarkdown = marked.parse(markdown, {
    gfm: true,
    breaks: true,
    renderer
  }) as string;

  return sanitizeHtml(renderedMarkdown);
}

/**
 * Sanitizes HTML with DOMPurify
 * Defense-in-depth against XSS
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a'
    ],
    ALLOWED_ATTR: ['href', 'title', 'class']
  });
}
