import { describe, expect, it } from 'vitest';

import { ADMIN_MARKETING_ROUTE, ADMIN_MODERATION_LEGACY_ROUTE, PANEL_MARKETING_ROUTE, PANEL_MODERATION_LEGACY_ROUTE } from '@/config/adminRoutes';
import { NAV_ITEMS } from '@/config/nav';

describe('marketing route and navbar contract', () => {
  it('defines the canonical Marketing route and old Moderation redirect source', () => {
    expect(ADMIN_MARKETING_ROUTE).toBe('/admin/marketing');
    expect(ADMIN_MODERATION_LEGACY_ROUTE).toBe('/admin/moderation');
    expect(PANEL_MARKETING_ROUTE).toBe('/panel/admin/marketing');
    expect(PANEL_MODERATION_LEGACY_ROUTE).toBe('/panel/admin/moderation');
  });

  it('replaces the main navbar Moderation item with Marketing in the same module slot', () => {
    const marketing = NAV_ITEMS.find((item) => item.key === 'marketing');

    expect(marketing).toMatchObject({
      label: 'Marketing',
      path: ADMIN_MARKETING_ROUTE,
      moduleKey: 'marketing',
    });
    expect(NAV_ITEMS.some((item) => item.label === 'Moderation' || item.path === ADMIN_MODERATION_LEGACY_ROUTE)).toBe(false);
  });
});