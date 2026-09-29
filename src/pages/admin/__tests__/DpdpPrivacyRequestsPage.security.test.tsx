import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, user: { id: 'synthetic-user', role: 'founder', specialRights: [] as string[] } },
  list: vi.fn(), get: vi.fn(), update: vi.fn(), complete: vi.fn(), clear: vi.fn(),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/http/adminFetch', () => ({ ADMIN_API_BASE: '/admin-api' }));
vi.mock('@/lib/dpdpPrivacyRequests', () => ({
  listDpdpPrivacyRequests: mocks.list,
  getDpdpPrivacyRequest: mocks.get,
  updateDpdpPrivacyRequest: mocks.update,
  completeDpdpPrivacyRequest: mocks.complete,
  clearDpdpPrivacyTestRequests: mocks.clear,
}));

import DpdpPrivacyRequestsPage from '../DpdpPrivacyRequestsPage';

const request = {
  id: 'synthetic-request', requestId: 'TEST-REQUEST', referenceId: 'TEST-REQUEST',
  fullName: 'Synthetic identity marker', email: 'synthetic-contact-marker', mobile: '',
  requestType: 'Deletion', message: '', status: 'Verified', adminNote: '',
  createdAt: '', updatedAt: '', activityHistory: [],
};

function renderPage() {
  return render(<MemoryRouter><DpdpPrivacyRequestsPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.auth.isAuthenticated = true;
  mocks.auth.user = { id: 'synthetic-user', role: 'founder', specialRights: [] };
  mocks.list.mockResolvedValue([request]);
  mocks.get.mockResolvedValue(request);
});

describe('privacy request security', () => {
  it('does not fetch requests or render actions without the management right', () => {
    mocks.auth.user.role = 'editor';
    renderPage();
    expect(screen.getByText('Access Denied. Founder permission is required.')).toBeInTheDocument();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'View Request' })).not.toBeInTheDocument();
  });

  it('preserves explicitly delegated management access', async () => {
    mocks.auth.user.role = 'admin';
    mocks.auth.user.specialRights = ['can_manage_dpdp_privacy_requests'];
    renderPage();
    expect(await screen.findByRole('button', { name: 'View Request' })).toBeInTheDocument();
  });

  it('masks list identity and keeps review drafts out of browser storage', async () => {
    localStorage.setItem('np:dpdp-founder-review:old', JSON.stringify({ adminNote: 'synthetic-note-marker' }));
    const view = renderPage();
    await screen.findByRole('button', { name: 'View Request' });
    expect(screen.getByRole('table').textContent?.includes(request.fullName)).toBe(false);
    expect(screen.getByRole('table').textContent?.includes(request.email)).toBe(false);
    expect(localStorage.getItem('np:dpdp-founder-review:old')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View Request' }));
    await waitFor(() => expect(screen.queryByText('Loading latest request details...')).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Admin Note'), { target: { value: 'synthetic-note-marker' } });
    expect(Object.values(localStorage).some(value => String(value).includes('synthetic-note-marker'))).toBe(false);
    expect(Object.values(sessionStorage).some(value => String(value).includes('synthetic-note-marker'))).toBe(false);
    view.unmount();
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'View Request' }));
    await waitFor(() => expect(screen.getByLabelText('Admin Note')).toHaveValue(''));
  });

  it('cannot mark pending verification as verified, in review, or completed', async () => {
    const pending = { ...request, status: 'Pending Email Verification' };
    mocks.list.mockResolvedValue([pending]);
    mocks.get.mockResolvedValue(pending);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'View Request' }));
    await waitFor(() => expect(screen.queryByText('Loading latest request details...')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Email/user identity verified')).toBeDisabled();
    expect(screen.getByLabelText('Email/user identity verified')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Mark In Review' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mark Completed' })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('does not display backend error details', async () => {
    mocks.list.mockRejectedValue(new Error('synthetic-private-error-marker'));
    renderPage();
    await screen.findByText('Failed to load privacy requests.');
    expect(document.body.textContent?.includes('synthetic-private-error-marker')).toBe(false);
  });
});