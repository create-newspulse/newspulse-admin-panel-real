export type AreaType =
  | 'METRO'
  | 'CORPORATION'
  | 'DISTRICT_HQ'
  | 'TALUKA'
  | 'TOWN'
  | 'VILLAGE'
  | 'OTHER';

export type ReporterStatus =
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'INACTIVE'
  | 'BLACKLISTED';

export type ReporterBeat =
  | 'POLITICS'
  | 'GOVERNANCE'
  | 'CRIME'
  | 'COURTS'
  | 'EDUCATION'
  | 'HEALTH'
  | 'BUSINESS'
  | 'AGRICULTURE'
  | 'YOUTH'
  | 'SPORTS'
  | 'ENTERTAINMENT'
  | 'TECH'
  | 'ENVIRONMENT'
  | 'OTHER';

export interface ReporterStats {
  totalStories: number;
  approvedStories: number;
  pendingStories: number;
  lastStoryAt?: string;
}

export interface ReporterContact {
  _id: string;
  fullName: string;
  email: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  phoneFull?: string;
  country: string;
  stateCode?: string;
  stateName?: string;
  districtName?: string;
  talukaName?: string;
  cityTownVillage?: string;
  areaType: AreaType;
  beats: ReporterBeat[];
  status: ReporterStatus;
  stats: ReporterStats;
  createdAt: string;
  updatedAt: string;
}
