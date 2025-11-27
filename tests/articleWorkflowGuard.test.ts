import { describe, it, expect } from 'vitest';
import { guardAction } from '@/lib/articleWorkflowGuard';

describe('articleWorkflowGuard', () => {
  it('blocks publish when disabled (reason)', () => {
    const res = guardAction('publish', false);
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/disabled/i);
  });
  it('blocks schedule when disabled (reason)', () => {
    const res = guardAction('schedule', false);
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/disabled/i);
  });
  it('allows non-publish actions when disabled', () => {
    expect(guardAction('approve', false).allowed).toBe(true);
    expect(guardAction('toReview', false).allowed).toBe(true);
  });
  it('enforces founder-only publish', () => {
    const blocked = guardAction('publish', true, { isFounder: false });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/founder/i);
    const allowed = guardAction('publish', true, { isFounder: true });
    expect(allowed.allowed).toBe(true);
  });
  it('blocks publish with incomplete checklist', () => {
    const blocked = guardAction('publish', true, { isFounder: true, checklistOk: false });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/checklist/i);
    const allowed = guardAction('publish', true, { isFounder: true, checklistOk: true });
    expect(allowed.allowed).toBe(true);
  });
  it('blocks schedule if stage not approved', () => {
    const blocked = guardAction('schedule', true, { stage: 'review' });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/approved/i);
    expect(guardAction('schedule', true, { stage: 'approved' }).allowed).toBe(true);
  });
  it('blocks publish if stage invalid', () => {
    const blocked = guardAction('publish', true, { stage: 'draft', isFounder: true, checklistOk: true });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/approved\/scheduled/i);
    expect(guardAction('publish', true, { stage: 'approved', isFounder: true, checklistOk: true }).allowed).toBe(true);
    expect(guardAction('publish', true, { stage: 'scheduled', isFounder: true, checklistOk: true }).allowed).toBe(true);
  });
});
