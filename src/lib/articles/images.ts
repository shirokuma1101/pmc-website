const STORED_ASSET_PATTERN = /\/pmc-website\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

export function storedImageIdsInMarkdown(markdown: string): string[] {
  const ids = new Set<string>();
  for (const match of markdown.matchAll(STORED_ASSET_PATTERN)) {
    ids.add(match[1].toLowerCase());
  }
  return [...ids];
}

export function newlyReferencedImageIds(previousMarkdown: string, nextMarkdown: string): string[] {
  const previousIds = new Set(storedImageIdsInMarkdown(previousMarkdown));
  return storedImageIdsInMarkdown(nextMarkdown).filter((id) => !previousIds.has(id));
}
