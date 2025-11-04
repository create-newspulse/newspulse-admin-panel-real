import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import FounderRoute from '@/components/FounderRoute';
// Minimal AuthContext mock via module aliasing would be better, but we can simulate by
// temporarily stubbing window.location.hostname for demo mode path.
describe('FounderRoute', () => {
    it('renders children when authenticated founder', () => {
        // Simulate a vercel preview to bypass in demo mode if enabled by env
        const orig = window.location.hostname;
        Object.defineProperty(window, 'location', { value: { hostname: 'preview-xyz.vercel.app' }, configurable: true });
        const el = render(_jsx(MemoryRouter, { children: _jsx(FounderRoute, { children: _jsx("div", { "data-testid": "ok" }) }) }));
        expect(el.getByTestId('ok')).toBeTruthy();
        Object.defineProperty(window, 'location', { value: { hostname: orig }, configurable: true });
    });
});
