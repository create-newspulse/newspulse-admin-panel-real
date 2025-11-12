import { z } from "zod";

/* Snapshots */
export const Snapshot = z.object({
  id: z.string(),
  note: z.string().default(""),
  checksum: z.string(),
  at: z.string(), // ISO
});
export type Snapshot = z.infer<typeof Snapshot>;

/* Diff rows for dry-run */
export const DiffRow = z.object({
  path: z.string(), // e.g. settings.ai.guardrails.strict
  before: z.any(),
  after: z.any(),
  impact: z.enum(["none","low","medium","high"]).default("low"),
});
export type DiffRow = z.infer<typeof DiffRow>;

/* Alert Escalation Settings */
export const EscalationChannel = z.object({
  dashboard: z.boolean().default(true),
  email: z.boolean().default(false),
  sms: z.boolean().default(false),
  webhook: z.boolean().default(false),
});
export type EscalationChannel = z.infer<typeof EscalationChannel>;

export const EscalationLevel = z.object({
  level: z.enum(["L1","L2","L3"]),
  name: z.string(),
  description: z.string(),
  triggers: z.array(z.string()), // e.g. ["ops.traffic.spike","security.incident"]
  autoLockdown: z.boolean().default(false), // only valid for L3
  channels: EscalationChannel,
});
export type EscalationLevel = z.infer<typeof EscalationLevel>;

export const EscalationSettings = z.object({
  updatedAt: z.string(),
  levels: z.tuple([
    EscalationLevel, // L1
    EscalationLevel, // L2
    EscalationLevel, // L3
  ]),
});
export type EscalationSettings = z.infer<typeof EscalationSettings>;
