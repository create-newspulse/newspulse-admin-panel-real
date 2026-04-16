import React from 'react';
import toast from 'react-hot-toast';

import { adminApi, api } from '@/lib/api';
import { useAuth } from '@context/AuthContext';
import {
  type AdInquiry,
  type AdInquiryListResult,
  type AdInquiryStatus,
  ADS_INQUIRIES_BASE,
  getAdInquiryStatusCount,
  logAdsInquiriesDiagnostic,
  getAdInquiriesUnreadCount,
  listAdInquiries,
  markAdInquiryRead,
  markAdInquiriesRead,
  moveAdInquiryToTrash,
  moveAdInquiriesToTrash,
  permanentlyDeleteAdInquiries,
  permanentlyDeleteAdInquiry,
  replyToAdInquiry,
  restoreAdInquiry,
  restoreAdInquiries,
  messagePreview,
} from '@/lib/adsInquiriesApi';

type AdSlot =
  | 'HOME_728x90'
  | 'FOOTER_BANNER_728x90'
  | 'HOME_RIGHT_300x250'
  | 'HOME_RIGHT_300x600'
  | 'HOME_BILLBOARD_970x250'
  | 'LIVE_UPDATE_SPONSOR'
  | 'BREAKING_SPONSOR'
  | 'HOME_RIGHT_RAIL'
  | 'ARTICLE_INLINE'
  | 'ARTICLE_END';

type MediaKitSection = {
  heading: string;
  bullets: string[];
};

type MediaKitPrices = {
  day?: number;
  week?: number;
  month?: number;
};

type MediaKitRateCard = {
  placementKey: string;
  placementLabel: string;
  prices: Required<MediaKitPrices>;
  rate15Days: number;
  includes?: string[];
  specs?: string[];
};

type MediaKitBundle = {
  name: string;
  prices: MediaKitPrices;
  billingPeriod: 'day' | 'week' | 'month';
  includes: string[];
  notes?: string[];
};

type MediaKitTickerPricingPeriod = '1d' | '3d' | '7d' | '15d' | '1m' | '1y';

type MediaKitTickerPricingMap = Record<MediaKitTickerPricingPeriod, number>;

type MediaKitTickerPricingTable = {
  title: string;
  subtitle?: string;
  prices: MediaKitTickerPricingMap;
  notes?: string[];
};

type MediaKitBrandedPricingPeriod = '1d' | '3d' | '7d' | '15d' | '1m' | 'perArticle';

type MediaKitBrandedPricingMap = Partial<Record<MediaKitBrandedPricingPeriod, number>>;

type MediaKitBrandedPricingTable = {
  title: string;
  subtitle?: string;
  prices: MediaKitBrandedPricingMap;
  notes?: string[];
};

type MediaKitBrandedProduct = {
  productKey: string;
  name: string;
  description: string;
  pricingPeriods: MediaKitBrandedPricingPeriod[];
  pricingTables: MediaKitBrandedPricingTable[];
};

type MediaKitTickerScrollAds = {
  title: string;
  description: string;
  placements: string[];
  rules: string[];
  scheduling: string[];
  frequency: string[];
  pricingTables: MediaKitTickerPricingTable[];
  bookingEmail?: string;
};

type MediaKitDoc = {
  title: string;
  tagline?: string;
  contactEmail?: string;
  currencyCode: string;
  currencySymbol: string;
  showUsdApprox?: boolean;
  fxRateUsdInr?: number;
  updatedAt?: string;
  sections: MediaKitSection[];
  tickerScrollAds: MediaKitTickerScrollAds;
  brandedProducts: MediaKitBrandedProduct[];
  rateCards: MediaKitRateCard[];
  bundles: MediaKitBundle[];
  policies?: string[];
};

const TICKER_SCROLL_PRICING_PERIODS: Array<{ key: MediaKitTickerPricingPeriod; label: string }> = [
  { key: '1d', label: '1 Day' },
  { key: '3d', label: '3 Days' },
  { key: '7d', label: '7 Days' },
  { key: '15d', label: '15 Days' },
  { key: '1m', label: '1 Month' },
  { key: '1y', label: '1 Year' },
];

const BRANDED_PRODUCT_PRICING_PERIODS: Array<{ key: MediaKitBrandedPricingPeriod; label: string }> = [
  { key: '1d', label: '1 Day' },
  { key: '3d', label: '3 Days' },
  { key: '7d', label: '7 Days' },
  { key: '15d', label: '15 Days' },
  { key: '1m', label: '1 Month' },
  { key: 'perArticle', label: 'Per Article Publish' },
];

const TICKER_SCROLL_LANGUAGE_MULTIPLIERS = {
  single: 1,
  two: 1.6,
  allThree: 2.2,
} as const;

const TICKER_SCROLL_LANGUAGE_PACKAGE_BULLETS: string[] = [
  'English (EN), Hindi (HI), and Gujarati (GU) are supported.',
  `Single language (EN or HI or GU): base price × ${TICKER_SCROLL_LANGUAGE_MULTIPLIERS.single}×`,
  `Two languages (EN+HI / EN+GU / HI+GU): base price × ${TICKER_SCROLL_LANGUAGE_MULTIPLIERS.two}×`,
  `All three languages (EN+HI+GU): base price × ${TICKER_SCROLL_LANGUAGE_MULTIPLIERS.allThree}×`,
  'All Languages campaigns show the correct message per site language.',
];

const RATE_CARD_ROUNDING_STEP = 50;

function roundRateCardPrice(value: number, step = RATE_CARD_ROUNDING_STEP): number {
  const numericValue = Number(value);
  const numericStep = Number(step);
  if (!Number.isFinite(numericValue)) return 0;
  if (!Number.isFinite(numericStep) || numericStep <= 0) return Math.round(numericValue);
  return Math.round(numericValue / numericStep) * numericStep;
}

function deriveRateCardPricesFromDay(day: number, step = RATE_CARD_ROUNDING_STEP): { week: number; rate15Days: number; month: number } {
  const sourceDay = Number(day);
  if (!Number.isFinite(sourceDay)) {
    return { week: 0, rate15Days: 0, month: 0 };
  }

  return {
    week: roundRateCardPrice(sourceDay * 7 * 0.85, step),
    rate15Days: roundRateCardPrice(sourceDay * 15 * 0.8, step),
    month: roundRateCardPrice(sourceDay * 30 * 0.7, step),
  };
}

function normalizeRateCard(
  card: {
    placementKey: string;
    placementLabel: string;
    prices: MediaKitPrices;
    rate15Days?: number;
    includes?: string[];
    specs?: string[];
  },
  opts?: {
    preserveExplicitDerived?: boolean;
    roundingStep?: number;
  },
): MediaKitRateCard {
  const day = Number(card?.prices?.day);
  const normalizedDay = Number.isFinite(day) ? day : 0;
  const derived = deriveRateCardPricesFromDay(normalizedDay, opts?.roundingStep);
  const explicitWeek = Number(card?.prices?.week);
  const explicitMonth = Number(card?.prices?.month);
  const explicit15Days = Number(card?.rate15Days);
  const preserveExplicit = opts?.preserveExplicitDerived !== false;

  return {
    placementKey: String(card?.placementKey || '').trim(),
    placementLabel: String(card?.placementLabel || '').trim() || String(card?.placementKey || '').trim(),
    prices: {
      day: normalizedDay,
      week: preserveExplicit && Number.isFinite(explicitWeek) ? explicitWeek : derived.week,
      month: preserveExplicit && Number.isFinite(explicitMonth) ? explicitMonth : derived.month,
    },
    rate15Days: preserveExplicit && Number.isFinite(explicit15Days) ? explicit15Days : derived.rate15Days,
    includes: Array.isArray(card?.includes) ? card.includes : [],
    specs: Array.isArray(card?.specs) ? card.specs : [],
  };
}

function defaultMediaKit(): MediaKitDoc {
  return {
    title: 'News Pulse Media Kit (Ad Rates & Sponsorship)',
    tagline: 'Sponsor placements across homepage and articles',
    contactEmail: 'newspulse.ads@gmail.com',
    currencyCode: 'INR',
    currencySymbol: '₹',
    showUsdApprox: false,
    fxRateUsdInr: 83,
    updatedAt: undefined,
    sections: [
      {
        heading: 'Audience',
        bullets: [
          'Digital news readers across web and mobile',
          'Brand-safe placements next to editorial content',
          'Campaign reporting available on request',
        ],
      },
      {
        heading: 'What you get',
        bullets: [
          'Guaranteed slot placement for the selected dates',
          'Click-through linking (optional)',
          'Creative approval + quick swaps on request',
        ],
      },
      {
        heading: 'Creative guidance',
        bullets: [
          'Use high-contrast imagery and clear CTA text',
          'Keep file sizes reasonable for fast loading',
          'UTM parameters supported in destination URL',
        ],
      },
    ],
    tickerScrollAds: {
      title: 'Ticker Scroll Advertisements',
      description: 'Sponsored messages appear inside marquee-style news tickers with clear Advertisement labeling and optional click-through URLs.',
      placements: [
        'Breaking ticker (red)',
        'Live Updates ticker (blue)',
        '/breaking page sponsor line',
      ],
      rules: [
        '120-140 characters recommended for best readability',
        'Optional destination URL supported',
        'Every paid line is labeled Advertisement',
      ],
      scheduling: [
        'Booking windows: 1d, 3d, 7d, 15d, 1m, 1y',
        'Daypart targeting available: morning, noon, evening, night',
      ],
      frequency: [
        'Default insertion cadence: every 3 lines',
        'Higher-frequency upgrades available on request',
      ],
      pricingTables: [
        {
          title: 'Intro Price (Current)',
          subtitle: 'Best for early partners',
      brandedProducts: [
        {
          productKey: 'SPONSORED_FEATURE',
          name: 'Sponsored Feature',
          description: 'Premium branded content block inside the homepage content flow with image, headline, short summary, CTA, and clear Sponsored Feature label.',
          pricingPeriods: ['1d', '3d', '7d', '15d', '1m'],
          pricingTables: [
            {
              title: 'Intro Price (Current)',
              subtitle: 'Best for early partners',
              prices: {
                '1d': 1500,
                '3d': 4200,
                '7d': 8500,
                '15d': 16000,
                '1m': 28000,
              },
            },
            {
              title: 'Standard Price (Official)',
              subtitle: 'Regular rate card',
              prices: {
                '1d': 2000,
                '3d': 5500,
                '7d': 12000,
                '15d': 22000,
                '1m': 40000,
              },
            },
          ],
        },
        {
          productKey: 'SPONSORED_ARTICLE',
          name: 'Sponsored Article',
          description: 'Hosted branded article page on NewsPulse with clear sponsored label, feature image, article body, CTA, and linked destination.',
          pricingPeriods: ['perArticle'],
          pricingTables: [
            {
              title: 'Intro Price (Current)',
              subtitle: 'Best for early partners',
              prices: {
                perArticle: 6000,
              },
            },
            {
              title: 'Standard Price (Official)',
              subtitle: 'Regular rate card',
              prices: {
                perArticle: 9000,
              },
            },
          ],
        },
        {
          productKey: 'SPONSORED_FEATURE_ARTICLE_COMBO',
          name: 'Combo - Sponsored Feature + Sponsored Article',
          description: 'Homepage Sponsored Feature placement plus full hosted Sponsored Article as one bundled campaign.',
          pricingPeriods: ['3d', '7d', '15d', '1m'],
          pricingTables: [
            {
              title: 'Intro Price (Current)',
              subtitle: 'Best for early partners',
              prices: {
                '3d': 9500,
                '7d': 18000,
                '15d': 26000,
                '1m': 35000,
              },
            },
            {
              title: 'Standard Price (Official)',
              subtitle: 'Regular rate card',
              prices: {
                '3d': 12000,
                '7d': 24000,
                '15d': 34000,
                '1m': 45000,
              },
            },
          ],
        },
      ],
          prices: {
            '1d': 1500,
            '3d': 4000,
            '7d': 8500,
            '15d': 16000,
            '1m': 28000,
            '1y': 240000,
          },
          notes: ['Default cadence includes one insertion every 3 lines.'],
        },
        {
          title: 'Standard Price (Official)',
          subtitle: 'Regular rate card',
          prices: {
            '1d': 2000,
            '3d': 5500,
            '7d': 12000,
            '15d': 22000,
            '1m': 40000,
            '1y': 360000,
          },
          notes: ['Upgrade pricing for higher frequency or guaranteed premium rotation is available on request.'],
        },
      ],
      bookingEmail: 'newspulse.ads@gmail.com',
    },
    rateCards: [
      normalizeRateCard({
        placementKey: 'HOME_728x90',
        placementLabel: 'Home Banner 728×90',
        prices: { day: 500 },
        includes: ['Homepage banner placement', 'One linked destination'],
        specs: ['728×90 image'],
      }, { preserveExplicitDerived: false }),
      normalizeRateCard({
        placementKey: 'FOOTER_BANNER_728x90',
        placementLabel: 'Footer Banner 728×90',
        prices: { day: 500 },
        includes: ['Footer banner placement', 'One linked destination'],
        specs: ['728×90 image'],
      }, { preserveExplicitDerived: false }),
      normalizeRateCard({
        placementKey: 'HOME_RIGHT_300x250',
        placementLabel: 'Home Right Rail 300×250',
        prices: { day: 400 },
        includes: ['Homepage right-rail placement', 'One linked destination'],
        specs: ['300×250 image'],
      }, { preserveExplicitDerived: false }),
      normalizeRateCard({
        placementKey: 'HOME_RIGHT_300x600',
        placementLabel: 'Home Right Rail 300×600 (Half Page)',
        prices: { day: 650 },
        includes: ['Premium sidebar placement', 'One linked destination'],
        specs: ['300×600 image'],
      }, { preserveExplicitDerived: false }),
      normalizeRateCard({
        placementKey: 'HOME_BILLBOARD_970x250',
        placementLabel: 'Home Billboard 970×250 (Premium)',
        prices: { day: 900 },
        includes: ['Premium homepage billboard placement', 'One linked destination'],
        specs: ['970×250 image'],
      }, { preserveExplicitDerived: false }),
      normalizeRateCard({
        placementKey: 'LIVE_UPDATE_SPONSOR',
        placementLabel: 'Live Update Sponsor (Sponsored by <Brand>)',
        prices: { day: 700 },
        includes: ['Live update sponsor line (“Sponsored by Brand”)'],
        specs: ['Brand name text (no image)'],
      }, { preserveExplicitDerived: false }),
      normalizeRateCard({
        placementKey: 'BREAKING_SPONSOR',
        placementLabel: 'Breaking Sponsor (Sponsored by <Brand>)',
        prices: { day: 700 },
        includes: ['Breaking sponsor line (“Sponsored by Brand”)'],
        specs: ['Brand name text (no image)'],
      }, { preserveExplicitDerived: false }),
      normalizeRateCard({
        placementKey: 'ARTICLE_INLINE',
        placementLabel: 'Article Inline',
        prices: { day: 300 },
        includes: ['Inline placement within article body'],
        specs: ['Recommended 728×90 or 300×250'],
      }, { preserveExplicitDerived: false }),
      normalizeRateCard({
        placementKey: 'ARTICLE_END',
        placementLabel: 'Article End',
        prices: { day: 200 },
        includes: ['Placement at the end of articles'],
        specs: ['Recommended 728×90 or 300×250'],
      }, { preserveExplicitDerived: false }),
    ],
    bundles: [
      {
        name: 'Article Boost Pack',
        prices: { day: 450, week: 2700, month: 9000 },
        billingPeriod: 'week',
        includes: ['Article Inline placement (7 days)', 'Article End placement (7 days)'],
        notes: ['Best value for sustained article visibility'],
      },
      {
        name: 'Homepage + Live Updates Pack',
        prices: { day: 1100, week: 6600, month: 22000 },
        billingPeriod: 'week',
        includes: ['Home Banner 728×90 (7 days)', 'Live Update Sponsor (7 days)'],
        notes: ['Bundle mention: combines HOME_728x90 + LIVE_UPDATE_SPONSOR'],
      },
    ],
    policies: [
      'All rates in INR (₹). Inventory subject to availability.',
      'We reserve the right to reject creatives that violate policies or applicable laws.',
    ],
  };
}

function formatMoney(value: number, currencyCode: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode || 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatUsdApproxFromInr(valueInInr: number, fxRateUsdInr?: number): string | null {
  const inr = Number(valueInInr);
  const rate = Number(fxRateUsdInr);
  if (!Number.isFinite(inr) || !Number.isFinite(rate) || rate <= 0) return null;
  const usd = inr / rate;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(usd);
}

function formatTickerScrollPeriodLabel(period: MediaKitTickerPricingPeriod): string {
  return TICKER_SCROLL_PRICING_PERIODS.find((entry) => entry.key === period)?.label || period;
}

function formatBrandedProductPeriodLabel(period: MediaKitBrandedPricingPeriod): string {
  return BRANDED_PRODUCT_PRICING_PERIODS.find((entry) => entry.key === period)?.label || period;
}

function formatMediaKitAsText(doc: MediaKitDoc): string {
  const lines: string[] = [];
  lines.push(doc.title);
  if (doc.tagline) lines.push(doc.tagline);
  lines.push('');

  if (doc.sections?.length) {
    for (const s of doc.sections) {
      lines.push(s.heading);
      for (const b of (s.bullets || [])) lines.push(`- ${b}`);
      lines.push('');
    }
  }

  if (doc.tickerScrollAds) {
    lines.push(doc.tickerScrollAds.title);
    if (doc.tickerScrollAds.description) lines.push(doc.tickerScrollAds.description);
    lines.push('Placements');
    for (const item of (doc.tickerScrollAds.placements || [])) lines.push(`- ${item}`);
    lines.push('Rules');
    for (const item of (doc.tickerScrollAds.rules || [])) lines.push(`- ${item}`);
    lines.push('Scheduling');
    for (const item of (doc.tickerScrollAds.scheduling || [])) lines.push(`- ${item}`);
    lines.push('Frequency');
    for (const item of (doc.tickerScrollAds.frequency || [])) lines.push(`- ${item}`);
    lines.push('Language Packages (Ticker Scroll Ads)');
    for (const item of TICKER_SCROLL_LANGUAGE_PACKAGE_BULLETS) lines.push(`- ${item}`);
    lines.push('Pricing');
    for (const table of (doc.tickerScrollAds.pricingTables || [])) {
      lines.push(table.subtitle ? `${table.title} - ${table.subtitle}` : table.title);
      for (const period of TICKER_SCROLL_PRICING_PERIODS) {
        lines.push(`  • ${formatTickerScrollPeriodLabel(period.key)}: ${formatMoney(table.prices[period.key], doc.currencyCode)}`);
      }
      lines.push(`  • Two Languages (EN+HI / EN+GU / HI+GU): base × ${TICKER_SCROLL_LANGUAGE_MULTIPLIERS.two}×`);
      lines.push(`  • All Three Languages (EN+HI+GU): base × ${TICKER_SCROLL_LANGUAGE_MULTIPLIERS.allThree}×`);
      for (const note of (table.notes || [])) lines.push(`  • ${note}`);
    }
    const bookingEmail = doc.tickerScrollAds.bookingEmail || doc.contactEmail;
    if (bookingEmail) lines.push(`Booking: ${bookingEmail}`);
    lines.push('');
  }

  if (doc.brandedProducts?.length) {
    lines.push('Branded Content Products');
    for (const product of doc.brandedProducts) {
      lines.push(product.name);
      if (product.description) lines.push(product.description);
      for (const table of (product.pricingTables || [])) {
        lines.push(table.subtitle ? `${table.title} - ${table.subtitle}` : table.title);
        for (const period of (product.pricingPeriods || [])) {
          const value = table.prices?.[period];
          if (value == null) continue;
          lines.push(`  • ${formatBrandedProductPeriodLabel(period)}: ${formatMoney(value, doc.currencyCode)}`);
        }
        for (const note of (table.notes || [])) lines.push(`  • ${note}`);
      }
      lines.push('');
    }
  }

  lines.push('Rates');
  for (const r of (doc.rateCards || [])) {
    const day = `${formatMoney(r.prices.day, doc.currencyCode)}/day`;
    const week = `${formatMoney(r.prices.week, doc.currencyCode)}/week`;
    const fifteenDays = `${formatMoney(r.rate15Days, doc.currencyCode)}/15 days`;
    const month = `${formatMoney(r.prices.month, doc.currencyCode)}/month`;
    lines.push(`${r.placementLabel} (${r.placementKey}): ${day}, ${week}, ${fifteenDays}, ${month}`);
    for (const i of (r.includes || [])) lines.push(`  • ${i}`);
    for (const sp of (r.specs || [])) lines.push(`  • Spec: ${sp}`);
  }
  lines.push('');

  if (doc.bundles?.length) {
    lines.push('Bundles');
    for (const b of doc.bundles) {
      const primary = b.billingPeriod;
      const primaryPrice = b.prices?.[primary];
      const label = primaryPrice != null
        ? `${formatMoney(primaryPrice, doc.currencyCode)}/${primary}`
        : '';
      const extras: string[] = [];
      if (b.prices?.day != null && primary !== 'day') extras.push(`${formatMoney(b.prices.day, doc.currencyCode)}/day`);
      if (b.prices?.week != null && primary !== 'week') extras.push(`${formatMoney(b.prices.week, doc.currencyCode)}/week`);
      if (b.prices?.month != null && primary !== 'month') extras.push(`${formatMoney(b.prices.month, doc.currencyCode)}/month`);
      lines.push(`${b.name}: ${label}${extras.length ? ` (also ${extras.join(', ')})` : ''}`);
      for (const i of (b.includes || [])) lines.push(`  • ${i}`);
      for (const n of (b.notes || [])) lines.push(`  • ${n}`);
    }
    lines.push('');
  }

  if (doc.policies?.length) {
    lines.push('Notes');
    for (const p of doc.policies) lines.push(`- ${p}`);
    lines.push('');
  }

  if (doc.contactEmail) lines.push(`Contact: ${doc.contactEmail}`);
  return lines.join('\n').trim() + '\n';
}

type SponsorAd = {
  id: string;
  slot: AdSlot | string;
  title?: string | null;
  imageUrl: string;
  targetUrl?: string | null;
  clickable?: boolean | null;
  priority?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive: boolean;
  updatedAt?: string | null;
  createdAt?: string | null;
};

// Slots that have placement toggles in the UI.
const PLACEMENT_SLOT_OPTIONS = [
  'HOME_728x90',
  'FOOTER_BANNER_728x90',
  'HOME_RIGHT_300x250',
  'HOME_RIGHT_300x600',
  'HOME_BILLBOARD_970x250',
  'LIVE_UPDATE_SPONSOR',
  'BREAKING_SPONSOR',
  'ARTICLE_INLINE',
  'ARTICLE_END',
] as const satisfies readonly AdSlot[];

// Slots selectable in the UI (dropdown + filter). Legacy slots are intentionally hidden.
const SLOT_OPTIONS = [
  'HOME_728x90',
  'FOOTER_BANNER_728x90',
  'HOME_RIGHT_300x250',
  'HOME_RIGHT_300x600',
  'HOME_BILLBOARD_970x250',
  'LIVE_UPDATE_SPONSOR',
  'BREAKING_SPONSOR',
  'ARTICLE_INLINE',
  'ARTICLE_END',
] as const satisfies readonly AdSlot[];

type PlacementSlotOption = typeof PLACEMENT_SLOT_OPTIONS[number];
type PlacementFieldShape = 'boolean' | 'enabled' | 'isEnabled';

const SLOT_LABELS: Record<string, string> = {
  HOME_728x90: 'Home Banner 728×90',
  FOOTER_BANNER_728x90: 'Footer Banner 728×90',
  HOME_RIGHT_300x250: 'Home Right Rail 300×250',
  HOME_RIGHT_300x600: 'Home Right Rail 300×600 (Half Page)',
  HOME_BILLBOARD_970x250: 'Home Billboard 970×250 (Premium)',
  LIVE_UPDATE_SPONSOR: 'Live Update Sponsor (Sponsored by <Brand>)',
  BREAKING_SPONSOR: 'Breaking Sponsor (Sponsored by <Brand>)',
  ARTICLE_INLINE: 'Article Inline',
  ARTICLE_END: 'Article End',
  HOME_RIGHT_RAIL: 'Home Right Rail (legacy)',
};

const SLOT_DROPDOWN_HINT_LABELS: Record<string, string> = {
  HOME_RIGHT_300x600: 'Home Right Rail 300×600 (Half Page / Premium Sidebar)',
  HOME_BILLBOARD_970x250: 'Home Billboard 970×250 (Billboard / Premium)',
  LIVE_UPDATE_SPONSOR: 'Live Update Sponsor (Ticker / “Sponsored by Brand”)',
  BREAKING_SPONSOR: 'Breaking Sponsor (Breaking ticker / “Sponsored by Brand”)',
};

function slotDropdownLabel(slot: string): string {
  return SLOT_DROPDOWN_HINT_LABELS[slot] || slotLabel(slot);
}

function canonicalSlot(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // Normalize common label formats (e.g. "Article End" -> "ARTICLE_END").
  const normalized = raw
    .toUpperCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/__+/g, '_')
    .trim();
  // Preserve exact backend enum casing (note the lowercase 'x').
  if (normalized === 'HOME_728X90') return 'HOME_728x90';
  if (normalized === 'FOOTER_BANNER_728X90') return 'FOOTER_BANNER_728x90';
  if (normalized === 'HOME_RIGHT_300X250') return 'HOME_RIGHT_300x250';
  if (normalized === 'HOME_RIGHT_300X600') return 'HOME_RIGHT_300x600';
  if (normalized === 'HOME_BILLBOARD_970X250') return 'HOME_BILLBOARD_970x250';
  if (normalized === 'LIVE_UPDATE_SPONSOR') return 'LIVE_UPDATE_SPONSOR';
  if (normalized === 'BREAKING_SPONSOR') return 'BREAKING_SPONSOR';
  if (normalized === 'HOME_RIGHT_RAIL') return 'HOME_RIGHT_RAIL';
  if (normalized === 'ARTICLE_INLINE') return 'ARTICLE_INLINE';
  if (normalized === 'ARTICLE_END') return 'ARTICLE_END';

  return raw;
}

function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] || slot;
}

function isLegacySlot(slot: string): boolean {
  return canonicalSlot(slot) === 'HOME_RIGHT_RAIL' || slotLabel(slot).includes('(legacy)');
}

function safeDateLabel(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function formatAdScheduleDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod').toUpperCase();

  if (!day || !month || !year || !hour || !minute || !dayPeriod) {
    return d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).replace(' am', ' AM').replace(' pm', ' PM');
  }

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

function formatAdScheduleRange(startAt?: string | null, endAt?: string | null): string {
  if (!startAt && !endAt) return '-';
  if (startAt && endAt) return `${formatAdScheduleDateTime(startAt)} → ${formatAdScheduleDateTime(endAt)}`;
  if (startAt) return `Starts: ${formatAdScheduleDateTime(startAt)}`;
  return `Ends: ${formatAdScheduleDateTime(endAt)}`;
}

function toDatetimeLocalValue(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const v = (value || '').trim();
  if (!v) return null;

  // `datetime-local` inputs produce local timestamps like: "YYYY-MM-DDTHH:mm".
  // Convert to a real Date in LOCAL time, then send an ISO timestamp (UTC) to the backend.
  // This prevents accidentally sending locale-formatted display strings.
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const hh = Number(m[4]);
    const min = Number(m[5]);
    const ss = Number(m[6] || 0);
    const d = new Date(yyyy, mm - 1, dd, hh, min, ss, 0);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  // Fallback: tolerate full ISO strings or other parseable inputs.
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function inquiryReplySubject(inquiry: Pick<AdInquiry, 'name'>): string {
  const name = String(inquiry?.name || '').trim();
  return name ? `Re: NewsPulse ad inquiry from ${name}` : 'Re: NewsPulse ad inquiry';
}

function inquiryReplyDraftMessage(inquiry: Pick<AdInquiry, 'name'>): string {
  const name = String(inquiry?.name || '').trim();
  return `${name ? `Hello ${name},` : 'Hello,'}\n\n`;
}

type InquiryReplyMeta = Pick<AdInquiry, 'hasReply' | 'lastRepliedAt' | 'lastRepliedBy' | 'replyCount' | 'lastReplySubject'>;

function applyReplyMeta(inquiry: AdInquiry, meta?: InquiryReplyMeta): AdInquiry {
  if (!meta) return inquiry;
  return { ...inquiry, ...meta };
}

type InquiryApiErrorState = {
  kind: 'offline' | 'db-unavailable' | 'request';
  message: string;
  status?: number;
  url?: string;
  code?: string;
};

function isAbortError(err: any): boolean {
  const name = String(err?.name || '');
  const message = String(err?.message || '');
  return name === 'AbortError' || /aborted/i.test(message);
}

function describeInquiryError(err: any, fallback: string): InquiryApiErrorState {
  const status = typeof err?.status === 'number'
    ? err.status
    : (typeof err?.response?.status === 'number' ? err.response.status : undefined);
  const code = String(err?.code || err?.response?.data?.code || '').trim().toUpperCase() || undefined;
  const url = typeof err?.url === 'string'
    ? err.url
    : (typeof err?.response?.config?.url === 'string' ? err.response.config.url : undefined);

  if (code === 'BACKEND_OFFLINE' || status === 0) {
    return {
      kind: 'offline',
      status,
      url,
      code,
      message: 'Backend unreachable. Start local backend on http://localhost:5000 or update VITE_ADMIN_API_TARGET / VITE_DEV_PROXY_TARGET, then restart npm run dev.',
    };
  }

  if (code === 'DB_UNAVAILABLE' || status === 503) {
    return {
      kind: 'db-unavailable',
      status,
      url,
      code,
      message: 'Database unavailable. Wait for the backend database connection to recover.',
    };
  }

  return {
    kind: 'request',
    status,
    url,
    code,
    message: String(err?.message || fallback),
  };
}

function parseBool(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === '1') return true;
    if (s === '0') return false;
    if (s === 'on' || s === 'enabled' || s === 'yes') return true;
    if (s === 'off' || s === 'disabled' || s === 'no') return false;
  }
  // Default to false for unknown/undefined shapes to avoid accidental "stuck ON".
  return false;
}

function parsePlacementEnabled(value: any): boolean {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, 'enabled')) {
      return parseBool(value.enabled);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'isEnabled')) {
      return parseBool(value.isEnabled);
    }
  }
  return parseBool(value);
}

function emptyPlacementFieldShape(): Record<PlacementSlotOption, PlacementFieldShape> {
  const next = {} as Record<PlacementSlotOption, PlacementFieldShape>;
  for (const key of PLACEMENT_SLOT_OPTIONS) next[key] = 'boolean';
  return next;
}

type AdFormState = {
  slot: AdSlot | '';
  title: string;
  imageUrl: string;
  targetUrl: string;
  clickable: boolean;
  priority: string; // keep as string for input
  startAt: string; // datetime-local string
  endAt: string;
  isActive: boolean;
};

const emptyForm = (): AdFormState => ({
  slot: '',
  title: '',
  imageUrl: '',
  targetUrl: '',
  clickable: true,
  priority: '0',
  startAt: '',
  endAt: '',
  isActive: true,
});

function normalizeAd(raw: any): SponsorAd {
  return {
    id: String(raw?.id ?? raw?._id ?? ''),
    slot: canonicalSlot(raw?.slot ?? ''),
    title: raw?.title ?? null,
    imageUrl: String(raw?.imageUrl ?? raw?.image_url ?? ''),
    targetUrl: (raw?.targetUrl ?? raw?.target_url ?? null),
    clickable: (typeof raw?.clickable === 'boolean' ? raw.clickable : (typeof raw?.isClickable === 'boolean' ? raw.isClickable : null)),
    priority: raw?.priority ?? null,
    startAt: raw?.startAt ?? raw?.start_at ?? null,
    endAt: raw?.endAt ?? raw?.end_at ?? null,
    isActive: Boolean(raw?.isActive ?? raw?.active ?? false),
    updatedAt: raw?.updatedAt ?? raw?.updated ?? null,
    createdAt: raw?.createdAt ?? null,
  };
}

function extractAdsList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;

  const direct = payload?.ads;
  if (Array.isArray(direct)) return direct;

  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.ads)) return data.ads;
  if (Array.isArray(data?.items)) return data.items;

  const result = payload?.result;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.ads)) return result.ads;
  if (Array.isArray(result?.items)) return result.items;

  const items = payload?.items;
  if (Array.isArray(items)) return items;

  return [];
}

export default function AdsManager() {
  const [tab, setTab] = React.useState<'ads' | 'inquiries' | 'media-kit'>('ads');
  const { isFounder } = useAuth();

  type InquiryStatusTab = 'new' | 'read' | 'deleted';
  type InquiryTabCounts = Record<InquiryStatusTab, number | null>;
  const [inquiryStatusTab, setInquiryStatusTab] = React.useState<InquiryStatusTab>('new');
  const [inquiryPage, setInquiryPage] = React.useState(1);
  const inquiryLimit = 20;
  const [inquirySearchInput, setInquirySearchInput] = React.useState('');
  const [inquirySearch, setInquirySearch] = React.useState('');

  const [ads, setAds] = React.useState<SponsorAd[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [mediaKit, setMediaKit] = React.useState<MediaKitDoc>(() => defaultMediaKit());
  const [mediaKitSource, setMediaKitSource] = React.useState<'default' | 'saved'>('default');
  const [mediaKitLoading, setMediaKitLoading] = React.useState(false);
  const [mediaKitError, setMediaKitError] = React.useState<string | null>(null);
  const [mediaKitPreview, setMediaKitPreview] = React.useState(false);
  const [mediaKitEditing, setMediaKitEditing] = React.useState(false);
  const [mediaKitEditorText, setMediaKitEditorText] = React.useState('');
  const [mediaKitSaving, setMediaKitSaving] = React.useState(false);
  const [mediaKitResetting, setMediaKitResetting] = React.useState(false);

  const [inquiries, setInquiries] = React.useState<AdInquiry[]>([]);
  const [, setInquiriesTotal] = React.useState<number | null>(null);
  const [inquiryTabCounts, setInquiryTabCounts] = React.useState<InquiryTabCounts>({ new: null, read: null, deleted: null });
  const [inquiriesLoading, setInquiriesLoading] = React.useState(false);
  const [, setInquiriesUnreadCount] = React.useState<number | null>(null);
  const [inquiriesUnreadError, setInquiriesUnreadError] = React.useState<InquiryApiErrorState | null>(null);
  const [inquiriesError, setInquiriesError] = React.useState<InquiryApiErrorState | null>(null);
  const [inquiryBusy, setInquiryBusy] = React.useState<Record<string, boolean>>({});
  const [selectedInquiryIds, setSelectedInquiryIds] = React.useState<string[]>([]);
  const [bulkAction, setBulkAction] = React.useState<'mark-read' | 'move-to-trash' | 'restore' | 'delete-permanently' | null>(null);
  const [confirmBulkPermanentDelete, setConfirmBulkPermanentDelete] = React.useState(false);
  const lastUnreadRef = React.useRef<number | null>(null);
  const selectAllVisibleRef = React.useRef<HTMLInputElement | null>(null);
  const [inquiryReplyOverrides, setInquiryReplyOverrides] = React.useState<Record<string, InquiryReplyMeta>>({});
  const inquiryReplyOverridesRef = React.useRef<Record<string, InquiryReplyMeta>>({});

  const [inquiryView, setInquiryView] = React.useState<AdInquiry | null>(null);
  const [inquiryReply, setInquiryReply] = React.useState<{
    inquiry: AdInquiry;
    subject: string;
    message: string;
  } | null>(null);
  const [inquiryReplySending, setInquiryReplySending] = React.useState(false);

  const hasNextInquiryPage = inquiries.length === inquiryLimit;
  const hasPrevInquiryPage = inquiryPage > 1;

  const tabLabelMap: Record<InquiryStatusTab, string> = React.useMemo(() => ({
    new: 'new',
    read: 'read',
    deleted: 'deleted',
  }), []);
  const activeSubtitle = React.useMemo(() => {
    return `Showing ${tabLabelMap[inquiryStatusTab]} inquiries`;
  }, [inquiryStatusTab, tabLabelMap]);
  const activeCornerCountLabel = React.useMemo(() => {
    const value = inquiryTabCounts[inquiryStatusTab];
    return typeof value === 'number' ? String(value) : '—';
  }, [inquiryStatusTab, inquiryTabCounts]);
  const activeCornerTitle = React.useMemo(() => {
    if (inquiryStatusTab === 'new') return 'New inquiries';
    if (inquiryStatusTab === 'read') return 'Read inquiries';
    return 'Deleted inquiries';
  }, [inquiryStatusTab]);

  const emptyInquiriesText = React.useMemo(() => {
    const base = `No ${tabLabelMap[inquiryStatusTab]} inquiries`;
    if (inquirySearch) {
      return `${base} match "${inquirySearch}".`;
    }
    if (inquiryPage > 1) {
      return `${base} on page ${inquiryPage}.`;
    }
    return `${base}.`;
  }, [inquiryPage, inquirySearch, inquiryStatusTab, tabLabelMap]);

  const canEmailFromCurrentTab = inquiryStatusTab !== 'deleted';

  React.useEffect(() => {
    inquiryReplyOverridesRef.current = inquiryReplyOverrides;
  }, [inquiryReplyOverrides]);

  const visibleInquiryIds = React.useMemo(
    () => inquiries.map((inq) => String(inq.id || '').trim()).filter(Boolean),
    [inquiries]
  );
  const selectedVisibleInquiryIds = React.useMemo(
    () => selectedInquiryIds.filter((id) => visibleInquiryIds.includes(id)),
    [selectedInquiryIds, visibleInquiryIds]
  );
  const selectedCount = selectedVisibleInquiryIds.length;
  const allVisibleSelected = visibleInquiryIds.length > 0 && selectedVisibleInquiryIds.length === visibleInquiryIds.length;
  const hasSomeVisibleSelected = selectedVisibleInquiryIds.length > 0 && !allVisibleSelected;
  const bulkBusy = bulkAction !== null;

  const mailtoHref = React.useCallback((email?: string | null) => {
    const value = String(email || '').trim();
    return value ? `mailto:${value}` : '';
  }, []);

  const normalizeMediaKit = React.useCallback((raw: any): MediaKitDoc | null => {
    if (!raw || typeof raw !== 'object') return null;

    const base = defaultMediaKit();
    const title = typeof raw.title === 'string' ? raw.title : base.title;
    const tagline = typeof raw.tagline === 'string' ? raw.tagline : base.tagline;
    const contactEmail = typeof raw.contactEmail === 'string' ? raw.contactEmail : base.contactEmail;
    const currencyCode = typeof raw.currencyCode === 'string'
      ? raw.currencyCode
      : (typeof raw.currency_code === 'string' ? raw.currency_code : base.currencyCode);
    const currencySymbol = typeof raw.currencySymbol === 'string'
      ? raw.currencySymbol
      : (typeof raw.currency_symbol === 'string' ? raw.currency_symbol : base.currencySymbol);
    const showUsdApprox = typeof raw.showUsdApprox === 'boolean'
      ? raw.showUsdApprox
      : (typeof raw.show_usd_approx === 'boolean' ? raw.show_usd_approx : base.showUsdApprox);
    const fxRateUsdInr = Number(
      raw.fxRateUsdInr
      ?? raw.fx_rate_usd_inr
      ?? base.fxRateUsdInr
    );
    const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : (typeof raw.updated_at === 'string' ? raw.updated_at : base.updatedAt);
    const rawTickerScrollAds = raw.tickerScrollAds ?? raw.tickerScrollAdvertisements ?? raw.ticker_scroll_ads;
    const rawBrandedProducts = raw.brandedProducts ?? raw.branded_products ?? raw.sponsoredProducts ?? raw.sponsored_products;

    const sections = Array.isArray(raw.sections)
      ? raw.sections
        .filter(Boolean)
        .map((s: any) => ({
          heading: String(s?.heading ?? s?.title ?? '').trim() || 'Section',
          bullets: Array.isArray(s?.bullets) ? s.bullets.map((b: any) => String(b).trim()).filter(Boolean) : [],
        }))
      : base.sections;

    const tickerScrollAds = (() => {
      if (!rawTickerScrollAds || typeof rawTickerScrollAds !== 'object') return base.tickerScrollAds;

      const baseTicker = base.tickerScrollAds;

      const normalizeTickerPrices = (rawPrices: any, basePrices: MediaKitTickerPricingMap): MediaKitTickerPricingMap => {
        const source = rawPrices && typeof rawPrices === 'object' ? rawPrices : {};
        return {
          '1d': Number.isFinite(Number(source['1d'] ?? source.oneDay ?? source.day1 ?? source.day ?? undefined)) ? Number(source['1d'] ?? source.oneDay ?? source.day1 ?? source.day) : basePrices['1d'],
          '3d': Number.isFinite(Number(source['3d'] ?? source.threeDay ?? source.day3 ?? undefined)) ? Number(source['3d'] ?? source.threeDay ?? source.day3) : basePrices['3d'],
          '7d': Number.isFinite(Number(source['7d'] ?? source.sevenDay ?? source.day7 ?? undefined)) ? Number(source['7d'] ?? source.sevenDay ?? source.day7) : basePrices['7d'],
          '15d': Number.isFinite(Number(source['15d'] ?? source.fifteenDay ?? source.day15 ?? undefined)) ? Number(source['15d'] ?? source.fifteenDay ?? source.day15) : basePrices['15d'],
          '1m': Number.isFinite(Number(source['1m'] ?? source.month1 ?? source.month ?? undefined)) ? Number(source['1m'] ?? source.month1 ?? source.month) : basePrices['1m'],
          '1y': Number.isFinite(Number(source['1y'] ?? source.year1 ?? source.year ?? undefined)) ? Number(source['1y'] ?? source.year1 ?? source.year) : basePrices['1y'],
        };
      };

      const rawPricingTables = Array.isArray(rawTickerScrollAds.pricingTables)
        ? rawTickerScrollAds.pricingTables
        : [
            rawTickerScrollAds.introPricing ? {
              title: 'Intro Price (Current)',
              subtitle: 'Best for early partners',
              prices: rawTickerScrollAds.introPricing,
            } : null,
            rawTickerScrollAds.standardPricing ? {
              title: 'Standard Price (Official)',
              subtitle: 'Regular rate card',
              prices: rawTickerScrollAds.standardPricing,
            } : null,
          ].filter(Boolean);

      const pricingTables = (Array.isArray(rawPricingTables) && rawPricingTables.length > 0)
        ? baseTicker.pricingTables.map((baseTable) => {
            const match = rawPricingTables.find((entry: any) => String(entry?.title ?? '').trim() === baseTable.title);
            const source = match && typeof match === 'object' ? match : null;
            return {
              title: String(source?.title ?? baseTable.title).trim() || baseTable.title,
              subtitle: String(source?.subtitle ?? baseTable.subtitle ?? '').trim() || baseTable.subtitle,
              prices: normalizeTickerPrices(source?.prices ?? source?.pricing ?? source?.priceByPeriod ?? source?.price_by_period, baseTable.prices),
              notes: Array.isArray(source?.notes)
                ? source.notes.map((note: any) => String(note).trim()).filter(Boolean)
                : (baseTable.notes || []),
            } as MediaKitTickerPricingTable;
          })
        : baseTicker.pricingTables;

      return {
        title: String(rawTickerScrollAds.title ?? baseTicker.title).trim() || baseTicker.title,
        description: String(rawTickerScrollAds.description ?? baseTicker.description).trim() || baseTicker.description,
        placements: Array.isArray(rawTickerScrollAds.placements)
          ? rawTickerScrollAds.placements.map((item: any) => String(item).trim()).filter(Boolean)
          : baseTicker.placements,
        rules: Array.isArray(rawTickerScrollAds.rules)
          ? rawTickerScrollAds.rules.map((item: any) => String(item).trim()).filter(Boolean)
          : baseTicker.rules,
        scheduling: Array.isArray(rawTickerScrollAds.scheduling)
          ? rawTickerScrollAds.scheduling.map((item: any) => String(item).trim()).filter(Boolean)
          : baseTicker.scheduling,
        frequency: Array.isArray(rawTickerScrollAds.frequency)
          ? rawTickerScrollAds.frequency.map((item: any) => String(item).trim()).filter(Boolean)
          : baseTicker.frequency,
        pricingTables,
        bookingEmail: String(rawTickerScrollAds.bookingEmail ?? rawTickerScrollAds.contactEmail ?? baseTicker.bookingEmail ?? '').trim() || baseTicker.bookingEmail,
      } as MediaKitTickerScrollAds;
    })();

    const brandedProductsFromRaw = Array.isArray(rawBrandedProducts)
      ? rawBrandedProducts
        .filter(Boolean)
        .map((product: any) => {
          const productKey = String(product?.productKey ?? product?.key ?? '').trim();
          const name = String(product?.name ?? product?.title ?? '').trim() || productKey || 'Product';
          const baseProduct = base.brandedProducts.find((entry) => entry.productKey === productKey || entry.name === name);

          const pricingPeriods = Array.isArray(product?.pricingPeriods)
            ? product.pricingPeriods
              .map((period: any) => String(period).trim())
              .filter((period: any): period is MediaKitBrandedPricingPeriod => BRANDED_PRODUCT_PRICING_PERIODS.some((entry) => entry.key === period))
            : (baseProduct?.pricingPeriods || []);

          const rawPricingTables = Array.isArray(product?.pricingTables)
            ? product.pricingTables
            : [
                product?.introPricing ? {
                  title: 'Intro Price (Current)',
                  subtitle: 'Best for early partners',
                  prices: product.introPricing,
                } : null,
                product?.standardPricing ? {
                  title: 'Standard Price (Official)',
                  subtitle: 'Regular rate card',
                  prices: product.standardPricing,
                } : null,
              ].filter(Boolean);

          const pricingTables = (Array.isArray(rawPricingTables) && rawPricingTables.length > 0)
            ? rawPricingTables.map((table: any, index: number) => {
                const baseTable = baseProduct?.pricingTables?.[index];
                const pricesSource = table?.prices ?? table?.pricing ?? table?.priceByPeriod ?? table?.price_by_period ?? {};
                const prices: MediaKitBrandedPricingMap = {};
                for (const period of (pricingPeriods.length ? pricingPeriods : (baseProduct?.pricingPeriods || []))) {
                  const rawValue = pricesSource?.[period];
                  if (Number.isFinite(Number(rawValue))) {
                    prices[period] = Number(rawValue);
                    continue;
                  }
                  const fallbackValue = baseTable?.prices?.[period];
                  if (Number.isFinite(Number(fallbackValue))) prices[period] = Number(fallbackValue);
                }

                return {
                  title: String(table?.title ?? baseTable?.title ?? '').trim() || baseTable?.title || 'Pricing',
                  subtitle: String(table?.subtitle ?? baseTable?.subtitle ?? '').trim() || baseTable?.subtitle,
                  prices,
                  notes: Array.isArray(table?.notes)
                    ? table.notes.map((note: any) => String(note).trim()).filter(Boolean)
                    : (baseTable?.notes || []),
                } as MediaKitBrandedPricingTable;
              })
            : (baseProduct?.pricingTables || []);

          return {
            productKey: productKey || baseProduct?.productKey || name.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
            name,
            description: String(product?.description ?? baseProduct?.description ?? '').trim() || baseProduct?.description || '',
            pricingPeriods: pricingPeriods.length ? pricingPeriods : (baseProduct?.pricingPeriods || []),
            pricingTables,
          } as MediaKitBrandedProduct;
        })
        .filter((product: MediaKitBrandedProduct) => product.productKey)
      : null;

    const brandedProducts = (() => {
      if (!brandedProductsFromRaw) return base.brandedProducts;

      const rawByKey = new Map<string, MediaKitBrandedProduct>();
      for (const product of brandedProductsFromRaw) rawByKey.set(product.productKey, product);

      const merged: MediaKitBrandedProduct[] = [];
      for (const baseProduct of base.brandedProducts) {
        merged.push(rawByKey.get(baseProduct.productKey) || baseProduct);
        rawByKey.delete(baseProduct.productKey);
      }

      for (const leftover of rawByKey.values()) merged.push(leftover);
      return merged;
    })();

    const rateCardsFromRaw = Array.isArray(raw.rateCards)
      ? raw.rateCards
        .filter(Boolean)
        .map((r: any) => {
          const placementKey = String(r?.placementKey ?? r?.key ?? '').trim();
          const placementLabel = String(r?.placementLabel ?? r?.label ?? '').trim() || placementKey;
          const baseCard = base.rateCards.find((c) => c.placementKey === placementKey);

          const hasExplicitPrices =
            (r && typeof r === 'object')
            && (r.prices != null || r.pricing != null || r.priceByPeriod != null || r.price_by_period != null);

          const pricesRaw = hasExplicitPrices
            ? (r?.prices ?? r?.pricing ?? r?.priceByPeriod ?? r?.price_by_period ?? {})
            : {};
          let day = Number(pricesRaw?.day ?? pricesRaw?.daily ?? undefined);
          let week = Number(pricesRaw?.week ?? pricesRaw?.weekly ?? undefined);
          let month = Number(pricesRaw?.month ?? pricesRaw?.monthly ?? undefined);
          let rate15Days = Number(
            r?.rate15Days
            ?? r?.rate_fifteen_days
            ?? r?.rateFortnight
            ?? pricesRaw?.rate15Days
            ?? pricesRaw?.fifteenDays
            ?? pricesRaw?.fortnight
            ?? undefined
          );

          return normalizeRateCard({
            placementKey,
            placementLabel,
            prices: {
              day: Number.isFinite(day) ? day : (baseCard?.prices.day ?? 0),
              ...(Number.isFinite(week) ? { week } : {}),
              ...(Number.isFinite(month) ? { month } : {}),
            },
            ...(Number.isFinite(rate15Days) ? { rate15Days } : {}),
            includes: Array.isArray(r?.includes) ? r.includes.map((i: any) => String(i).trim()).filter(Boolean) : [],
            specs: Array.isArray(r?.specs) ? r.specs.map((i: any) => String(i).trim()).filter(Boolean) : [],
          }, {
            preserveExplicitDerived: true,
          });
        })
        .filter((r: any) => r.placementKey)
      : null;

    const rateCards = (() => {
      if (!rateCardsFromRaw) return base.rateCards;

      const rawByKey = new Map<string, MediaKitRateCard>();
      for (const r of rateCardsFromRaw) rawByKey.set(r.placementKey, r);

      const merged: MediaKitRateCard[] = [];
      for (const baseCard of base.rateCards) {
        merged.push(rawByKey.get(baseCard.placementKey) || baseCard);
        rawByKey.delete(baseCard.placementKey);
      }

      // Preserve any custom/unknown cards from backend.
      for (const leftover of rawByKey.values()) merged.push(leftover);
      return merged;
    })();

    const bundlesFromRaw = Array.isArray(raw.bundles)
      ? raw.bundles
        .filter(Boolean)
        .map((b: any) => {
          const name = String(b?.name ?? '').trim() || 'Bundle';
          const baseBundle = base.bundles.find((x) => x.name === name);
          const hasExplicitPrices =
            (b && typeof b === 'object')
            && (b.prices != null || b.pricing != null || b.priceByPeriod != null || b.price_by_period != null);

          const pricesRaw = hasExplicitPrices
            ? (b?.prices ?? b?.pricing ?? b?.priceByPeriod ?? b?.price_by_period ?? {})
            : {};
          let day = Number(pricesRaw?.day ?? pricesRaw?.daily ?? undefined);
          let week = Number(pricesRaw?.week ?? pricesRaw?.weekly ?? undefined);
          let month = Number(pricesRaw?.month ?? pricesRaw?.monthly ?? undefined);

          const billingPeriodRaw = String(b?.billingPeriod ?? b?.billing_period ?? '').toLowerCase();
          const billingPeriod = (billingPeriodRaw === 'day' || billingPeriodRaw === 'week' || billingPeriodRaw === 'month')
            ? (billingPeriodRaw as any)
            : (baseBundle?.billingPeriod ?? 'week');

          return {
            name,
            prices: {
              day: Number.isFinite(day) ? day : baseBundle?.prices?.day,
              week: Number.isFinite(week) ? week : baseBundle?.prices?.week,
              month: Number.isFinite(month) ? month : baseBundle?.prices?.month,
            },
            billingPeriod,
            includes: Array.isArray(b?.includes) ? b.includes.map((i: any) => String(i).trim()).filter(Boolean) : [],
            notes: Array.isArray(b?.notes) ? b.notes.map((i: any) => String(i).trim()).filter(Boolean) : [],
          } as MediaKitBundle;
        })
      : null;

    const bundles = (() => {
      if (!bundlesFromRaw) return base.bundles;
      const rawByName = new Map<string, MediaKitBundle>();
      for (const b of bundlesFromRaw) rawByName.set(b.name, b);

      const merged: MediaKitBundle[] = [];
      for (const baseBundle of base.bundles) {
        merged.push(rawByName.get(baseBundle.name) || baseBundle);
        rawByName.delete(baseBundle.name);
      }

      for (const leftover of rawByName.values()) merged.push(leftover);
      return merged;
    })();

    const policies = Array.isArray(raw.policies)
      ? raw.policies.map((p: any) => String(p).trim()).filter(Boolean)
      : base.policies;

    return {
      title,
      tagline,
      contactEmail,
      currencyCode: String(currencyCode || base.currencyCode || 'INR').toUpperCase(),
      currencySymbol: String(currencySymbol || base.currencySymbol || '₹'),
      showUsdApprox: Boolean(showUsdApprox),
      fxRateUsdInr: Number.isFinite(fxRateUsdInr) && fxRateUsdInr > 0 ? fxRateUsdInr : base.fxRateUsdInr,
      updatedAt,
      sections,
      tickerScrollAds,
      brandedProducts,
      rateCards,
      bundles,
      policies,
    };
  }, []);

  const fetchMediaKit = React.useCallback(async () => {
    setMediaKitLoading(true);
    setMediaKitError(null);
    try {
      const res = await api.get('/admin/media-kit');
      const payload = res?.data;
      const raw = payload?.mediaKit || payload?.data?.mediaKit || payload?.data || payload;
      const normalized = normalizeMediaKit(raw);
      if (normalized) {
        setMediaKit(normalized);
        setMediaKitSource('saved');
      } else {
        setMediaKit(defaultMediaKit());
        setMediaKitSource('default');
      }
    } catch (err: any) {
      setMediaKit(defaultMediaKit());
      setMediaKitSource('default');
      setMediaKitError(err?.response?.data?.message || err?.message || 'Failed to load media kit');
    } finally {
      setMediaKitLoading(false);
    }
  }, [normalizeMediaKit]);

  React.useEffect(() => {
    void fetchMediaKit();
  }, [fetchMediaKit]);

  const copyMediaKitAsText = React.useCallback(async () => {
    try {
      const text = formatMediaKitAsText(mediaKit);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', 'true');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast.success('Media Kit copied');
    } catch (err: any) {
      toast.error(err?.message || 'Copy failed');
    }
  }, [mediaKit]);

  const openMediaKitEditor = React.useCallback(() => {
    setMediaKitEditorText(JSON.stringify(mediaKit, null, 2));
    setMediaKitEditing(true);
    setMediaKitPreview(false);
  }, [mediaKit]);

  const recalculateMediaKitEditorRates = React.useCallback(() => {
    let parsed: any;
    try {
      parsed = JSON.parse(String(mediaKitEditorText || ''));
    } catch {
      toast.error('Invalid JSON');
      return;
    }

    const normalized = normalizeMediaKit(parsed);
    if (!normalized) {
      toast.error('Media Kit JSON is missing required fields');
      return;
    }

    const next: MediaKitDoc = {
      ...normalized,
      rateCards: (normalized.rateCards || []).map((card) => normalizeRateCard({
        placementKey: card.placementKey,
        placementLabel: card.placementLabel,
        prices: { day: card.prices.day },
        includes: card.includes,
        specs: card.specs,
      }, {
        preserveExplicitDerived: false,
      })),
    };

    setMediaKitEditorText(JSON.stringify(next, null, 2));
    toast.success('Rate cards recalculated from 1 Day');
  }, [mediaKitEditorText, normalizeMediaKit]);

  const cancelMediaKitEditor = React.useCallback(() => {
    if (mediaKitSaving || mediaKitResetting) return;
    setMediaKitEditing(false);
  }, [mediaKitSaving, mediaKitResetting]);

  const saveMediaKit = React.useCallback(async () => {
    if (!isFounder) return;
    if (mediaKitSaving) return;

    let parsed: any;
    try {
      parsed = JSON.parse(String(mediaKitEditorText || ''));
    } catch {
      toast.error('Invalid JSON');
      return;
    }

    const normalized = normalizeMediaKit(parsed);
    if (!normalized) {
      toast.error('Media Kit JSON is missing required fields');
      return;
    }

    setMediaKitSaving(true);
    try {
      const res = await api.put('/admin/media-kit', normalized);
      const payload = res?.data;
      const raw = payload?.mediaKit || payload?.data?.mediaKit || payload?.data || payload;
      const next = normalizeMediaKit(raw) || normalized;
      setMediaKit(next);
      setMediaKitSource('saved');
      setMediaKitEditing(false);
      toast.success('Media Kit saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setMediaKitSaving(false);
    }
  }, [isFounder, mediaKitEditorText, mediaKitSaving, normalizeMediaKit]);

  const resetMediaKit = React.useCallback(async () => {
    if (!isFounder) return;
    if (mediaKitResetting) return;
    setMediaKitResetting(true);
    try {
      const res = await api.post('/admin/media-kit/reset');
      const payload = res?.data;
      const raw = payload?.mediaKit || payload?.data?.mediaKit || payload?.data || payload;
      const next = normalizeMediaKit(raw);
      if (next) {
        setMediaKit(next);
        setMediaKitSource('saved');
      } else {
        await fetchMediaKit();
      }
      toast.success('Reset to default');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 501) {
        toast.error('Reset endpoint not available on this backend');
      } else {
        toast.error(err?.response?.data?.message || err?.message || 'Reset failed');
      }
    } finally {
      setMediaKitResetting(false);
    }
  }, [isFounder, mediaKitResetting, normalizeMediaKit, fetchMediaKit]);

  const openInquiryReplyComposer = React.useCallback((inquiry: AdInquiry) => {
    setInquiryReply({
      inquiry,
      subject: inquiryReplySubject(inquiry),
      message: inquiryReplyDraftMessage(inquiry),
    });
  }, []);

  const closeInquiryReplyComposer = React.useCallback(() => {
    if (inquiryReplySending) return;
    setInquiryReply(null);
  }, [inquiryReplySending]);

  const closeInquiryView = React.useCallback(() => {
    setInquiryReply(null);
    setInquiryView(null);
  }, []);

  const sendInquiryReply = React.useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!inquiryReply || inquiryReplySending) return;

    const subject = inquiryReply.subject.trim();
    const message = inquiryReply.message.trim();

    if (!subject) {
      toast.error('Subject is required');
      return;
    }

    if (!message) {
      toast.error('Message is required');
      return;
    }

    setInquiryReplySending(true);
    try {
      await replyToAdInquiry(inquiryReply.inquiry.id, { subject, message });
      const nextReplyMeta: InquiryReplyMeta = {
        hasReply: true,
        lastRepliedAt: new Date().toISOString(),
        lastRepliedBy: inquiryReply.inquiry.lastRepliedBy || 'Admin',
        replyCount: (typeof inquiryReply.inquiry.replyCount === 'number' ? inquiryReply.inquiry.replyCount : 0) + 1,
        lastReplySubject: subject,
      };

      setInquiryReplyOverrides((prev) => ({
        ...prev,
        [inquiryReply.inquiry.id]: {
          ...prev[inquiryReply.inquiry.id],
          ...nextReplyMeta,
        },
      }));
      setInquiries((prev) => prev.map((item) => (
        item.id === inquiryReply.inquiry.id ? applyReplyMeta(item, nextReplyMeta) : item
      )));
      setInquiryView((prev) => (
        prev && prev.id === inquiryReply.inquiry.id ? applyReplyMeta(prev, nextReplyMeta) : prev
      ));
      toast.success('Reply sent to advertiser');
      setInquiryReply(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send reply');
    } finally {
      setInquiryReplySending(false);
    }
  }, [inquiryReply, inquiryReplySending]);

  const removeInquiriesFromState = React.useCallback((ids: string[]) => {
    const idSet = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
    if (!idSet.size) return;

    setInquiries((prev) => prev.filter((item) => !idSet.has(String(item.id || '').trim())));
    setSelectedInquiryIds((prev) => prev.filter((id) => !idSet.has(String(id || '').trim())));
    setInquiryView((prev) => (prev && idSet.has(String(prev.id || '').trim()) ? null : prev));
    setInquiryReply((prev) => (prev && idSet.has(String(prev.inquiry.id || '').trim()) ? null : prev));
  }, []);

  const clearInquirySelection = React.useCallback(() => {
    setSelectedInquiryIds([]);
  }, []);

  const toggleInquirySelection = React.useCallback((id: string) => {
    const safeId = String(id || '').trim();
    if (!safeId) return;
    setSelectedInquiryIds((prev) => (
      prev.includes(safeId)
        ? prev.filter((value) => value !== safeId)
        : [...prev, safeId]
    ));
  }, []);

  const toggleSelectAllVisible = React.useCallback(() => {
    if (!visibleInquiryIds.length) return;
    setSelectedInquiryIds((prev) => {
      if (visibleInquiryIds.every((id) => prev.includes(id))) {
        return prev.filter((id) => !visibleInquiryIds.includes(id));
      }
      const next = new Set(prev);
      for (const id of visibleInquiryIds) next.add(id);
      return Array.from(next);
    });
  }, [visibleInquiryIds]);

  const adjustInquiryPageAfterBulk = React.useCallback((removedCount: number) => {
    const nextVisibleCount = inquiries.length - removedCount;
    if (inquiryPage > 1 && nextVisibleCount <= 0) {
      setInquiryPage((prev) => Math.max(1, prev - 1));
      return true;
    }
    return false;
  }, [inquiries.length, inquiryPage]);

  const refreshInquiryTabCounts = React.useCallback(async () => {
    try {
      const [newCount, readCount, deletedCount] = await Promise.all([
        getAdInquiryStatusCount('new' as AdInquiryStatus),
        getAdInquiryStatusCount('read' as AdInquiryStatus),
        getAdInquiryStatusCount('deleted' as AdInquiryStatus),
      ]);
      setInquiryTabCounts({ new: newCount, read: readCount, deleted: deletedCount });
    } catch (err: any) {
      if (isAbortError(err)) return;
      if (import.meta.env.DEV) {
        logAdsInquiriesDiagnostic('counts:failed', {
          message: err?.message || 'Failed to load inquiry tab counts',
          status: err?.status,
          code: err?.code,
        });
      }
    }
  }, []);

  type PlacementKey = PlacementSlotOption;
  type PlacementState = Record<PlacementKey, boolean>;

  const emptyPlacementState = React.useCallback((): PlacementState => {
    const next = {} as PlacementState;
    for (const key of PLACEMENT_SLOT_OPTIONS) next[key] = false;
    return next;
  }, []);

  const [slotEnabled, setSlotEnabled] = React.useState<PlacementState>(() => emptyPlacementState());
  const placementFieldShapeRef = React.useRef<Record<PlacementKey, PlacementFieldShape>>(emptyPlacementFieldShape());

  const [settingsLoading, setSettingsLoading] = React.useState(true);
  const [placementSaving, setPlacementSaving] = React.useState<Record<PlacementKey, boolean>>(() => emptyPlacementState());

  const [slotFilter, setSlotFilter] = React.useState<AdSlot | 'ALL'>('ALL');
  const [activeOnly, setActiveOnly] = React.useState(false);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<AdFormState>(emptyForm);
  const [adImageFile, setAdImageFile] = React.useState<File | null>(null);
  const [adImageUploading, setAdImageUploading] = React.useState(false);
  const [adImageUploadProgress, setAdImageUploadProgress] = React.useState<number | null>(null);
  const [hostingExternalImage, setHostingExternalImage] = React.useState(false);
  const [adImagePreviewBroken, setAdImagePreviewBroken] = React.useState(false);

  const [rowBusy, setRowBusy] = React.useState<Record<string, boolean>>({});
  const [brokenImageByAdId, setBrokenImageByAdId] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setAdImagePreviewBroken(false);
  }, [form.imageUrl]);

  const uploadAdImage = React.useCallback(async (file: File) => {
    const fd = new FormData();
    // Expected backend contract: field name "file".
    fd.append('file', file);

    const res = await api.post('/ads/upload-image', fd, {
      onUploadProgress: (evt) => {
        const total = typeof evt.total === 'number' ? evt.total : null;
        const loaded = typeof evt.loaded === 'number' ? evt.loaded : null;
        if (!total || !loaded) {
          setAdImageUploadProgress(null);
          return;
        }
        const pct = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
        setAdImageUploadProgress(pct);
      },
    });
    const payload = res?.data;
    const hostedUrl = String(
      payload?.hostedUrl
      || payload?.hosted_url
      || payload?.data?.hostedUrl
      || payload?.data?.hosted_url
      || payload?.url
      || payload?.data?.url
      || ''
    ).trim();

    if (!hostedUrl) throw new Error('Upload succeeded but no hostedUrl was returned');

    // Prefer absolute https URLs; tolerate root-relative URLs from some backends.
    if (/^https?:\/\//i.test(hostedUrl)) return hostedUrl;
    if (hostedUrl.startsWith('/')) {
      try {
        if (typeof window !== 'undefined' && window.location?.origin) {
          return `${window.location.origin}${hostedUrl}`;
        }
      } catch {}
    }

    return hostedUrl;
  }, []);

  const handleUploadSelectedImage = React.useCallback(async (file?: File | null) => {
    const f = file || adImageFile;
    if (!f) {
      toast.error('Please choose an image file to upload');
      return;
    }

    setAdImageUploading(true);
    setAdImageUploadProgress(null);
    try {
      const url = await uploadAdImage(f);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success('Image uploaded');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message
        || err?.response?.data?.error
        || err?.response?.data?.data?.message
        || err?.message
        || 'Upload failed';
      toast.error(String(msg));
    } finally {
      setAdImageUploading(false);
      setAdImageUploadProgress(null);
    }
  }, [adImageFile, uploadAdImage]);

  const isExternalImageUrl = React.useCallback((url: string) => {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return false;
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return !u.startsWith(window.location.origin);
      }
    } catch {}
    return true;
  }, []);

  const hostExternalImageNow = React.useCallback(async () => {
    if (!editingId) return;
    const imageUrl = String(form.imageUrl || '').trim();
    if (!isExternalImageUrl(imageUrl)) return;
    if (!form.slot) {
      toast.error('Slot is required');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!imageUrl) {
      toast.error('Image URL is required');
      return;
    }
    if (form.clickable && !form.targetUrl.trim()) {
      toast.error('Target URL is required when Clickable Ad is enabled');
      return;
    }
    const priorityNum = Number(form.priority);
    if (!Number.isFinite(priorityNum)) {
      toast.error('Priority must be a number');
      return;
    }

    const startAtIso = fromDatetimeLocalValue(form.startAt);
    const endAtIso = fromDatetimeLocalValue(form.endAt);
    if (form.startAt.trim() && !startAtIso) {
      toast.error('Start At must be a valid date/time');
      return;
    }
    if (form.endAt.trim() && !endAtIso) {
      toast.error('End At must be a valid date/time');
      return;
    }
    if (startAtIso && endAtIso && new Date(startAtIso).getTime() > new Date(endAtIso).getTime()) {
      toast.error('Start At must be before End At');
      return;
    }

    setHostingExternalImage(true);
    try {
      const payload: any = {
        slot: canonicalSlot(form.slot),
        title: form.title.trim(),
        imageUrl,
        clickable: Boolean(form.clickable),
        isClickable: Boolean(form.clickable),
        targetUrl: form.clickable ? form.targetUrl.trim() : null,
        priority: priorityNum,
        startAt: startAtIso,
        endAt: endAtIso,
        isActive: Boolean(form.isActive),
      };
      payload.active = payload.isActive;

      const res = await adminApi.put(`/admin/ads/${editingId}`, payload);
      const updated = normalizeAd(res?.data?.ad ?? res?.data);
      if (updated?.imageUrl) {
        setForm((prev) => ({ ...prev, imageUrl: updated.imageUrl }));
      }
      toast.success('Image hosted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to host image');
    } finally {
      setHostingExternalImage(false);
    }
  }, [adminApi, editingId, form, isExternalImageUrl]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setAdImageFile(null);
    setAdImageUploading(false);
    setAdImageUploadProgress(null);
    setHostingExternalImage(false);
    setAdImagePreviewBroken(false);
    setModalOpen(true);
  };

  const openEdit = (ad: SponsorAd) => {
    setEditingId(ad.id);
    const clickable = typeof ad.clickable === 'boolean' ? ad.clickable : Boolean((ad.targetUrl || '').toString().trim());
    setForm({
      slot: (canonicalSlot(ad.slot) as AdSlot) || '',
      title: String(ad.title ?? ''),
      imageUrl: ad.imageUrl || '',
      targetUrl: String(ad.targetUrl ?? ''),
      clickable,
      priority: String(ad.priority ?? 0),
      startAt: toDatetimeLocalValue(ad.startAt),
      endAt: toDatetimeLocalValue(ad.endAt),
      isActive: Boolean(ad.isActive),
    });
    setAdImageFile(null);
    setAdImageUploading(false);
    setAdImageUploadProgress(null);
    setHostingExternalImage(false);
    setAdImagePreviewBroken(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setAdImageFile(null);
    setAdImageUploading(false);
    setAdImageUploadProgress(null);
    setHostingExternalImage(false);
    setAdImagePreviewBroken(false);
  };

  const fetchAds = React.useCallback(async (opts?: {
    slot?: AdSlot | 'ALL';
    activeOnly?: boolean;
  }) => {
    setLoading(true);
    try {
      const params: any = {};
      const nextSlot = opts?.slot ?? slotFilter;
      const nextActiveOnly = typeof opts?.activeOnly === 'boolean' ? opts.activeOnly : activeOnly;

      if (nextSlot !== 'ALL') params.slot = nextSlot;
      if (nextActiveOnly) params.active = 'true';

      // Backend contract: GET /api/admin/ads
      // Use adminApi so proxy/direct mode is handled and auth headers are attached.
      const res = await adminApi.get('/admin/ads', { params });
      const payload = res?.data;

      const list = extractAdsList(payload);

      const normalized: SponsorAd[] = (list as any[])
        .map(normalizeAd)
        .filter((a: SponsorAd) => Boolean(a.id));
      setAds(normalized);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  }, [slotFilter, activeOnly]);

  const fetchInquiries = React.useCallback(async (opts: {
    status: InquiryStatusTab;
    page: number;
    limit: number;
    search: string;
    signal?: AbortSignal;
  }) => {
    setInquiriesLoading(true);
    try {
      const list = await listAdInquiries({
        status: opts.status,
        page: opts.page,
        limit: opts.limit,
        search: opts.search,
        signal: opts.signal,
      });
      const result = list as AdInquiryListResult;
      setInquiries(result.items.map((item) => applyReplyMeta(item, inquiryReplyOverridesRef.current[item.id])));
      setInquiriesTotal(typeof result.total === 'number' ? result.total : result.items.length);
      setInquiryTabCounts((prev) => ({
        ...prev,
        [opts.status]: typeof result.total === 'number' ? result.total : result.items.length,
      }));
      setInquiriesError(null);
      if (import.meta.env.DEV) {
        logAdsInquiriesDiagnostic('list:render-ready', {
          url: `${ADS_INQUIRIES_BASE}?status=${opts.status}&page=${opts.page}&limit=${opts.limit}&search=${encodeURIComponent(opts.search)}`,
          message: `Rendering ${result.items.length} rows (tab total: ${typeof result.total === 'number' ? result.total : result.items.length})`,
          source: result.source,
          raw: result.raw,
        });
      }
    } catch (err: any) {
      if (isAbortError(err)) return;

      const nextError = describeInquiryError(err, 'Failed to load inquiries');
      setInquiries([]);
      setInquiriesTotal(null);
      setInquiriesUnreadCount(null);
      setInquiriesUnreadError(nextError);
      setInquiriesError(nextError);
      lastUnreadRef.current = null;
      logAdsInquiriesDiagnostic('list:failed', {
        url: nextError.url || `${ADS_INQUIRIES_BASE}?status=${opts.status}&page=${opts.page}&limit=${opts.limit}&search=${encodeURIComponent(opts.search)}`,
        status: nextError.status,
        message: nextError.message,
        code: nextError.code,
      });
      toast.error(nextError.message);
    } finally {
      setInquiriesLoading(false);
    }
  }, []);

  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const next = await getAdInquiriesUnreadCount();
      setInquiriesUnreadCount(next);
      setInquiryTabCounts((prev) => ({ ...prev, new: next }));
      setInquiriesUnreadError(null);

      const prev = lastUnreadRef.current;
      if (typeof prev === 'number' && next > prev) {
        toast('New Ad Inquiry received');
      }
      lastUnreadRef.current = next;
    } catch (err: any) {
      if (isAbortError(err)) return;

      const nextError = describeInquiryError(err, 'Unread count unavailable');
      // Polling should not spam errors, but the UI should not lie.
      setInquiriesUnreadCount(null);
      setInquiryTabCounts((prev) => ({ ...prev, new: null }));
      setInquiriesUnreadError(nextError);
      lastUnreadRef.current = null;
      logAdsInquiriesDiagnostic('unread-count:failed', {
        url: nextError.url || `${ADS_INQUIRIES_BASE}/unread-count`,
        status: nextError.status,
        message: nextError.message,
        code: nextError.code,
      });
    }
  }, []);

  const refreshInquiryDataAfterBulk = React.useCallback(async (removedCount: number) => {
    const movedToPreviousPage = adjustInquiryPageAfterBulk(removedCount);
    if (!movedToPreviousPage) {
      await fetchInquiries({
        status: inquiryStatusTab,
        page: inquiryPage,
        limit: inquiryLimit,
        search: inquirySearch,
      });
    }
    await Promise.all([fetchUnreadCount(), refreshInquiryTabCounts()]);
  }, [adjustInquiryPageAfterBulk, fetchInquiries, fetchUnreadCount, inquiryLimit, inquiryPage, inquirySearch, inquiryStatusTab, refreshInquiryTabCounts]);

  const applyBulkInquiryAction = React.useCallback(async (action: 'mark-read' | 'move-to-trash' | 'restore' | 'delete-permanently', ids: string[]) => {
    const safeIds = ids.map((id) => String(id || '').trim()).filter(Boolean);
    if (!safeIds.length) return;

    setBulkAction(action);
    try {
      if (action === 'delete-permanently') {
        await permanentlyDeleteAdInquiries(safeIds);
        removeInquiriesFromState(safeIds);
      }
      if (action === 'restore') {
        await restoreAdInquiries(safeIds);
      }
      if (action === 'move-to-trash') {
        await moveAdInquiriesToTrash(safeIds);
      }
      if (action === 'mark-read') {
        await markAdInquiriesRead(safeIds);
      }

      clearInquirySelection();
      await refreshInquiryDataAfterBulk(safeIds.length);

      const countLabel = `${safeIds.length} ${safeIds.length === 1 ? 'inquiry' : 'inquiries'}`;
      if (action === 'restore') toast.success(`${countLabel} restored`);
      if (action === 'delete-permanently') toast.success(`${countLabel} deleted permanently`);
      if (action === 'move-to-trash') toast.success(`${countLabel} moved to trash`);
      if (action === 'mark-read') toast.success(`${countLabel} marked as read`);
    } catch (err: any) {
      const fallback = action === 'restore'
        ? 'Failed to restore selected inquiries'
        : action === 'delete-permanently'
          ? 'Failed to permanently delete selected inquiries'
          : action === 'move-to-trash'
            ? 'Failed to move selected inquiries to trash'
            : 'Failed to mark selected inquiries as read';
      toast.error(err?.message || fallback);
    } finally {
      setBulkAction(null);
    }
  }, [clearInquirySelection, refreshInquiryDataAfterBulk, removeInquiriesFromState]);

  const normalizePlacementState = React.useCallback((raw: any, fallback?: PlacementState): PlacementState => {
    const source = raw?.slotEnabled
      || raw?.data?.slotEnabled
      || raw?.settings?.slotEnabled
      || (raw && typeof raw === 'object' ? raw : null);

    if (!source || typeof source !== 'object') {
      return fallback ? { ...fallback } : emptyPlacementState();
    }

    const next = fallback ? { ...fallback } : emptyPlacementState();
    const detectedShapes = { ...placementFieldShapeRef.current };

    for (const key of PLACEMENT_SLOT_OPTIONS) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

      const value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (Object.prototype.hasOwnProperty.call(value, 'enabled')) {
          detectedShapes[key] = 'enabled';
        } else if (Object.prototype.hasOwnProperty.call(value, 'isEnabled')) {
          detectedShapes[key] = 'isEnabled';
        } else {
          detectedShapes[key] = 'boolean';
        }
      } else {
        detectedShapes[key] = 'boolean';
      }

      next[key] = parsePlacementEnabled(value);
    }

    placementFieldShapeRef.current = detectedShapes;
    return next;
  }, [emptyPlacementState]);

  const buildPlacementPayload = React.useCallback((next: PlacementState) => {
    const slotEnabledPayload = {} as Record<PlacementKey, boolean | { enabled: boolean } | { isEnabled: boolean }>;

    for (const key of PLACEMENT_SLOT_OPTIONS) {
      const enabled = Boolean(next[key]);
      const shape = placementFieldShapeRef.current[key];

      if (shape === 'enabled') {
        slotEnabledPayload[key] = { enabled };
      } else if (shape === 'isEnabled') {
        slotEnabledPayload[key] = { isEnabled: enabled };
      } else {
        slotEnabledPayload[key] = enabled;
      }
    }

    return { slotEnabled: slotEnabledPayload };
  }, []);

  const fetchAdSettings = React.useCallback(async (): Promise<PlacementState> => {
    const res = await adminApi.get('/admin/ad-settings');
    return normalizePlacementState(res?.data);
  }, [normalizePlacementState]);

  const updateAdSettings = React.useCallback(async (next: PlacementState): Promise<PlacementState> => {
    const res = await adminApi.put('/admin/ad-settings', buildPlacementPayload(next));
    return normalizePlacementState(res?.data, next);
  }, [buildPlacementPayload, normalizePlacementState]);

  const loadSettings = React.useCallback(async () => {
    // IMPORTANT: do not overwrite local state while a save is in progress.
    if (PLACEMENT_SLOT_OPTIONS.some((key) => placementSaving[key])) return;
    setSettingsLoading(true);
    try {
      setSlotEnabled(await fetchAdSettings());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load ad placements');
    } finally {
      setSettingsLoading(false);
    }
  }, [fetchAdSettings, placementSaving]);

  React.useEffect(() => {
    void fetchAds();
  }, [fetchAds]);

  React.useEffect(() => {
    void fetchUnreadCount();
    const id = window.setInterval(() => {
      void fetchUnreadCount();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [fetchUnreadCount]);

  React.useEffect(() => {
    if (tab !== 'inquiries') return;
    // Reset when switching into inquiries.
    setInquiryStatusTab('new');
    setInquiryPage(1);
    setInquirySearchInput('');
    setInquirySearch('');
    clearInquirySelection();
  }, [tab]);

  // Debounce search input -> server query.
  React.useEffect(() => {
    if (tab !== 'inquiries') return;
    const id = window.setTimeout(() => {
      setInquirySearch(inquirySearchInput.trim());
      setInquiryPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [tab, inquirySearchInput]);

  React.useEffect(() => {
    if (tab !== 'inquiries') return;
    const ac = new AbortController();
    void fetchInquiries({
      status: inquiryStatusTab,
      page: inquiryPage,
      limit: inquiryLimit,
      search: inquirySearch,
      signal: ac.signal,
    });
    return () => ac.abort();
  }, [tab, fetchInquiries, inquiryStatusTab, inquiryPage, inquiryLimit, inquirySearch]);

  React.useEffect(() => {
    setSelectedInquiryIds((prev) => prev.filter((id) => visibleInquiryIds.includes(id)));
  }, [visibleInquiryIds]);

  React.useEffect(() => {
    if (!selectAllVisibleRef.current) return;
    selectAllVisibleRef.current.indeterminate = hasSomeVisibleSelected;
  }, [hasSomeVisibleSelected]);

  React.useEffect(() => {
    if (tab !== 'inquiries') return;
    void refreshInquiryTabCounts();
  }, [tab, refreshInquiryTabCounts]);

  // IMPORTANT: load settings only once on mount.
  // Do NOT include slotEnabled in deps (would overwrite user toggles).
  React.useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlacement = async (key: PlacementKey) => {
    const prev = slotEnabled;
    const next: PlacementState = { ...slotEnabled, [key]: !slotEnabled[key] };

    // Optimistic UI
    setSlotEnabled(next);
    setPlacementSaving((s) => ({ ...s, [key]: true }));

    try {
      const saved = await updateAdSettings(next);
      setSlotEnabled(saved);
      toast.success('Saved');
    } catch (err: any) {
      setSlotEnabled(prev);
      toast.error(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setPlacementSaving((s) => ({ ...s, [key]: false }));
    }
  };

  const filteredAds = React.useMemo(() => {
    let list = ads;
    if (slotFilter !== 'ALL') list = list.filter(a => a.slot === slotFilter);
    if (activeOnly) list = list.filter(a => a.isActive);
    // Higher priority first; fallback stable by updatedAt
    return [...list].sort((a, b) => {
      const ap = Number(a.priority ?? 0);
      const bp = Number(b.priority ?? 0);
      if (bp !== ap) return bp - ap;
      const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bd - ad;
    });
  }, [ads, slotFilter, activeOnly]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.slot) {
      toast.error('Slot is required');
      return;
    }

    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.imageUrl.trim()) {
      toast.error('Image URL is required');
      return;
    }
    if (form.clickable && !form.targetUrl.trim()) {
      toast.error('Target URL is required when Clickable Ad is enabled');
      return;
    }

    const priorityNum = Number(form.priority);
    if (!Number.isFinite(priorityNum)) {
      toast.error('Priority must be a number');
      return;
    }

    const startAtIso = fromDatetimeLocalValue(form.startAt);
    const endAtIso = fromDatetimeLocalValue(form.endAt);

    if (form.startAt.trim() && !startAtIso) {
      toast.error('Start At must be a valid date/time');
      return;
    }
    if (form.endAt.trim() && !endAtIso) {
      toast.error('End At must be a valid date/time');
      return;
    }
    if (startAtIso && endAtIso && new Date(startAtIso).getTime() > new Date(endAtIso).getTime()) {
      toast.error('Start At must be before End At');
      return;
    }

    if (startAtIso && endAtIso && startAtIso === endAtIso) {
      const ok = window.confirm(
        'Warning: Start time and end time are the same. This creates a zero-length schedule window.\n\nSave anyway?'
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const payload: any = {
        slot: canonicalSlot(form.slot),
        title: form.title.trim(),
        imageUrl: form.imageUrl.trim(),
        clickable: Boolean(form.clickable),
        isClickable: Boolean(form.clickable),
        targetUrl: form.clickable ? form.targetUrl.trim() : null,
        priority: priorityNum,
        startAt: startAtIso,
        endAt: endAtIso,
        isActive: Boolean(form.isActive),
      };

      // Back-compat: some backends use `active` instead of `isActive`.
      payload.active = payload.isActive;

      const normalizeAndUpsert = (raw: any) => {
        const next = normalizeAd(raw);
        if (!next.id) return;
        setAds((prev) => {
          const without = prev.filter((a) => a.id !== next.id);
          return [next, ...without];
        });

        // Ensure UI filters don't hide the newly created ad.
        if (slotFilter !== 'ALL' && slotFilter !== (next.slot as any)) {
          setSlotFilter(next.slot as any);
        }
        if (activeOnly && !next.isActive) {
          setActiveOnly(false);
        }
      };

      if (editingId) {
        // PUT /api/admin/ads/:id
        const res = await adminApi.put(`/admin/ads/${editingId}`, payload);
        normalizeAndUpsert(res?.data?.ad ?? res?.data);
        toast.success('Ad updated');
      } else {
        // POST /api/admin/ads
        const res = await adminApi.post('/admin/ads', payload);
        normalizeAndUpsert(res?.data?.ad ?? res?.data);
        toast.success('Ad created');
      }

      setModalOpen(false);

      const desiredSlot = (slotFilter !== 'ALL' && slotFilter !== (payload.slot as any))
        ? (payload.slot as any)
        : slotFilter;
      const desiredActiveOnly = activeOnly && Boolean(payload.isActive);
      await fetchAds({ slot: desiredSlot as any, activeOnly: desiredActiveOnly });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (ad: SponsorAd) => {
    const prevActive = Boolean(ad.isActive);
    const nextActive = !prevActive;

    // Optimistic flip
    setRowBusy(prev => ({ ...prev, [ad.id]: true }));
    setAds(prev => prev.map(a => (a.id === ad.id ? { ...a, isActive: nextActive } : a)));

    try {
      // PATCH /api/admin/ads/:id/toggle
      // Body supports either empty (server flips) OR explicit desired state.
      const res = await adminApi.patch(`/admin/ads/${ad.id}/toggle`, { isActive: nextActive });
      const updated = res?.data?.ad ?? res?.data;

      if (updated && (updated.id || updated._id)) {
        const next = normalizeAd(updated);
        setAds(prev => prev.map(a => (a.id === ad.id ? { ...a, ...next } : a)));
      }

      toast.success('Updated');
    } catch (err: any) {
      // Revert UI
      setAds(prev => prev.map(a => (a.id === ad.id ? { ...a, isActive: prevActive } : a)));
      toast.error(err?.response?.data?.message || err?.message || 'Toggle failed');
    } finally {
      setRowBusy(prev => ({ ...prev, [ad.id]: false }));
    }
  };

  const removeAd = async (ad: SponsorAd) => {
    if (!confirm(`Delete ad "${ad.title || ad.slot}"?`)) return;

    setRowBusy(prev => ({ ...prev, [ad.id]: true }));
    try {
      // DELETE /api/admin/ads/:id
      await adminApi.delete(`/admin/ads/${ad.id}`);
      setAds(prev => prev.filter(a => a.id !== ad.id));
      toast.success('Ad deleted');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Delete failed');
    } finally {
      setRowBusy(prev => ({ ...prev, [ad.id]: false }));
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ads Manager</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {tab === 'ads' ? (
            <>
              <button
                onClick={() => void fetchAds()}
                className="px-3 py-1 bg-slate-700 text-white rounded"
                disabled={loading}
              >
                Refresh
              </button>
              <button
                onClick={openCreate}
                className="px-3 py-1 bg-green-600 text-white rounded"
              >
                Create Ad
              </button>
            </>
          ) : null}

          {tab === 'media-kit' ? (
            <>
              <button
                type="button"
                onClick={() => void fetchMediaKit()}
                className="px-3 py-1 bg-slate-700 text-white rounded disabled:opacity-60"
                disabled={mediaKitLoading || mediaKitSaving || mediaKitResetting}
              >
                {mediaKitLoading ? 'Loading…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => void copyMediaKitAsText()}
                className="px-3 py-1 bg-slate-700 text-white rounded"
              >
                Copy as Text
              </button>
              <button
                type="button"
                onClick={() => setMediaKitPreview((p) => !p)}
                className="px-3 py-1 bg-slate-700 text-white rounded"
              >
                {mediaKitPreview ? 'Exit Preview' : 'Preview'}
              </button>
              {isFounder ? (
                mediaKitEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void saveMediaKit()}
                      className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-60"
                      disabled={mediaKitSaving || mediaKitResetting}
                    >
                      {mediaKitSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelMediaKitEditor}
                      className="px-3 py-1 bg-white text-slate-900 rounded border disabled:opacity-60"
                      disabled={mediaKitSaving || mediaKitResetting}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={openMediaKitEditor}
                    className="px-3 py-1 bg-green-600 text-white rounded"
                  >
                    Edit
                  </button>
                )
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('ads')}
          className={
            'px-3 py-1.5 rounded border text-sm font-semibold ' +
            (tab === 'ads' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
          }
        >
          Ads
        </button>
        <button
          type="button"
          onClick={() => setTab('inquiries')}
          className={
            'px-3 py-1.5 rounded border text-sm font-semibold ' +
            (tab === 'inquiries' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
          }
        >
          Ad Inquiries
        </button>
        <button
          type="button"
          onClick={() => setTab('media-kit')}
          className={
            'px-3 py-1.5 rounded border text-sm font-semibold ' +
            (tab === 'media-kit' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
          }
        >
          Media Kit
        </button>
      </div>

      {tab === 'inquiries' ? (
        <div className="space-y-4">
          <div className="border rounded p-4 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Ad Inquiries</h2>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {activeSubtitle}
                </div>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {activeCornerTitle}:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {activeCornerCountLabel}
                </span>
                {inquiriesUnreadError ? (
                  <span className="ml-2 text-xs text-slate-500" title={inquiriesUnreadError.message}>API error</span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { clearInquirySelection(); setInquiryStatusTab('new'); setInquiryPage(1); }}
                  className={
                    'px-3 py-1.5 rounded border text-sm font-semibold ' +
                    (inquiryStatusTab === 'new' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
                  }
                  disabled={bulkBusy}
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => { clearInquirySelection(); setInquiryStatusTab('read'); setInquiryPage(1); }}
                  className={
                    'px-3 py-1.5 rounded border text-sm font-semibold ' +
                    (inquiryStatusTab === 'read' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
                  }
                  disabled={bulkBusy}
                >
                  Read
                </button>
                <button
                  type="button"
                  onClick={() => { clearInquirySelection(); setInquiryStatusTab('deleted'); setInquiryPage(1); }}
                  className={
                    'px-3 py-1.5 rounded border text-sm font-semibold ' +
                    (inquiryStatusTab === 'deleted' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-slate-200')
                  }
                  disabled={bulkBusy}
                >
                  Deleted
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={inquirySearchInput}
                  onChange={(e) => setInquirySearchInput(e.target.value)}
                  placeholder="Search…"
                  className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-slate-950"
                  disabled={bulkBusy}
                />
                {inquirySearchInput ? (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border text-sm"
                    onClick={() => { clearInquirySelection(); setInquirySearchInput(''); }}
                    disabled={bulkBusy}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {selectedCount > 0 ? (
            <div className="border rounded p-3 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {selectedCount} selected
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {inquiryStatusTab === 'new' ? (
                  <>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm"
                      disabled={bulkBusy}
                      onClick={() => void applyBulkInquiryAction('mark-read', selectedVisibleInquiryIds)}
                    >
                      {bulkAction === 'mark-read' ? 'Working…' : 'Mark Selected Read'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm text-red-700 border-red-300 hover:bg-red-50"
                      disabled={bulkBusy}
                      onClick={() => void applyBulkInquiryAction('move-to-trash', selectedVisibleInquiryIds)}
                    >
                      {bulkAction === 'move-to-trash' ? 'Working…' : 'Move Selected to Trash'}
                    </button>
                  </>
                ) : null}

                {inquiryStatusTab === 'read' ? (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border text-sm text-red-700 border-red-300 hover:bg-red-50"
                    disabled={bulkBusy}
                    onClick={() => void applyBulkInquiryAction('move-to-trash', selectedVisibleInquiryIds)}
                  >
                    {bulkAction === 'move-to-trash' ? 'Working…' : 'Move Selected to Trash'}
                  </button>
                ) : null}

                {inquiryStatusTab === 'deleted' ? (
                  <>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm"
                      disabled={bulkBusy}
                      onClick={() => void applyBulkInquiryAction('restore', selectedVisibleInquiryIds)}
                    >
                      {bulkAction === 'restore' ? 'Working…' : 'Restore Selected'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm text-red-700 border-red-300 hover:bg-red-50"
                      disabled={bulkBusy}
                      onClick={() => setConfirmBulkPermanentDelete(true)}
                    >
                      Delete Selected Permanently
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {inquiriesError ? (
            <div className="border rounded p-3 bg-rose-50 text-rose-900 border-rose-200">
              <div className="text-sm font-semibold">
                {inquiriesError.kind === 'offline'
                  ? 'Backend unreachable'
                  : (inquiriesError.kind === 'db-unavailable' ? 'Database unavailable' : 'Failed to load inquiries')}
              </div>
              <div className="text-xs mt-1">
                {inquiriesError.status ? `HTTP ${inquiriesError.status}: ` : ''}{inquiriesError.message}
                {inquiriesError.url ? ` • ${inquiriesError.url}` : ''}
              </div>
            </div>
          ) : null}

          <div className="overflow-auto border rounded">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="text-left p-2 w-10">
                    <input
                      ref={selectAllVisibleRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={bulkBusy || visibleInquiryIds.length === 0}
                      onChange={() => toggleSelectAllVisible()}
                      aria-label="Select all visible inquiries"
                    />
                  </th>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Message</th>
                  <th className="text-left p-2">Created</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiriesLoading ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={7}>Loading…</td>
                  </tr>
                ) : inquiriesError ? (
                  <tr>
                    <td className="p-3 text-rose-700" colSpan={7}>
                      {inquiriesError.kind === 'offline'
                        ? 'Backend unreachable. '
                        : (inquiriesError.kind === 'db-unavailable' ? 'Database unavailable. ' : '')}
                      {inquiriesError.status ? `HTTP ${inquiriesError.status}: ` : ''}{inquiriesError.message}
                    </td>
                  </tr>
                ) : inquiries.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={7}>
                      {emptyInquiriesText}
                    </td>
                  </tr>
                ) : (
                  inquiries.map((inq) => {
                    const busy = !!inquiryBusy[inq.id];
                    const statusLower = String(inq.status || '').toLowerCase();
                    const isDeleted = statusLower === 'deleted';
                    const isRead = statusLower === 'read';
                    const canRestore = isDeleted || inquiryStatusTab === 'deleted';
                    const isReplied = Boolean(inq.hasReply);
                    return (
                      <tr key={inq.id} className="border-t">
                        <td className="p-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedInquiryIds.includes(inq.id)}
                            disabled={bulkBusy}
                            onChange={() => toggleInquirySelection(inq.id)}
                            aria-label={`Select inquiry ${inq.name || inq.id}`}
                          />
                        </td>
                        <td className="p-2">{inq.name || '-'}</td>
                        <td className="p-2">
                          {inq.email ? (
                            canEmailFromCurrentTab ? (
                              <a
                                className="text-blue-600 hover:underline"
                                href={mailtoHref(inq.email)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {inq.email}
                              </a>
                            ) : (
                              <span>{inq.email}</span>
                            )
                          ) : '-'}
                        </td>
                        <td className="p-2" title={inq.message || ''}>{messagePreview(inq.message || '') || '-'}</td>
                        <td className="p-2 text-xs text-slate-600 dark:text-slate-300">{safeDateLabel(inq.createdAt)}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {!isDeleted ? <span>{inq.status || 'new'}</span> : null}
                            {isDeleted ? (
                              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                                Deleted
                              </span>
                            ) : null}
                            {isReplied ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Replied
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 rounded border text-xs"
                                disabled={busy || bulkBusy}
                                onClick={() => setInquiryView(inq)}
                              >
                                View
                              </button>

                              {inquiryStatusTab === 'new' ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs"
                                  disabled={busy || bulkBusy || isRead || isDeleted}
                                  onClick={async () => {
                                    setInquiryBusy((m) => ({ ...m, [inq.id]: true }));
                                    try {
                                      await markAdInquiryRead(inq.id);
                                      setSelectedInquiryIds((prev) => prev.filter((id) => id !== inq.id));
                                      await refreshInquiryDataAfterBulk(1);
                                    } catch (err: any) {
                                      toast.error(err?.message || 'Failed to mark read');
                                    } finally {
                                      setInquiryBusy((m) => ({ ...m, [inq.id]: false }));
                                    }
                                  }}
                                >
                                  {busy ? 'Working…' : 'Mark Read'}
                                </button>
                              ) : null}

                              {inquiryStatusTab !== 'deleted' ? (
                                inq.email ? (
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded border text-xs"
                                    disabled={busy || bulkBusy}
                                    onClick={() => openInquiryReplyComposer(inq)}
                                  >
                                    Reply
                                  </button>
                                ) : (
                                  <button type="button" className="px-2 py-1 rounded border text-xs" disabled>
                                    Reply
                                  </button>
                                )
                              ) : null}

                              {canRestore ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs"
                                  disabled={busy || bulkBusy || !canRestore}
                                  onClick={async () => {
                                    setInquiryBusy((m) => ({ ...m, [inq.id]: true }));
                                    try {
                                      await restoreAdInquiry(inq.id);
                                      setSelectedInquiryIds((prev) => prev.filter((id) => id !== inq.id));
                                      await refreshInquiryDataAfterBulk(1);
                                    } catch (err: any) {
                                      toast.error(err?.message || 'Failed to restore inquiry');
                                    } finally {
                                      setInquiryBusy((m) => ({ ...m, [inq.id]: false }));
                                    }
                                  }}
                                >
                                  {busy ? 'Working…' : 'Restore'}
                                </button>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                              {inquiryStatusTab !== 'deleted' ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs text-red-700 border-red-300 hover:bg-red-50"
                                  disabled={busy || bulkBusy || isDeleted}
                                  onClick={async () => {
                                    setInquiryBusy((m) => ({ ...m, [inq.id]: true }));
                                    try {
                                      await moveAdInquiryToTrash(inq.id);
                                      setSelectedInquiryIds((prev) => prev.filter((id) => id !== inq.id));
                                      await refreshInquiryDataAfterBulk(1);
                                    } catch (err: any) {
                                      toast.error(err?.message || 'Failed to move inquiry to trash');
                                    } finally {
                                      setInquiryBusy((m) => ({ ...m, [inq.id]: false }));
                                    }
                                  }}
                                >
                                  {busy ? 'Working…' : 'Move to Trash'}
                                </button>
                              ) : null}

                              {inquiryStatusTab === 'deleted' ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs text-red-700 border-red-300 hover:bg-red-50"
                                  disabled={busy || bulkBusy}
                                  onClick={async () => {
                                    const ok = window.confirm('Permanently delete this inquiry? This cannot be undone.');
                                    if (!ok) return;
                                    setInquiryBusy((m) => ({ ...m, [inq.id]: true }));
                                    try {
                                      await permanentlyDeleteAdInquiry(inq.id);
                                      removeInquiriesFromState([inq.id]);
                                      await refreshInquiryDataAfterBulk(1);
                                      toast.success('Inquiry deleted permanently');
                                    } catch (err: any) {
                                      toast.error(err?.message || 'Failed to permanently delete inquiry');
                                    } finally {
                                      setInquiryBusy((m) => ({ ...m, [inq.id]: false }));
                                    }
                                  }}
                                >
                                  {busy ? 'Working…' : 'Delete Permanently'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="text-slate-600 dark:text-slate-300">
              Page <span className="font-semibold text-slate-900 dark:text-white">{inquiryPage}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded border"
                disabled={inquiriesLoading || !hasPrevInquiryPage}
                onClick={() => setInquiryPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded border"
                disabled={inquiriesLoading || !hasNextInquiryPage}
                onClick={() => setInquiryPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'inquiries' && confirmBulkPermanentDelete ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded border shadow">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Delete selected inquiries permanently?</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                This will remove the selected inquiries forever and cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border"
                  disabled={bulkBusy}
                  onClick={() => setConfirmBulkPermanentDelete(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border bg-red-600 text-white border-red-600 disabled:opacity-60"
                  disabled={bulkBusy}
                  onClick={async () => {
                    setConfirmBulkPermanentDelete(false);
                    await applyBulkInquiryAction('delete-permanently', selectedVisibleInquiryIds);
                  }}
                >
                  {bulkAction === 'delete-permanently' ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Inquiry View Modal */}
      {tab === 'inquiries' && inquiryView ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded border shadow">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Ad Inquiry</h3>
              <button
                type="button"
                onClick={closeInquiryView}
                className="px-2 py-1 rounded border"
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Name</div>
                  <div className="font-medium">{inquiryView.name || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Email</div>
                  <div className="font-medium">{inquiryView.email || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Created</div>
                  <div className="font-medium">{safeDateLabel(inquiryView.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Status</div>
                  <div className="font-medium">{inquiryView.status || 'new'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Message</div>
                <div className="mt-1 whitespace-pre-wrap text-sm border rounded p-3 bg-slate-50 dark:bg-slate-950">
                  {inquiryView.message || '-'}
                </div>
              </div>

              {inquiryView.hasReply ? (
                <div className="border rounded p-3 bg-slate-50 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Replied
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Last replied at</div>
                      <div className="font-medium">{inquiryView.lastRepliedAt ? safeDateLabel(inquiryView.lastRepliedAt) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Last replied by</div>
                      <div className="font-medium">{inquiryView.lastRepliedBy || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Reply count</div>
                      <div className="font-medium">{typeof inquiryView.replyCount === 'number' ? inquiryView.replyCount : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Last reply subject</div>
                      <div className="font-medium">{inquiryView.lastReplySubject || '-'}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                <div className="text-xs text-slate-500">
                  Reply here to send a response from inside the admin panel.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEmailFromCurrentTab && inquiryView.email ? (
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border bg-slate-900 text-white border-slate-900 disabled:opacity-60"
                      onClick={() => openInquiryReplyComposer(inquiryView)}
                    >
                      Reply
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'inquiries' && inquiryReply ? (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded border shadow">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Reply to Advertiser</h3>
                <div className="text-xs text-slate-500">Compose and send your reply from inside the admin panel.</div>
              </div>
              <button
                type="button"
                onClick={closeInquiryReplyComposer}
                disabled={inquiryReplySending}
                className="px-2 py-1 rounded border disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <form className="p-4 space-y-4" onSubmit={sendInquiryReply}>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input
                  type="text"
                  readOnly
                  value={inquiryReply.inquiry.email || ''}
                  className="w-full border rounded px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Subject</label>
                <input
                  type="text"
                  value={inquiryReply.subject}
                  onChange={(e) => setInquiryReply((prev) => (prev ? { ...prev, subject: e.target.value } : prev))}
                  disabled={inquiryReplySending}
                  className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Message</label>
                <textarea
                  rows={8}
                  value={inquiryReply.message}
                  onChange={(e) => setInquiryReply((prev) => (prev ? { ...prev, message: e.target.value } : prev))}
                  disabled={inquiryReplySending}
                  autoFocus
                  placeholder="Write your reply to the advertiser"
                  className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border"
                  disabled={inquiryReplySending}
                  onClick={closeInquiryReplyComposer}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded border bg-slate-900 text-white border-slate-900 disabled:opacity-60"
                  disabled={inquiryReplySending}
                >
                  {inquiryReplySending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tab === 'media-kit' ? (
        <div className="space-y-4">
          <div className="border rounded p-4 bg-white dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{mediaKit.title}</h2>
                {mediaKit.tagline ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">{mediaKit.tagline}</div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    'px-2 py-1 rounded text-xs border ' +
                    (mediaKitSource === 'saved'
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200')
                  }
                  title={mediaKitSource === 'saved' ? 'Loaded from backend' : 'Using local default fallback'}
                >
                  Source: {mediaKitSource === 'saved' ? 'Saved' : 'Default'}
                </span>
                {mediaKitError ? (
                  <span className="px-2 py-1 rounded text-xs border bg-amber-50 text-amber-800 border-amber-200" title={mediaKitError}>
                    API fallback
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {mediaKitEditing ? (
            <div className="border rounded p-4 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">Editor (JSON)</div>
                  <div className="text-xs text-slate-500">Save writes to backend. View mode always falls back to default.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={recalculateMediaKitEditorRates}
                    className="px-3 py-1.5 rounded border text-sm disabled:opacity-60"
                    disabled={mediaKitSaving || mediaKitResetting}
                    title="Recalculate 7-day, 15-day, and 1-month rates from the 1-day price"
                  >
                    Recalculate Rates
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetMediaKit()}
                    className="px-3 py-1.5 rounded border text-sm disabled:opacity-60"
                    disabled={mediaKitSaving || mediaKitResetting}
                    title="Calls POST /api/media-kit/reset (if supported)"
                  >
                    {mediaKitResetting ? 'Resetting…' : 'Reset to Default'}
                  </button>
                </div>
              </div>

              <textarea
                value={mediaKitEditorText}
                onChange={(e) => setMediaKitEditorText(e.target.value)}
                rows={20}
                className="w-full font-mono text-xs border rounded px-3 py-2 bg-white dark:bg-slate-950"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className={mediaKitPreview ? 'space-y-4' : 'space-y-4'}>
              <div className="border rounded p-4 bg-white dark:bg-slate-900">
                <div className="text-sm font-semibold mb-2">Overview</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(mediaKit.sections || []).map((s, idx) => (
                    <div key={`${s.heading}-${idx}`} className={mediaKitPreview ? 'rounded border p-3 bg-white dark:bg-slate-900' : 'rounded border p-3 bg-slate-50 dark:bg-slate-950'}>
                      <div className="text-sm font-medium">{s.heading}</div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                        {(s.bullets || []).map((b, i) => (
                          <li key={`${idx}-${i}`}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {mediaKit.tickerScrollAds ? (
                <div className="border rounded p-4 bg-white dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold mb-1">{mediaKit.tickerScrollAds.title}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">{mediaKit.tickerScrollAds.description}</div>
                    </div>
                    <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      Booking: {mediaKit.tickerScrollAds.bookingEmail || mediaKit.contactEmail || 'newspulse.ads@gmail.com'}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {[
                      { heading: 'Placements', items: mediaKit.tickerScrollAds.placements },
                      { heading: 'Rules', items: mediaKit.tickerScrollAds.rules },
                      { heading: 'Scheduling', items: mediaKit.tickerScrollAds.scheduling },
                      { heading: 'Frequency', items: mediaKit.tickerScrollAds.frequency },
                    ].map((group) => (
                      <div key={group.heading} className={mediaKitPreview ? 'rounded border p-3 bg-white dark:bg-slate-900' : 'rounded border p-3 bg-slate-50 dark:bg-slate-950'}>
                        <div className="text-sm font-medium">{group.heading}</div>
                        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                          {group.items.map((item, index) => (
                            <li key={`${group.heading}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <div className={mediaKitPreview ? 'rounded border p-3 bg-white dark:bg-slate-900' : 'rounded border p-3 bg-slate-50 dark:bg-slate-950'}>
                      <div className="text-sm font-medium">Language Packages (Ticker Scroll Ads)</div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                        {TICKER_SCROLL_LANGUAGE_PACKAGE_BULLETS.map((item, index) => (
                          <li key={`ticker-scroll-language-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {(mediaKit.tickerScrollAds.pricingTables || []).map((table, idx) => (
                      <div key={`${table.title}-${idx}`} className={mediaKitPreview ? 'rounded border p-3 bg-white dark:bg-slate-900' : 'rounded border p-3 bg-slate-50 dark:bg-slate-950'}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{table.title}</div>
                            {table.subtitle ? (
                              <div className="text-xs text-slate-500 dark:text-slate-400">{table.subtitle}</div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                          {TICKER_SCROLL_PRICING_PERIODS.map((period) => {
                            const value = table.prices[period.key];
                            const usd = mediaKit.showUsdApprox ? formatUsdApproxFromInr(value, mediaKit.fxRateUsdInr) : null;
                            return (
                              <div key={period.key} className="rounded border px-2 py-2 bg-white dark:bg-slate-900">
                                <div className="text-[11px] text-slate-500">{period.label}</div>
                                <div className="text-sm font-semibold">{formatMoney(value, mediaKit.currencyCode)}</div>
                                {usd ? (
                                  <div className="text-[11px] text-slate-500">≈ {usd}</div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                          <li>Two Languages (EN+HI / EN+GU / HI+GU): base × {TICKER_SCROLL_LANGUAGE_MULTIPLIERS.two}×</li>
                          <li>All Three Languages (EN+HI+GU): base × {TICKER_SCROLL_LANGUAGE_MULTIPLIERS.allThree}×</li>
                        </ul>

                        {(table.notes?.length || 0) > 0 ? (
                          <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                            {table.notes!.map((note, noteIndex) => (
                              <li key={`${table.title}-note-${noteIndex}`}>{note}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(mediaKit.brandedProducts?.length || 0) > 0 ? (
                <div className="border rounded p-4 bg-white dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold mb-1">Branded Content Products</div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">Premium sponsored placements and hosted campaigns for advertiser storytelling.</div>
                    </div>
                    <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      Booking: {mediaKit.contactEmail || 'newspulse.ads@gmail.com'}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {(mediaKit.brandedProducts || []).map((product, idx) => (
                      <div key={`${product.productKey}-${idx}`} className={mediaKitPreview ? 'rounded border p-3 bg-white dark:bg-slate-900' : 'rounded border p-3 bg-slate-50 dark:bg-slate-950'}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{product.name}</div>
                            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{product.description}</div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                          {(product.pricingTables || []).map((table, tableIndex) => (
                            <div key={`${product.productKey}-${table.title}-${tableIndex}`} className="rounded border px-3 py-3 bg-white dark:bg-slate-900">
                              <div>
                                <div className="text-sm font-medium">{table.title}</div>
                                {table.subtitle ? (
                                  <div className="text-xs text-slate-500 dark:text-slate-400">{table.subtitle}</div>
                                ) : null}
                              </div>

                              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                                {(product.pricingPeriods || []).map((period) => {
                                  const value = table.prices?.[period];
                                  if (value == null) return null;
                                  const usd = mediaKit.showUsdApprox ? formatUsdApproxFromInr(value, mediaKit.fxRateUsdInr) : null;
                                  return (
                                    <div key={`${product.productKey}-${table.title}-${period}`} className="rounded border px-2 py-2 bg-white dark:bg-slate-900">
                                      <div className="text-[11px] text-slate-500">{formatBrandedProductPeriodLabel(period)}</div>
                                      <div className="text-sm font-semibold">{formatMoney(value, mediaKit.currencyCode)}</div>
                                      {usd ? (
                                        <div className="text-[11px] text-slate-500">≈ {usd}</div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>

                              {(table.notes?.length || 0) > 0 ? (
                                <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                                  {table.notes!.map((note, noteIndex) => (
                                    <li key={`${product.productKey}-${table.title}-note-${noteIndex}`}>{note}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="border rounded p-4 bg-white dark:bg-slate-900">
                <div className="text-sm font-semibold mb-2">Rate Cards</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(mediaKit.rateCards || []).map((r, idx) => (
                    <div key={`${r.placementKey}-${idx}`} className={mediaKitPreview ? 'rounded border p-3 bg-white dark:bg-slate-900' : 'rounded border p-3 bg-slate-50 dark:bg-slate-950'}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{r.placementLabel}</div>
                          {!mediaKitPreview ? (
                            <div className="text-xs text-slate-500 font-mono">{r.placementKey}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {(
                          [
                                { label: '1 Day', period: 'day' as const, value: r.prices.day },
                                { label: '7 Days', period: 'week' as const, value: r.prices.week },
                                { label: '15 Days', period: 'rate15Days' as const, value: r.rate15Days },
                                { label: '1 Month', period: 'month' as const, value: r.prices.month },
                          ]
                        ).map((p) => {
                          const usd = mediaKit.showUsdApprox ? formatUsdApproxFromInr(p.value, mediaKit.fxRateUsdInr) : null;
                          return (
                            <div key={p.period} className="rounded border px-2 py-1 bg-white dark:bg-slate-900">
                              <div className="text-[11px] text-slate-500">{p.label}</div>
                              <div className="text-sm font-semibold">{formatMoney(p.value, mediaKit.currencyCode)}</div>
                              {usd ? (
                                <div className="text-[11px] text-slate-500">≈ {usd}</div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      {(r.includes?.length || 0) > 0 ? (
                        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                          {r.includes!.map((i, j) => (
                            <li key={`${idx}-inc-${j}`}>{i}</li>
                          ))}
                        </ul>
                      ) : null}

                      {(r.specs?.length || 0) > 0 ? (
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          Specs: {r.specs!.join(', ')}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {(mediaKit.bundles?.length || 0) > 0 ? (
                <div className="border rounded p-4 bg-white dark:bg-slate-900">
                  <div className="text-sm font-semibold mb-2">Bundles</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(mediaKit.bundles || []).map((b, idx) => (
                      <div key={`${b.name}-${idx}`} className={mediaKitPreview ? 'rounded border p-3 bg-white dark:bg-slate-900' : 'rounded border p-3 bg-slate-50 dark:bg-slate-950'}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-medium">{b.name}</div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">
                              {b.prices?.[b.billingPeriod] != null ? formatMoney(b.prices[b.billingPeriod] as number, mediaKit.currencyCode) : '—'}
                            </div>
                            <div className="text-xs text-slate-500">/{b.billingPeriod}</div>
                            {mediaKit.showUsdApprox && b.prices?.[b.billingPeriod] != null ? (
                              <div className="text-[11px] text-slate-500">
                                ≈ {formatUsdApproxFromInr(b.prices[b.billingPeriod] as number, mediaKit.fxRateUsdInr)}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          {b.prices?.day != null ? `${formatMoney(b.prices.day, mediaKit.currencyCode)}/day` : null}
                          {b.prices?.week != null ? `${b.prices?.day != null ? ' • ' : ''}${formatMoney(b.prices.week, mediaKit.currencyCode)}/week` : null}
                          {b.prices?.month != null ? `${(b.prices?.day != null || b.prices?.week != null) ? ' • ' : ''}${formatMoney(b.prices.month, mediaKit.currencyCode)}/month` : null}
                        </div>
                        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                          {(b.includes || []).map((i, j) => (
                            <li key={`${idx}-b-${j}`}>{i}</li>
                          ))}
                        </ul>
                        {(b.notes?.length || 0) > 0 ? (
                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            {b.notes!.join(' ')}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(mediaKit.policies?.length || 0) > 0 ? (
                <div className="border rounded p-4 bg-white dark:bg-slate-900">
                  <div className="text-sm font-semibold mb-2">Notes</div>
                  <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-200 space-y-1">
                    {(mediaKit.policies || []).map((p, idx) => (
                      <li key={`p-${idx}`}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {mediaKit.contactEmail ? (
                <div className="border rounded p-4 bg-white dark:bg-slate-900">
                  <div className="text-sm font-semibold mb-2">Contact</div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-medium">Email:</span>{' '}
                    <a className="text-blue-600 underline" href={mailtoHref(mediaKit.contactEmail)}>{mediaKit.contactEmail}</a>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'ads' ? (
        <>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800 border rounded p-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Slot</label>
          <select
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-900"
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value as any)}
          >
            <option value="ALL">All</option>
            {SLOT_OPTIONS.map(s => (
              <option key={s} value={s}>{slotLabel(String(s))}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>

        <div className="text-xs text-slate-500">
          Showing <span className="font-medium">{filteredAds.length}</span>
        </div>
      </div>

      {/* Ad Placements */}
      <div className="border rounded p-4 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ad Placements</h2>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="px-3 py-1 rounded border text-sm"
            disabled={settingsLoading}
          >
            {settingsLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {PLACEMENT_SLOT_OPTIONS.map((key) => (
            <div
              key={key}
              className="border rounded p-3 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-sm font-medium">{slotLabel(key)}</div>
                <div className="text-xs text-slate-500 font-mono">{key}</div>
              </div>
              <button
                type="button"
                disabled={settingsLoading || placementSaving[key]}
                onClick={() => void togglePlacement(key)}
                className={`px-3 py-1 rounded text-xs border min-w-[84px] ${placementSaving[key] ? 'cursor-not-allowed opacity-80' : ''} ${slotEnabled[key] ? 'bg-green-600 text-white border-green-600' : 'bg-slate-200 text-slate-700 border-slate-300'}`}
                title="Toggle placement"
              >
                {placementSaving[key] ? 'Saving…' : (slotEnabled[key] ? 'ON' : 'OFF')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto border rounded">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-900">
            <tr>
              <th className="text-left p-2">Slot</th>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Active</th>
              <th className="text-left p-2">Schedule</th>
              <th className="text-left p-2">Priority</th>
              <th className="text-left p-2">Updated</th>
              <th className="text-left p-2">Preview</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-slate-500" colSpan={8}>Loading…</td>
              </tr>
            ) : filteredAds.length === 0 ? (
              <tr>
                <td className="p-3 text-slate-500" colSpan={8}>No ads found.</td>
              </tr>
            ) : (
              filteredAds.map(ad => {
                const busy = Boolean(rowBusy[ad.id]);
                const updatedLabel = safeDateLabel(ad.updatedAt || ad.createdAt);
                const scheduleLabel = formatAdScheduleRange(ad.startAt, ad.endAt);
                const isBrokenImage = Boolean(ad.imageUrl) && Boolean(brokenImageByAdId[ad.id]);

                return (
                  <tr key={ad.id} className="border-t">
                    <td className="p-2 font-mono text-xs">{ad.slot}</td>
                    <td className="p-2">{ad.title || '-'}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(ad)}
                        className={`px-2 py-1 rounded text-xs border min-w-[44px] ${ad.isActive ? 'bg-green-600 text-white border-green-600' : 'bg-slate-200 text-slate-700 border-slate-300'}`}
                        title="Toggle active"
                      >
                        {busy ? '...' : (ad.isActive ? 'ON' : 'OFF')}
                      </button>
                    </td>
                    <td className="p-2 text-xs text-slate-600 dark:text-slate-300">{scheduleLabel}</td>
                    <td className="p-2">{Number(ad.priority ?? 0)}</td>
                    <td className="p-2 text-xs text-slate-600 dark:text-slate-300">{updatedLabel}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-[120px] h-[40px] bg-slate-100 dark:bg-slate-900 border rounded overflow-hidden flex items-center justify-center">
                          {ad.imageUrl ? (
                            // eslint-disable-next-line @typescript-eslint/no-misused-promises
                            <img
                              src={ad.imageUrl}
                              alt={ad.title || ad.slot}
                              className="max-w-full max-h-full object-contain"
                              onError={() => setBrokenImageByAdId((prev) => ({ ...prev, [ad.id]: true }))}
                              onLoad={() => setBrokenImageByAdId((prev) => (prev[ad.id] ? ({ ...prev, [ad.id]: false }) : prev))}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">No image</span>
                          )}
                        </div>
                        {isBrokenImage ? (
                          <span className="text-[11px] text-red-700">Image URL invalid</span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Click target</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(ad)}
                          className="px-2 py-1 rounded border text-xs"
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeAd(ad)}
                          className="px-2 py-1 rounded border text-xs text-red-700 border-red-300 hover:bg-red-50"
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-3 py-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white dark:bg-slate-900 rounded border shadow flex flex-col overflow-hidden"
            style={{
              maxHeight: 'calc(100vh - 32px)',
              width: 'min(920px, calc(100vw - 24px))',
            }}
          >
            <div className="flex items-center justify-between p-4 border-b flex-none">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Ad' : 'Create Ad'}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="px-2 py-1 rounded border"
                disabled={saving}
              >
                Close
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto py-5 px-6 overscroll-contain">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Slot *</label>
                  {editingId && isLegacySlot(form.slot) ? (
                    <div className="w-full border rounded px-2 py-2 bg-slate-50 dark:bg-slate-950">
                      <div className="text-sm">{slotLabel(String(form.slot))}</div>
                      <div className="text-xs text-slate-500 font-mono">{canonicalSlot(form.slot)}</div>
                    </div>
                  ) : (
                    <select
                      className="w-full border rounded px-2 py-2 bg-white dark:bg-slate-950"
                      value={form.slot}
                      onChange={(e) => setForm(prev => ({ ...prev, slot: e.target.value as any }))}
                      required
                    >
                      <option value="">Select slot…</option>
                      {SLOT_OPTIONS.map(s => (
                        <option key={s} value={s}>{slotDropdownLabel(String(s))}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Title *</label>
                  <input
                    className="w-full border rounded px-2 py-2"
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Sponsor: ACME"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium">Image URL *</label>
                  <input
                    className="w-full border rounded px-2 py-2"
                    value={form.imageUrl}
                    onChange={(e) => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://..."
                    required
                  />

                  {isExternalImageUrl(form.imageUrl) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded border text-sm disabled:opacity-60"
                        disabled={saving || hostingExternalImage || !editingId}
                        onClick={() => void hostExternalImageNow()}
                        title={editingId ? 'Ask backend to re-host this image' : 'Create the ad first, then you can host the image'}
                      >
                        {hostingExternalImage ? 'Hosting…' : 'Host this image'}
                      </button>
                      {!editingId ? (
                        <span className="text-xs text-slate-500">Will be hosted on Create Ad</span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="text-sm"
                      disabled={adImageUploading}
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0] || null;
                        setAdImageFile(f);
                      }}
                    />
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded border text-sm disabled:opacity-60"
                      disabled={adImageUploading || !adImageFile}
                      onClick={() => void handleUploadSelectedImage()}
                      title="Upload selected image"
                    >
                      {adImageUploading
                        ? (typeof adImageUploadProgress === 'number' ? `Uploading… ${adImageUploadProgress}%` : 'Uploading…')
                        : 'Upload Image'}
                    </button>
                    <span className="text-xs text-slate-500">Or paste a URL above</span>
                  </div>

                  {form.imageUrl ? (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="w-[180px] h-[60px] bg-slate-100 dark:bg-slate-900 border rounded overflow-hidden flex items-center justify-center">
                        {adImagePreviewBroken ? (
                          <span className="text-xs text-red-700">Preview failed</span>
                        ) : (
                          <img
                            src={form.imageUrl}
                            alt={form.title || form.slot || 'Ad image'}
                            className="max-w-full max-h-full object-contain"
                            onError={() => setAdImagePreviewBroken(true)}
                            onLoad={() => setAdImagePreviewBroken(false)}
                          />
                        )}
                      </div>
                      <div className="text-xs text-slate-500">Preview</div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium">Target URL{form.clickable ? ' *' : ''}</label>
                  <input
                    className="w-full border rounded px-2 py-2"
                    value={form.targetUrl}
                    onChange={(e) => setForm(prev => ({ ...prev, targetUrl: e.target.value }))}
                    placeholder="https://..."
                    required={form.clickable}
                    disabled={!form.clickable}
                  />
                  {!form.clickable && (
                    <div className="text-xs text-slate-500">View-only ad. Users won't be redirected.</div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Priority</label>
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-2"
                    value={form.priority}
                    onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Active</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                    <span className="text-sm">Is Active</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Clickable Ad</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.clickable}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setForm(prev => ({
                          ...prev,
                          clickable: next,
                          targetUrl: next ? prev.targetUrl : '',
                        }));
                      }}
                    />
                    <span className="text-sm">Clickable</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Start At</label>
                  <input
                    type="datetime-local"
                    className="w-full border rounded px-2 py-2"
                    value={form.startAt}
                    onChange={(e) => setForm(prev => ({ ...prev, startAt: e.target.value }))}
                  />
                  <div className="text-[11px] text-slate-500">
                    Time format: AM/PM{form.startAt ? ` • ${formatAdScheduleDateTime(form.startAt)}` : ''}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">End At</label>
                  <input
                    type="datetime-local"
                    className="w-full border rounded px-2 py-2"
                    value={form.endAt}
                    onChange={(e) => setForm(prev => ({ ...prev, endAt: e.target.value }))}
                  />
                  <div className="text-[11px] text-slate-500">
                    Time format: AM/PM{form.endAt ? ` • ${formatAdScheduleDateTime(form.endAt)}` : ''}
                  </div>
                </div>
                  </div>

              {/* Preview */}
              <div className="border rounded p-3 bg-slate-50 dark:bg-slate-950">
                <div className="text-sm font-medium mb-2">Preview</div>
                <div className="flex items-center gap-3">
                  <div className="w-[240px] h-[80px] bg-white dark:bg-slate-900 border rounded overflow-hidden flex items-center justify-center">
                    {form.imageUrl.trim() ? (
                      // eslint-disable-next-line @typescript-eslint/no-misused-promises
                      <img src={form.imageUrl.trim()} alt="Ad preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-400">Image preview</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-medium">Click target</div>
                    <div className="break-all">{(!form.clickable || !form.targetUrl.trim()) ? '(none)' : form.targetUrl.trim()}</div>
                    <div className="mt-3 font-medium">Schedule</div>
                    <div>{formatAdScheduleRange(form.startAt, form.endAt)}</div>
                  </div>
                </div>
              </div>

                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-900 py-4 px-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 z-[2]">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-2 rounded border"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 rounded bg-blue-600 text-white"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Create Ad')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      ) : null}
    </div>
  );
}
