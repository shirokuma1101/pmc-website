export interface WorldsContent {
  markdown: string;
}

export interface WorldDownload {
  id: string;
  filename: string;
  description: string;
  uploadedAt: string;
}

export interface WorldsPageData {
  content: WorldsContent;
  files: WorldDownload[];
}

export const defaultWorldsContent: WorldsContent = {
  markdown: "過去に活動したMinecraftワールドをダウンロードできます。",
};
