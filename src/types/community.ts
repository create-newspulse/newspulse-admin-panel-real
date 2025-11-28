export interface CommunityStoryContact {
  name: string;
  email?: string;
  phone?: string;
  preferredContact?: 'email' | 'phone' | 'whatsapp' | 'no_preference';
  canContactForThisStory?: boolean;
  canContactForFutureStories?: boolean;
}

export interface CommunityStoryLocation {
  city?: string;
  state?: string;
  country?: string;
  district?: string;
}

export interface CommunityStory {
  _id: string;
  title: string;
  summary?: string;
  content?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  language?: string;
  category?: string;
  submittedBy?: string;
  location?: CommunityStoryLocation;
  contact?: CommunityStoryContact;
}

export interface CommunityStoryListResponse {
  ok: boolean;
  items: CommunityStory[];
  total: number;
  page?: number;
  limit?: number;
}
