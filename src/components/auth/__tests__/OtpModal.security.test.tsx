import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ request: vi.fn(), verify: vi.fn(), reset: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/adminApi', () => ({ requestPasswordResetOtp: mocks.request, verifyPasswordOtp: mocks.verify, resetPasswordWithOtp: mocks.reset, resetPasswordWithToken: mocks.reset }));
vi.mock('sonner', () => ({ toast: { success: mocks.toast, error: mocks.toast, message: mocks.toast } }));
import OtpModal from '../OtpModal';

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('OTP privacy', () => {
  it('does not expose debug codes, reset tokens, or response payloads to diagnostics', async () => {
    const marker = 'synthetic-private-marker';
    const spies = ['log', 'warn', 'debug', 'error'].map(method => vi.spyOn(console, method as 'log').mockImplementation(() => {}));
    mocks.request.mockResolvedValue({ success: true, message: marker, data: { devCode: marker } });
    mocks.verify.mockResolvedValue({ resetToken: marker });
    const view = render(<OtpModal open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Your email'), { target: { value: 'synthetic@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByPlaceholderText('Enter OTP')).toHaveValue('');
    fireEvent.change(screen.getByPlaceholderText('Enter OTP'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await screen.findByPlaceholderText('New password');
    expect(spies.some(spy => /synthetic-private-marker|synthetic@example.invalid|000000/.test(JSON.stringify(spy.mock.calls)))).toBe(false);
    expect(JSON.stringify(mocks.toast.mock.calls).includes(marker)).toBe(false);
    expect(document.body.textContent?.includes(marker)).toBe(false);
    view.rerender(<OtpModal open={false} onClose={() => {}} />);
    view.rerender(<OtpModal open onClose={() => {}} />);
    expect(screen.getByPlaceholderText('Your email')).toHaveValue('');
  });

  it('shows a safe error when OTP verification fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.request.mockResolvedValue({ success: true });
    mocks.verify.mockRejectedValue({ response: { status: 400, data: { message: 'synthetic-private-marker' } } });
    render(<OtpModal open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Your email'), { target: { value: 'synthetic@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
    fireEvent.change(await screen.findByPlaceholderText('Enter OTP'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenLastCalledWith('Invalid OTP'));
  });
});