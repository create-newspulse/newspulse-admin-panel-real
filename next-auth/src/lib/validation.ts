import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  lane: z.enum(['owner','team']),
});

export const totpVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/), session: z.string().optional() });
export const totpSetupSchema = z.object({});
export const passkeyBeginSchema = z.object({});
export const passkeyFinishSchema = z.object({ credential: z.any() });
export const recoveryConsumeSchema = z.object({ code: z.string().min(4) });
export const emailOtpVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

// Password reset
export const forgotPasswordSchema = z.object({ email: z.string().email() });
export const resetPasswordSchema = z.object({
  rid: z.string().min(1),
  token: z.string().min(16),
  password: z.string().min(8),
});
