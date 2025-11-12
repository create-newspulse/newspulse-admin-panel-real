// Temporary shim for missing type resolution of 'next/headers'.
// If Next.js types become available, this file can be removed.
// Provides minimal types sufficient for current code usage.

declare module 'next/headers' {
  interface CookieOptions {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
  }
  interface MutableCookies {
    set(name: string, value: string, opts?: CookieOptions): void;
    get(name: string): { name: string; value: string } | undefined;
    delete(name: string, opts?: CookieOptions): void;
  }
  export function cookies(): MutableCookies;
  export function headers(): Headers;
}
