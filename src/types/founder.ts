export type Ok<T=unknown> = { ok: true } & T;
export type Err = { ok: false; error: string };

export interface FounderProfile {
  name: string;
  founderId: string;
  accessLevel: string;
  lastLogin: string;
  devices: string[];
  twoFA: { email: string; enabled: boolean };
}

export interface SystemSummary {
  updatedAt: string;
  systems: { system: string; ai: string; backup: string; security: string };
}
