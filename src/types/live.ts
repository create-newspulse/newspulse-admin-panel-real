// 📁 src/types/live.ts
// Core types for Live TV and AIRA, mirrored from docs/live-tv-spec.md

export type LiveFeed = {
  _id: string;
  title: string;
  sourceType: 'YOUTUBE' | 'X' | 'FACEBOOK' | 'IFRAME' | 'HLS' | 'DASH' | 'OTHER';
  rawInput: string;
  sanitizedEmbedHtml?: string;
  hlsUrl?: string;
  isActive: boolean;
  displayMode: 'HERO' | 'BANNER' | 'IN_ARTICLE';
  startAt?: string; // ISO
  endAt?: string;   // ISO
  ticker?: { text: string; speed?: number; show?: boolean };
  language?: 'en' | 'hi' | 'gu';
  regionTags?: string[];
  ptiCompliance: { status: 'PENDING' | 'PASS' | 'FAIL'; notes?: string };
  safety: { status: 'SAFE' | 'RISKY' | 'BLOCKED'; reason?: string };
  fallback: { mode: 'SLIDESHOW' | 'AI_ANCHOR' | 'NONE' };
  createdBy: string;
  updatedAt: string;
};

export type AnchorSchedule = {
  _id: string;
  cron: string; // e.g. "0 * 7-23 * *" (hourly 07:00–23:00)
  languagePriority?: Array<'en' | 'hi' | 'gu'>;
  enabled: boolean;
  createdBy: string;
  updatedAt: string;
};

export type AnchorBulletin = {
  _id: string;
  language: 'en' | 'hi' | 'gu';
  script: string;
  audioUrl: string;
  captionsUrl?: string; // WebVTT
  createdAt: string;
};

export type AuditLog = {
  _id: string;
  actorId: string;
  action: string; // LIVE_CREATE, LIVE_ACTIVATE, PTI_PASS, PTI_FAIL, etc.
  targetId?: string; // liveFeedId or scheduleId
  meta?: Record<string, any>;
  createdAt: string;
};
