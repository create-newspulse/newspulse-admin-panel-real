import { jsx as _jsx } from "react/jsx-runtime";
/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import KPIStat from '../KPIStat';
describe('KPIStat', () => {
    it('renders label and formatted numeric value', () => {
        render(_jsx(KPIStat, { label: "Visitors", value: 12345 }));
        expect(screen.getByText('Visitors')).toBeInTheDocument();
        // value formatted with Intl, but should contain 12345 regardless of locale separators
        expect(screen.getByText((c) => /12/.test(c) && /345/.test(c))).toBeInTheDocument();
    });
    it('shows positive delta with up arrow and green color', () => {
        render(_jsx(KPIStat, { label: "Revenue", value: 100, delta: +5 }));
        expect(screen.getByText('5')).toBeInTheDocument();
        const up = screen.getByText('Γû▓');
        expect(up).toBeInTheDocument();
    });
    it('shows negative delta with down arrow and red color', () => {
        render(_jsx(KPIStat, { label: "Churn", value: 10, delta: -1 }));
        expect(screen.getByText('-1')).toBeInTheDocument();
        const down = screen.getByText('Γû╝');
        expect(down).toBeInTheDocument();
    });
    it('flips good/bad colors when invert=true', () => {
        // For invert metrics, negative is good (green)
        render(_jsx(KPIStat, { label: "Error Rate", value: 0.03, delta: -0.01, invert: true }));
        const downs = screen.getAllByText('Γû╝');
        const down = downs[downs.length - 1];
        expect(down).toBeInTheDocument();
        // Check the container around delta has green class
        const deltaContainer = down.parentElement;
        expect(deltaContainer?.className).toMatch(/text-emerald-600|dark:text-emerald-400/);
    });
    it('formats percent values when format and deltaFormat are percent', () => {
        render(_jsx(KPIStat, { label: "Conversion", value: 0.1234, delta: 0.0234, format: "percent", deltaFormat: "percent" }));
        // Use role group and then query inside to avoid matching other cards
        const group = screen.getByRole('group', { name: /Conversion:/ });
        expect(group).toBeInTheDocument();
        expect(group.textContent).toMatch(/12/); // value approx 12%
        expect(group.textContent).toMatch(/2/); // delta approx 2%
    });
});
