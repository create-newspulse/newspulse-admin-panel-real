// Guard utilities to ensure front-end never triggers unintended publish/schedule
// when global publish flag is disabled.

export type ArticleWorkflowAction = 'toReview' | 'toLegal' | 'approve' | 'schedule' | 'publish';

export function isPublishLike(action: ArticleWorkflowAction): boolean {
  return action === 'publish' || action === 'schedule';
}

export interface GuardContext {
  publishEnabled: boolean;
  isFounder?: boolean;              // elevated role allowed to publish
  checklistOk?: boolean;            // editorial checklist completeness
  stage?: string;                   // current workflow stage (draft/review/legal/approved/scheduled)
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardAction(action: ArticleWorkflowAction, publishEnabled: boolean, ctx?: Partial<GuardContext>): GuardResult {
  const isPublish = action === 'publish';
  const isSchedule = action === 'schedule';
  // Global publish flag block
  if (!publishEnabled && (isPublish || isSchedule)) {
    return { allowed: false, reason: 'Publishing disabled (runtime flag OFF)' };
  }
  // Founder-only publish enforcement
  if (isPublish && publishEnabled && ctx?.isFounder === false) {
    return { allowed: false, reason: 'Only founder may publish currently' };
  }
  // Checklist enforcement (only if provided)
  if ((isPublish || isSchedule) && ctx?.checklistOk === false) {
    return { allowed: false, reason: 'Editorial checklist incomplete' };
  }
  // Stage sanity (defensive; UI should also gate)
  if (ctx?.stage) {
    if (isSchedule && ctx.stage !== 'approved') {
      return { allowed: false, reason: 'Cannot schedule unless approved stage' };
    }
    if (isPublish && !['approved','scheduled'].includes(ctx.stage)) {
      return { allowed: false, reason: 'Publish allowed only from approved/scheduled stages' };
    }
  }
  return { allowed: true };
}

// Optional future extension: incorporate checklist, role-based permissions, etc.
export function safePerformTransition<T extends (...args:any[])=>Promise<any>>(
  action: ArticleWorkflowAction,
  publishEnabled: boolean,
  perform: T,
  ctx?: Partial<GuardContext>
): Promise<ReturnType<T> | undefined> {
  const g = guardAction(action, publishEnabled, ctx);
  if (!g.allowed) return Promise.resolve(undefined);
  return perform();
}
