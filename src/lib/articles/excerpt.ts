const MARKDOWN_IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const MARKDOWN_LINK = /\[([^\]]+)\]\([^)]*\)/g;
const MARKDOWN_DECORATION = /(^|\s)(#{1,6}|>|[-+*]|\d+\.)\s+|[`*_~]/gm;

export function articleExcerpt(body: string, maximum = 160) {
  const plainText = body
    .replace(MARKDOWN_IMAGE, "$1")
    .replace(MARKDOWN_LINK, "$1")
    .replace(MARKDOWN_DECORATION, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= maximum) return plainText;
  return `${plainText.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}
