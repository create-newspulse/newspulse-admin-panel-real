import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADMIN_MODULE_POLICY, type AdminModulePolicyMap } from '@/lib/adminModulePolicy';
import AddNews from '../AddNews';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true, isReady: true, isLoading: false, isRestoring: false,
    user: { id: 'synthetic-creator', role: 'editor', moduleAccess: [] as string[], specialRights: [] as string[] },
  },
  effective: { isLoading: false, error: null, modulePolicy: {} as AdminModulePolicyMap, backendAccess: {} },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({ useAdminEffectiveAccess: () => mocks.effective }));
vi.mock('@/components/news/ArticleForm', () => ({ ArticleForm: () => <div>New story form</div> }));

function open(path = '/admin/add-news') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/admin/add-news" element={<AddNews />} />
    <Route path="/draft-desk/:id" element={<div>Own draft workspace</div>} />
    <Route path="/login" element={<div>Sign in</div>} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  Object.assign(mocks.auth, { isAuthenticated: true, isReady: true, isLoading: false, isRestoring: false });
  Object.assign(mocks.auth.user, { role: 'editor', moduleAccess: [], specialRights: [] });
  mocks.effective.modulePolicy = {
    ...DEFAULT_ADMIN_MODULE_POLICY,
    add_news: { moduleKey: 'add_news', state: 'available' },
    draft_desk: { moduleKey: 'draft_desk', state: 'available' },
    manage_news: { moduleKey: 'manage_news', state: 'available' },
  };
  mocks.effective.backendAccess = {};
});
afterEach(cleanup);

describe('Mounted Create News access boundary', () => {
  it.each([
    ['founder', [], []],
    ['editor', ['add_news'], []],
    ['editor', ['draft_desk'], []],
    ['editor', ['manage_news'], ['news_edit']],
  ] as const)('admits authorized %s with %j and %j', (role, modules, rights) => {
    Object.assign(mocks.auth.user, { role, moduleAccess: [...modules], specialRights: [...rights] });
    open();
    expect(screen.getByText('New story form')).toBeInTheDocument();
  });

  it.each([
    ['admin', ['manage_news'], []],
    ['editor', [], ['news_edit']],
    ['staff', [], []],
  ] as const)('denies unentitled %s with %j and %j', (role, modules, rights) => {
    Object.assign(mocks.auth.user, { role, moduleAccess: [...modules], specialRights: [...rights] });
    open();
    expect(screen.queryByText('New story form')).not.toBeInTheDocument();
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
  });

  it.each(['staff_locked', 'hidden', 'founder_only'] as const)('preserves %s module policy instead of granting unrelated access', state => {
    mocks.auth.user.moduleAccess = ['add_news'];
    mocks.effective.modulePolicy.add_news = { moduleKey: 'add_news', state };
    open();
    expect(screen.queryByText('New story form')).not.toBeInTheDocument();
  });

  it('permits a separate authorized Draft Desk path without unlocking Add News', () => {
    mocks.auth.user.moduleAccess = ['draft_desk'];
    mocks.effective.modulePolicy.add_news = { moduleKey: 'add_news', state: 'staff_locked' };
    open();
    expect(screen.getByText('New story form')).toBeInTheDocument();
    expect(mocks.effective.modulePolicy.add_news.state).toBe('staff_locked');
    expect(mocks.auth.user.moduleAccess).toEqual(['draft_desk']);
  });

  it('preserves limited-staff resume routing instead of opening the full editor', () => {
    mocks.auth.user.moduleAccess = ['draft_desk'];
    open('/admin/add-news?id=existing-draft');
    expect(screen.getByText('Own draft workspace')).toBeInTheDocument();
    expect(screen.queryByText('New story form')).not.toBeInTheDocument();
  });

  it('does not accept an unauthenticated Founder claim', () => {
    mocks.auth.user.role = 'founder';
    mocks.auth.isAuthenticated = false;
    open();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.queryByText('New story form')).not.toBeInTheDocument();
  });
});
