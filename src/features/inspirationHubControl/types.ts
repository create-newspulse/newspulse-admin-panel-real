export type InspirationMode = 'inspiration' | 'livetv';

export interface InspirationHubPayload {
  mode: InspirationMode;
  embedHtml: string; // raw input from textarea
}

export interface InspirationHubRecord {
  id: string;
  mode: InspirationMode;
  embedHtmlSanitized: string; // server-sanitized
  updatedAt: string;
}
