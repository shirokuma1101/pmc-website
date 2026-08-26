const MARKDOWN_IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const MARKDOWN_LINK = /\[([^\]]+)\]\([^)]*\)/g;
const MARKDOWN_DECORATION = /(^|\s)(#{1,6}|>|[-+*]|\d+\.)\s+|[`*_~]/gm;

function truncate(text: string, maximum: number) {
  if (text.length <= maximum) return text;
  return `${text.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

export function articleExcerpt(body: string, maximum = 160) {
  const plainText = body
    .replace(MARKDOWN_IMAGE, "$1")
    .replace(MARKDOWN_LINK, "$1")
    .replace(MARKDOWN_DECORATION, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return truncate(plainText, maximum);
}

export function articleSummary(article: { summary: string; body: string }, maximum = 160) {
  const configured = article.summary.replace(/\s+/g, " ").trim();
  return configured ? truncate(configured, maximum) : articleExcerpt(article.body, maximum);
}
