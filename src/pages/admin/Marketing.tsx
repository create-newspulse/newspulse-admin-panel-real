import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Handshake, Link as LinkIcon, Megaphone, Plus, Search, Settings, Target, X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { ARTICLE_CATEGORY_OPTIONS, ARTICLE_CATEGORY_LABELS, isAllowedArticleCategoryKey } from '@/lib/articleCategories';
import { getAdminAnalyticsDashboard, listAdminAnalyticsCategories, type AnalyticsRangeKey, type CategoryAnalyticsRow, type DashboardAnalyticsResponse } from '@/lib/api/adminAnalytics';
import { listArticles } from '@/lib/api/articles';
import { MarketingApiError, getMarketingWorkspace, saveMarketingWorkspace } from '@/lib/api/marketing';

import {
  ADVERTISER_STAGES,
  DEFAULT_UTM_PRESETS,
  FOLLOW_UP_OUTCOMES,
  FOLLOW_UP_TYPES,
  GROWTH_GOAL_METRICS,
  GROWTH_GOAL_STATUSES,
  INTERACTION_TYPES,
  INTEREST_OPTIONS,
  LANGUAGE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LOST_REASONS,
  CAMPAIGN_REPORT_STATUSES,
  MARKETING_PRODUCT_GROUPS,
  MARKETING_PRODUCT_OPTIONS,
  PARTNERSHIP_TYPES,
  PROMOTION_ACTIVITY_TYPES,
  PROMOTION_CALENDAR_ITEM_TYPES,
  PROMOTION_CHANNELS,
  PROMOTION_DESTINATION_TYPES,
  PROMOTION_LANGUAGES,
  PROMOTION_OBJECTIVES,
  PROMOTION_PRIORITIES,
  PROMOTION_REGIONS,
  PROMOTION_STATUSES,
  PROPOSAL_PRODUCT_OPTIONS,
  RATE_CARD_BILLING_MODELS,
  RENEWAL_STATUSES,
  acceptProposalAndCreateDeal,
  addPromotionCalendarItem,
  addContact,
  addSalesNote,
  approveProposal,
  archiveCampaignReport,
  archivePromotion,
  archiveRenewal,
  assignSalesOwner,
  buildUtmUrl,
  calculateGrowthGoalProgress,
  calculateProposalTotals,
  changeAdvertiserStage,
  changeCampaignReportStatus,
  changePromotionStatus,
  changeRenewalStatus,
  completeFollowUp,
  createAdsManagerHandoff,
  createAdvertiserFromForm,
  createCampaignReport,
  createEmptyAdvertiserForm,
  createEmptyMarketingData,
  createEmptyPerformanceMetrics,
  createPartnership,
  createGrowthGoal,
  createPromotion,
  createPromotionLink,
  createProposalDraftFromRenewal,
  createProposal,
  createRenewal,
  duplicatePromotion,
  filterAdvertisers,
  findMarketingProduct,
  followUpComputedStatus,
  formatInrFromCents,
  hasAdvertiserFormErrors,
  logPromotionChannelActivity,
  logInteraction,
  mapAdsManagerCampaignStatus,
  normalizeMarketingData,
  parseCurrencyToCents,
  proposalItemInventoryId,
  proposalNeedsDiscountApproval,
  scheduleRenewalFollowUp,
  scheduleFollowUp,
  validateAdvertiserForm,
  type AdvertiserFilters,
  type AdvertiserFormData,
  type AdvertiserStage,
  type FollowUpOutcome,
  type FollowUpType,
  type InteractionType,
  type LostReason,
  type MarketingActor,
  type MarketingAdvertiser,
  type MarketingCampaignReport,
  type MarketingData,
  type MarketingDeal,
  type MarketingGrowthGoal,
  type MarketingPromotion,
  type MarketingProposalItem,
  type MarketingRateCard,
  type MarketingStaffOption,
  type PartnershipType,
  type CampaignReportStatus,
  type PromotionActivityType,
  type PromotionChannel,
  type PromotionDestinationType,
  type PromotionLanguage,
  type PromotionObjective,
  type PromotionPriority,
  type PromotionRegion,
  type PromotionStatus,
  type RateCardBillingModel,
  type RenewalStatus,
} from '@/lib/marketing';

type MarketingSection = 'overview' | 'advertisers' | 'follow-ups' | 'proposals' | 'partnerships' | 'campaigns' | 'audience' | 'promotion' | 'media-kit' | 'performance' | 'renewals';
type DrawerSection = 'overview' | 'contacts' | 'notes' | 'activity' | 'performance';
type AdsPlacementStatus = Record<string, boolean | undefined>;
type ProposalItemDraft = { productId: string; description: string; quantity: string; listPrice: string; discount: string; finalPrice: string; notes: string };
type AudienceRange = 'today' | '7d' | '30d' | '90d' | 'custom';
type AudienceAnalyticsState = { status: 'idle' | 'loading' | 'connected' | 'not_connected' | 'error'; dashboard: DashboardAnalyticsResponse | null; categories: CategoryAnalyticsRow[]; error?: string };
type PromotionFormState = { campaignName: string; objective: PromotionObjective; description: string; destinationType: PromotionDestinationType; destinationUrl: string; primaryLanguage: PromotionLanguage; targetRegion: PromotionRegion; customRegion: string; channels: PromotionChannel[]; startDate: string; endDate: string; ownerName: string; priority: PromotionPriority; notes: string; partnerId: string };
type GrowthGoalFormState = { goalName: string; metric: MarketingGrowthGoal['metric']; targetValue: string; startDate: string; targetDate: string; ownerName: string; status: MarketingGrowthGoal['status']; notes: string };
type UtmFormState = { promotionId: string; presetId: string; channel: PromotionChannel; destinationUrl: string; source: string; medium: string; campaign: string; content: string; term: string; allowExternal: boolean };
type ManualActivityFormState = { promotionId: string; channel: PromotionChannel; activityType: PromotionActivityType; occurredAt: string; url: string; notes: string };
type CalendarFormState = { promotionId: string; type: MarketingPromotion['calendarItems'][number]['type']; date: string; channel: PromotionChannel; notes: string };
type MarketingRequestAction = 'load' | 'save';

const SECTION_TABS: Array<{ key: MarketingSection; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'advertisers', label: 'Advertisers' },
  { key: 'follow-ups', label: 'Follow-ups' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'partnerships', label: 'Partnerships' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'audience', label: 'Audience' },
  { key: 'promotion', label: 'Promotion' },
  { key: 'media-kit', label: 'Media Kit' },
  { key: 'performance', label: 'Performance' },
  { key: 'renewals', label: 'Renewals' },
];

const PIPELINE_FILTERS: Array<{ key: AdvertiserStage | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new_lead', label: 'New Lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

const EMPTY_SECTIONS: Partial<Record<MarketingSection, { title: string; message: string }>> = {
  audience: { title: 'Audience data is not connected yet.', message: 'Connect verified analytics to display audience performance.' },
  promotion: { title: 'No promotion configuration yet.', message: 'Promotion channels will appear here when real configuration exists.' },
  performance: { title: 'Performance data is not connected yet.', message: 'Campaign and promotion results will appear after verified tracking is connected.' },
  renewals: { title: 'No renewals due.', message: 'Renewals will appear after real advertiser contracts or campaigns exist.' },
};

function stageLabel(stage: AdvertiserStage): string {
  return PIPELINE_FILTERS.find((item) => item.key === stage)?.label || stage;
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = value ? new Date(`${value}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(date.getTime())) return todayDate();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function firstMarketingProductId(): string {
  return MARKETING_PRODUCT_OPTIONS[0]?.id || 'CUSTOM_PACKAGE';
}

function createEmptyProposalItemDraft(): ProposalItemDraft {
  return { productId: firstMarketingProductId(), description: '', quantity: '', listPrice: '', discount: '', finalPrice: '', notes: '' };
}

function createEmptyPromotionForm(): PromotionFormState {
  return { campaignName: '', objective: 'Website Traffic', description: '', destinationType: 'Homepage', destinationUrl: '', primaryLanguage: 'All', targetRegion: 'India', customRegion: '', channels: [], startDate: todayDate(), endDate: todayDate(), ownerName: 'Founder', priority: 'Normal', notes: '', partnerId: '' };
}

function createEmptyGrowthGoalForm(): GrowthGoalFormState {
  return { goalName: '', metric: 'Monthly Website Users', targetValue: '', startDate: todayDate(), targetDate: todayDate(), ownerName: 'Founder', status: 'Planned', notes: '' };
}

function createEmptyUtmForm(): UtmFormState {
  return { promotionId: '', presetId: '', channel: 'Instagram', destinationUrl: '', source: '', medium: '', campaign: '', content: '', term: '', allowExternal: false };
}

function createEmptyManualActivityForm(): ManualActivityFormState {
  return { promotionId: '', channel: 'Instagram', activityType: 'Post Published', occurredAt: new Date().toISOString().slice(0, 16), url: '', notes: '' };
}

function createEmptyCalendarForm(): CalendarFormState {
  return { promotionId: '', type: 'Planned promotion', date: todayDate(), channel: 'Organic / Internal Promotion', notes: '' };
}

function displayMetric(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : 'Not Connected';
}

function marketingEndpointDisplayPath(endpoint: string): string {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (normalized.startsWith('/admin-api/')) return normalized;
  if (normalized.startsWith('/api/admin/')) return `/admin-api${normalized.slice('/api'.length)}`;
  if (normalized.startsWith('/admin/')) return `/admin-api${normalized}`;
  return `/admin-api/admin${normalized}`;
}

function marketingRequestDescription(error: unknown, action: MarketingRequestAction): string {
  const apiError = error instanceof MarketingApiError ? error : null;
  const status = apiError?.status;
  const endpoint = apiError?.endpoint || '/marketing';
  const displayEndpoint = marketingEndpointDisplayPath(endpoint);
  const actionText = action === 'load' ? 'loaded' : 'saved';
  const noFallback = action === 'load' ? 'No sample records were substituted.' : 'No frontend-only copy was stored.';

  if (status === 401) {
    return `Marketing data could not be ${actionText} because the backend rejected the admin session with 401 Unauthorized. Sign in again, then retry. ${noFallback}`;
  }
  if (status === 403) {
    return `Marketing data could not be ${actionText} because this admin account does not have Marketing permission. Backend returned 403 Forbidden. ${noFallback}`;
  }
  if (status === 404) {
    return `Marketing data could not be ${actionText} because the backend route was not found at ${displayEndpoint}. Backend returned 404 Not Found. ${noFallback}`;
  }
  if (status && status >= 500) {
    return `Marketing data could not be ${actionText} because the Marketing backend returned ${status}. ${noFallback}`;
  }
  if (!status) {
    return `Marketing data could not be ${actionText} because the Marketing backend could not be reached through ${displayEndpoint}. ${noFallback}`;
  }
  return `Marketing data could not be ${actionText}. Backend returned ${status}. ${noFallback}`;
}

function dashboardTotalsValue(dashboard: DashboardAnalyticsResponse | null, keys: string[]): number | null {
  const totals = (dashboard as any)?.totals || {};
  for (const key of keys) {
    const value = Number(totals[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function findSourceMetric(dashboard: DashboardAnalyticsResponse | null, pattern: RegExp): number | null {
  const sources = Array.isArray((dashboard as any)?.sources) ? (dashboard as any).sources : [];
  const matched = sources.find((source: any) => pattern.test(String(source?.source || '')));
  const value = Number(matched?.readers ?? matched?.users ?? matched?.sessions ?? matched?.views);
  return Number.isFinite(value) ? value : null;
}

function audienceChannelPattern(channel: string): RegExp {
  switch (channel) {
    case 'Organic Search': return /organic|search/i;
    case 'Google News': return /google news/i;
    case 'Google Discover': return /discover/i;
    case 'Direct': return /direct/i;
    case 'Referral': return /referral|partner/i;
    case 'Social': return /social|facebook|instagram|x|twitter|youtube|whatsapp|telegram/i;
    case 'Email': return /email|newsletter/i;
    case 'Campaign': return /campaign|utm/i;
    case 'Other': return /other|unknown/i;
    default: return new RegExp(`^${channel}$`, 'i');
  }
}

function analyticsRangeParams(range: AudienceRange): { range?: AnalyticsRangeKey; from?: string; to?: string } {
  if (range === 'today') return { range: '24h' };
  if (range === '7d') return { range: '7d' };
  if (range === '30d') return { range: '30d' };
  if (range === '90d') {
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 86400000);
    return { range: 'custom', from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  return { range: 'custom' };
}

function categoryLabel(category: string): string {
  const key = String(category || '').trim();
  return isAllowedArticleCategoryKey(key) ? ARTICLE_CATEGORY_LABELS[key] : key || 'Uncategorized';
}

function parseAdsPlacementEnabled(value: unknown): boolean {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return Boolean(record.enabled ?? record.isEnabled ?? record.active ?? record.isActive);
  }
  return Boolean(value);
}

function normalizeAdsPlacementStatus(raw: unknown): AdsPlacementStatus {
  const source = (raw as any)?.slotEnabled || (raw as any)?.data?.slotEnabled || (raw as any)?.settings?.slotEnabled || raw;
  const status: AdsPlacementStatus = {};
  if (!source || typeof source !== 'object') return status;
  MARKETING_PRODUCT_OPTIONS.forEach((product) => {
    if (!product.placementId || !Object.prototype.hasOwnProperty.call(source, product.placementId)) return;
    status[product.placementId] = parseAdsPlacementEnabled((source as Record<string, unknown>)[product.placementId]);
  });
  return status;
}

function placementStatusText(status: AdsPlacementStatus, placementId?: string): string {
  if (!placementId) return 'Not applicable';
  if (typeof status[placementId] !== 'boolean') return 'Unknown';
  return status[placementId] ? 'ON' : 'OFF';
}

function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"><Megaphone className="h-5 w-5" /></div>
      <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function TextInput({ label, value, onChange, required, error, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; error?: string; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}{required ? ' *' : ''}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white" aria-invalid={error ? 'true' : undefined} />
      {error ? <div className="mt-1 text-xs font-semibold text-red-600">{error}</div> : null}
    </label>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <option value="">Select</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default function Marketing() {
  const [activeSection, setActiveSection] = useState<MarketingSection>('overview');
  const [drawerSection, setDrawerSection] = useState<DrawerSection>('overview');
  const [data, setData] = useState<MarketingData>(() => createEmptyMarketingData());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AdvertiserFormData>(() => createEmptyAdvertiserForm());
  const [formErrors, setFormErrors] = useState<ReturnType<typeof validateAdvertiserForm>>({});
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string | null>(null);
  const [pendingLostId, setPendingLostId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [stageError, setStageError] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', designation: '', email: '', phone: '', primary: false, notes: '' });
  const [noteText, setNoteText] = useState('');
  const [interactionForm, setInteractionForm] = useState<{ type: InteractionType; summary: string; nextAction: string }>({ type: 'Phone Call', summary: '', nextAction: '' });
  const [followUpForm, setFollowUpForm] = useState<{ type: FollowUpType; date: string; time: string; assignedStaffId: string; assignedStaffName: string; priority: 'Low' | 'Normal' | 'High'; notes: string }>({ type: 'Call', date: todayDate(), time: '11:00', assignedStaffId: '', assignedStaffName: '', priority: 'Normal', notes: '' });
  const [completeOutcome, setCompleteOutcome] = useState<FollowUpOutcome | ''>('');
  const [proposalForm, setProposalForm] = useState({ advertiserId: '', title: '', objective: '', startDate: todayDate(), endDate: todayDate(), validUntil: todayDate(), product: 'Homepage 300x250', listPrice: '', finalPrice: '' });
  const [proposalItemDraft, setProposalItemDraft] = useState<ProposalItemDraft>(() => createEmptyProposalItemDraft());
  const [proposalItems, setProposalItems] = useState<MarketingProposalItem[]>([]);
  const [adsPlacementStatus, setAdsPlacementStatus] = useState<AdsPlacementStatus>({});
  const [adsPlacementStatusNote, setAdsPlacementStatusNote] = useState<string | null>(null);
  const [partnershipForm, setPartnershipForm] = useState({ organization: '', partnershipType: 'Media Partner' as PartnershipType, contactPerson: '', email: '', phone: '', opportunity: '', estimatedValue: '', startDate: '', endDate: '', notes: '' });
  const [rateForm, setRateForm] = useState({ productName: '', placement: '', description: '', billingModel: 'Fixed' as RateCardBillingModel, listPrice: '', minimumPrice: '', maximumStaffDiscount: '', active: true });
  const [filters, setFilters] = useState<AdvertiserFilters>({ search: '', stage: 'all', industry: '', salesOwnerId: '', leadSource: '', followUpStatus: 'all', dateFilter: 'all', sort: 'newest' });
  const [audienceRange, setAudienceRange] = useState<AudienceRange>('30d');
  const [audienceState, setAudienceState] = useState<AudienceAnalyticsState>({ status: 'idle', dashboard: null, categories: [] });
  const [promotionForm, setPromotionForm] = useState<PromotionFormState>(() => createEmptyPromotionForm());
  const [growthGoalForm, setGrowthGoalForm] = useState<GrowthGoalFormState>(() => createEmptyGrowthGoalForm());
  const [utmForm, setUtmForm] = useState<UtmFormState>(() => createEmptyUtmForm());
  const [manualActivityForm, setManualActivityForm] = useState<ManualActivityFormState>(() => createEmptyManualActivityForm());
  const [calendarForm, setCalendarForm] = useState<CalendarFormState>(() => createEmptyCalendarForm());
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [promotionView, setPromotionView] = useState<'workspace' | 'calendar' | 'utm' | 'queue' | 'channels'>('workspace');
  const [calendarView, setCalendarView] = useState<'Month' | 'Week' | 'List'>('Month');
  const [contentQueueLoading, setContentQueueLoading] = useState(false);
  const [contentQueueError, setContentQueueError] = useState<string | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);

  const actor: MarketingActor = useMemo(() => ({
    name: 'Founder',
    staffId: 'founder',
    role: 'founder',
    specialRights: [],
  }), []);

  const loadMarketingData = useCallback((isCancelled?: () => boolean) => {
    setIsLoading(true);
    getMarketingWorkspace()
      .then((workspace) => {
        if (isCancelled?.()) return;
        setData(workspace);
        setError(null);
      })
      .catch((loadError) => {
        if (isCancelled?.()) return;
        setError(marketingRequestDescription(loadError, 'load'));
      })
      .finally(() => {
        if (!isCancelled?.()) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMarketingData(() => cancelled);
    return () => { cancelled = true; };
  }, [loadMarketingData]);

  useEffect(() => {
    if (activeSection !== 'proposals') return;
    let cancelled = false;

    adminApi.get('/admin/ad-settings')
      .then((res) => {
        if (cancelled) return;
        setAdsPlacementStatus(normalizeAdsPlacementStatus(res?.data));
        setAdsPlacementStatusNote(null);
      })
      .catch(() => {
        if (cancelled) return;
        setAdsPlacementStatus({});
        setAdsPlacementStatusNote('Ads Manager placement status is unavailable. Products remain available for future proposals.');
      });

    return () => { cancelled = true; };
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'audience' && activeSection !== 'overview' && activeSection !== 'performance') return;
    let cancelled = false;
    setAudienceState((current) => ({ ...current, status: 'loading', error: undefined }));
    const params = analyticsRangeParams(audienceRange);

    Promise.all([getAdminAnalyticsDashboard(params), listAdminAnalyticsCategories(params)])
      .then(([dashboard, categoryPayload]) => {
        if (cancelled) return;
        const rows = (categoryPayload?.rows || categoryPayload?.items || []) as CategoryAnalyticsRow[];
        const hasTotals = Boolean((dashboard as any)?.totals && Object.keys((dashboard as any).totals).length > 0);
        const hasSources = Array.isArray((dashboard as any)?.sources) && (dashboard as any).sources.length > 0;
        const hasLanguages = Array.isArray((dashboard as any)?.languages) && (dashboard as any).languages.length > 0;
        setAudienceState({ status: hasTotals || hasSources || hasLanguages || rows.length ? 'connected' : 'not_connected', dashboard, categories: rows });
      })
      .catch(() => {
        if (cancelled) return;
        setAudienceState({ status: 'not_connected', dashboard: null, categories: [], error: 'Audience analytics are not connected.' });
      });

    return () => { cancelled = true; };
  }, [activeSection, audienceRange]);

  useEffect(() => {
    if (activeSection !== 'promotion' || promotionView !== 'queue') return;
    let cancelled = false;
    setContentQueueLoading(true);
    setContentQueueError(null);

    listArticles({ status: 'published', page: 1, limit: 25, sort: '-publishedAt' })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray((res as any)?.rows) ? (res as any).rows : [];
        updateData((current) => {
          const existing = new Set(current.contentQueue.map((item) => item.articleId));
          const nextItems = rows
            .map((article: any) => {
              const articleId = String(article?._id || article?.id || article?.slug || '').trim();
              if (!articleId || existing.has(articleId)) return null;
              const slug = String(article?.slug || articleId).trim();
              const publishedDate = String(article?.publishedAt || article?.createdAt || '').slice(0, 10);
              return { id: makeId('queue'), articleId, headline: String(article?.title || article?.headline || 'Untitled').trim(), category: String(article?.category || '').trim(), language: String(article?.language || article?.lang || '').trim() || 'Unknown', publishedDate, articleUrl: slug ? `/news/${slug}` : '', promotionStatus: 'Not Promoted' as const, articleType: String(article?.editorialType || article?.type || 'Article').trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            })
            .filter(Boolean) as MarketingData['contentQueue'];
          return nextItems.length ? { ...current, contentQueue: [...current.contentQueue, ...nextItems] } : current;
        });
      })
      .catch(() => {
        if (!cancelled) setContentQueueError('Content promotion queue could not load real articles. No sample content was substituted.');
      })
      .finally(() => {
        if (!cancelled) setContentQueueLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeSection, promotionView]);

  const selectedAdvertiser = data.advertisers.find((advertiser) => advertiser.id === selectedAdvertiserId) || null;
  const staffOptions = useMemo<MarketingStaffOption[]>(() => {
    const current: MarketingStaffOption = { id: actor.staffId, name: actor.name, staffId: actor.staffId, role: actor.role, eligibleMarketingStaff: true };
    const assigned = data.advertisers.filter((advertiser) => advertiser.salesOwnerId && advertiser.salesOwnerName).map((advertiser) => ({ id: advertiser.salesOwnerId!, name: advertiser.salesOwnerName!, staffId: advertiser.salesOwnerId!, eligibleMarketingStaff: true }));
    return [current, ...assigned].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index);
  }, [actor, data.advertisers]);

  const filteredAdvertisers = useMemo(() => filterAdvertisers(data.advertisers, filters, 'all', data.followUps), [data.advertisers, data.followUps, filters]);
  const activities = useMemo(() => data.advertisers.flatMap((advertiser) => advertiser.activity.map((activity) => ({ ...activity, advertiserName: advertiser.companyName }))).concat(data.partnerships.flatMap((partnership) => partnership.activity.map((activity) => ({ ...activity, advertiserName: partnership.organization })))).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [data.advertisers, data.partnerships]);
  const openProposals = data.proposals.filter((proposal) => !['accepted', 'rejected', 'expired', 'cancelled'].includes(proposal.status)).length;
  const negotiations = data.advertisers.filter((advertiser) => advertiser.stage === 'negotiation').length;
  const wonDeals = data.deals.filter((deal) => deal.status === 'won' || deal.status === 'handoff_ready' || deal.status === 'handoff_sent').length;
  const activePartnerships = data.partnerships.filter((partnership) => partnership.status === 'active').length;
  const dueFollowUps = data.followUps.filter((followUp) => ['due', 'overdue'].includes(followUpComputedStatus(followUp))).length;
  const visiblePromotions = data.promotions.filter((promotion) => !promotion.archivedAt);
  const archivedPromotions = data.promotions.filter((promotion) => promotion.archivedAt);
  const activePromotions = visiblePromotions.filter((promotion) => promotion.status === 'Active').length;
  const plannedPromotions = visiblePromotions.filter((promotion) => promotion.status === 'Planned').length;
  const completedPromotions = visiblePromotions.filter((promotion) => promotion.status === 'Completed').length;
  const activeGrowthGoals = data.growthGoals.filter((goal) => goal.status === 'Active').length;
  const activeAdvertiserCampaigns = data.deals.filter((deal) => ['handoff_ready', 'handoff_sent'].includes(deal.status) || ['sent_to_ads_manager', 'ads_manager_draft_created'].includes(deal.handoffStatus)).length;
  const completedAdvertiserCampaigns = data.deals.filter((deal) => deal.campaignEnd && deal.campaignEnd < todayDate()).length;
  const renewalRows = data.renewals.filter((renewal) => !renewal.archivedAt);
  const renewalDueToday = renewalRows.filter((renewal) => renewal.suggestedFollowUpDate === todayDate()).length;
  const renewalUpcoming30 = renewalRows.filter((renewal) => renewal.suggestedFollowUpDate > todayDate()).length;
  const reportsReady = data.campaignReports.filter((report) => report.status === 'Ready').length;
  const verifiedMonthlyUsers = dashboardTotalsValue(audienceState.dashboard, ['users', 'totalUsers', 'uniqueReaders', 'readers']);
  const verifiedOrganicUsers = findSourceMetric(audienceState.dashboard, /organic|search/i);
  const verifiedReturningReaders = dashboardTotalsValue(audienceState.dashboard, ['returningUsers', 'returningReaders']);

  const todayWork = useMemo(() => {
    const today = todayDate();
    const items: Array<{ label: string; detail: string }> = [];
    visiblePromotions.forEach((promotion) => {
      if (promotion.startDate === today) items.push({ label: 'Promotion starts today', detail: promotion.campaignName });
      if (promotion.endDate === today) items.push({ label: 'Promotion ends today', detail: promotion.campaignName });
      promotion.calendarItems.forEach((item) => { if (item.date === today) items.push({ label: item.type, detail: promotion.campaignName }); });
    });
    data.followUps.forEach((followUp) => { if (followUpComputedStatus(followUp) === 'due') items.push({ label: 'Follow-up due', detail: followUp.type }); });
    data.proposals.forEach((proposal) => { if (proposal.validUntil === today && !['accepted', 'rejected', 'expired', 'cancelled'].includes(proposal.status)) items.push({ label: 'Proposal expiring', detail: proposal.title }); });
    data.growthGoals.forEach((goal) => { if (goal.targetDate === today && !['Achieved', 'Closed'].includes(goal.status)) items.push({ label: 'Growth goal deadline', detail: goal.goalName }); });
    return items;
  }, [data.followUps, data.growthGoals, data.proposals, visiblePromotions]);

  function persistMarketingData(next: MarketingData) {
    setIsSaving(true);
    saveMarketingWorkspace(next)
      .then((workspace) => {
        setData(workspace);
        setError(null);
      })
      .catch((saveError) => {
        setError(marketingRequestDescription(saveError, 'save'));
      })
      .finally(() => setIsSaving(false));
  }

  function updateData(mutator: (current: MarketingData) => MarketingData) {
    setData((current) => {
      const next = normalizeMarketingData(mutator(current));
      persistMarketingData(next);
      return next;
    });
  }

  function updateAdvertiser(id: string, updater: (advertiser: MarketingAdvertiser) => MarketingAdvertiser) {
    updateData((current) => ({ ...current, advertisers: current.advertisers.map((advertiser) => advertiser.id === id ? updater(advertiser) : advertiser) }));
  }

  function updateFormField<K extends keyof AdvertiserFormData>(field: K, value: AdvertiserFormData[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleFormArray(field: 'interests' | 'targetLanguages', value: string) {
    setForm((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value] }));
  }

  function openAdvertiserForm() {
    setActiveSection('advertisers');
    setForm(createEmptyAdvertiserForm());
    setFormErrors({});
    setFormOpen(true);
  }

  function saveAdvertiser() {
    const errors = validateAdvertiserForm(form);
    setFormErrors(errors);
    if (hasAdvertiserFormErrors(errors)) return;
    const advertiser = createAdvertiserFromForm(form, new Date().toISOString(), actor);
    updateData((current) => ({ ...current, advertisers: [advertiser, ...current.advertisers] }));
    setSelectedAdvertiserId(advertiser.id);
    setDrawerSection('overview');
    setForm(createEmptyAdvertiserForm());
    setFormOpen(false);
  }

  function requestStage(advertiserId: string, stage: AdvertiserStage) {
    if (stage === 'lost') {
      setPendingLostId(advertiserId);
      setLostReason('');
      setStageError(null);
      return;
    }
    updateAdvertiser(advertiserId, (advertiser) => changeAdvertiserStage(advertiser, stage, { actor }).advertiser || advertiser);
  }

  function confirmLost() {
    if (!pendingLostId) return;
    if (!lostReason) {
      setStageError('Lost Reason is required when marking an advertiser as Lost.');
      return;
    }
    updateAdvertiser(pendingLostId, (advertiser) => changeAdvertiserStage(advertiser, 'lost', { lostReason, actor }).advertiser || advertiser);
    setPendingLostId(null);
    setLostReason('');
    setStageError(null);
  }

  function addContactFromDrawer() {
    if (!selectedAdvertiser || !contactForm.name.trim()) return;
    updateAdvertiser(selectedAdvertiser.id, (advertiser) => addContact(advertiser, contactForm, actor));
    setContactForm({ name: '', designation: '', email: '', phone: '', primary: false, notes: '' });
  }

  function addNoteFromDrawer() {
    if (!selectedAdvertiser || !noteText.trim()) return;
    updateAdvertiser(selectedAdvertiser.id, (advertiser) => addSalesNote(advertiser, noteText, actor));
    setNoteText('');
  }

  function logInteractionFromDrawer() {
    if (!selectedAdvertiser || !interactionForm.summary.trim()) return;
    updateAdvertiser(selectedAdvertiser.id, (advertiser) => logInteraction(advertiser, { contactId: advertiser.contacts.find((contact) => contact.primary)?.id, type: interactionForm.type, occurredAt: new Date().toISOString(), summary: interactionForm.summary, nextAction: interactionForm.nextAction }, actor));
    setInteractionForm({ type: 'Phone Call', summary: '', nextAction: '' });
  }

  function scheduleFollowUpFromDrawer() {
    if (!selectedAdvertiser) return;
    const assigned = staffOptions.find((staff) => staff.id === followUpForm.assignedStaffId) || staffOptions[0];
    const scheduled = scheduleFollowUp(selectedAdvertiser, { ...followUpForm, assignedStaffId: assigned.id, assignedStaffName: assigned.name, contactId: selectedAdvertiser.contacts.find((contact) => contact.primary)?.id }, actor);
    updateData((current) => ({ ...current, advertisers: current.advertisers.map((advertiser) => advertiser.id === selectedAdvertiser.id ? scheduled.advertiser : advertiser), followUps: [scheduled.followUp, ...current.followUps] }));
  }

  function completeFollowUpById(followUpId: string) {
    const followUp = data.followUps.find((item) => item.id === followUpId);
    const advertiser = data.advertisers.find((item) => item.id === followUp?.advertiserId);
    if (!followUp || !advertiser) return;
    if (!completeOutcome) {
      setStageError('Outcome is required when completing a follow-up.');
      return;
    }
    const result = completeFollowUp(advertiser, followUp, { outcome: completeOutcome }, actor);
    updateData((current) => ({ ...current, advertisers: current.advertisers.map((item) => item.id === advertiser.id ? result.advertiser : item), followUps: current.followUps.map((item) => item.id === followUpId ? result.followUp || item : item) }));
    setCompleteOutcome('');
    setStageError(null);
  }

  function updateProposalProduct(productId: string) {
    const product = findMarketingProduct(productId);
    setProposalItemDraft((current) => ({
      ...current,
      productId,
      description: current.description && findMarketingProduct(current.productId)?.description !== current.description ? current.description : product?.description || '',
    }));
  }

  function addProposalLineItem() {
    const product = findMarketingProduct(proposalItemDraft.productId);
    if (!product) {
      setStageError('Select a valid News Pulse product.');
      return;
    }
    const item: MarketingProposalItem = {
      id: makeId('item'),
      product: product.label,
      productId: product.id,
      placementId: product.placementId,
      productGroup: product.group,
      description: proposalItemDraft.description || product.description,
      quantity: proposalItemDraft.quantity,
      listPrice: proposalItemDraft.listPrice,
      discount: proposalItemDraft.discount,
      finalPrice: proposalItemDraft.finalPrice,
      notes: proposalItemDraft.notes,
    };
    setProposalItems((current) => [...current, item]);
    setProposalItemDraft(createEmptyProposalItemDraft());
    setStageError(null);
  }

  function removeProposalLineItem(itemId: string) {
    setProposalItems((current) => current.filter((item) => item.id !== itemId));
  }

  function createProposalFromForm() {
    const advertiser = data.advertisers.find((item) => item.id === proposalForm.advertiserId) || selectedAdvertiser;
    if (!advertiser) return;
    if (proposalItems.length === 0) {
      setStageError('Add at least one proposal product.');
      return;
    }
    const result = createProposal({ advertiserId: advertiser.id, primaryContactId: advertiser.contacts.find((contact) => contact.primary)?.id, title: proposalForm.title, campaignObjective: proposalForm.objective, targetRegion: advertiser.targetRegion, targetLanguages: advertiser.targetLanguages, startDate: proposalForm.startDate, endDate: proposalForm.endDate, validUntil: proposalForm.validUntil, internalSalesOwnerId: advertiser.salesOwnerId, internalSalesOwnerName: advertiser.salesOwnerName, items: proposalItems, taxRate: data.settings.taxRate, approvalRequired: data.settings.requireProposalApproval }, data.rateCards);
    if (result.error || !result.proposal) {
      setStageError(result.error || 'Proposal could not be created.');
      return;
    }
    updateData((current) => ({ ...current, proposals: [result.proposal!, ...current.proposals], advertisers: current.advertisers.map((item) => item.id === advertiser.id ? (changeAdvertiserStage(item, 'proposal', { actor }).advertiser || item) : item) }));
    setActiveSection('proposals');
    setProposalItems([]);
    setProposalItemDraft(createEmptyProposalItemDraft());
    setStageError(null);
  }

  function approveProposalById(proposalId: string) {
    updateData((current) => ({ ...current, proposals: current.proposals.map((proposal) => proposal.id === proposalId ? (approveProposal(proposal, actor, 'Approved in Marketing workspace.').proposal || proposal) : proposal) }));
  }

  function markSentById(proposalId: string) {
    updateData((current) => ({ ...current, proposals: current.proposals.map((proposal) => proposal.id === proposalId ? (markProposalSent(proposal, actor, 'Email').proposal || proposal) : proposal) }));
  }

  function acceptProposalById(proposalId: string) {
    const proposal = data.proposals.find((item) => item.id === proposalId);
    const advertiser = data.advertisers.find((item) => item.id === proposal?.advertiserId);
    if (!proposal || !advertiser) return;
    const result = acceptProposalAndCreateDeal(advertiser, proposal, data.deals, actor);
    if (result.error || !result.deal || !result.proposal || !result.advertiser) {
      setStageError(result.error || 'Deal could not be created.');
      return;
    }
    updateData((current) => ({ ...current, advertisers: current.advertisers.map((item) => item.id === advertiser.id ? result.advertiser! : item), proposals: current.proposals.map((item) => item.id === proposalId ? result.proposal! : item), deals: [result.deal!, ...current.deals] }));
  }

  function sendDealToAdsManager(dealId: string) {
    const deal = data.deals.find((item) => item.id === dealId);
    const proposal = data.proposals.find((item) => item.id === deal?.proposalId);
    const advertiser = data.advertisers.find((item) => item.id === deal?.advertiserId);
    if (!deal || !proposal || !advertiser) return;
    const result = createAdsManagerHandoff(advertiser, deal, proposal, data.handoffs, actor);
    if (result.error || !result.handoff || !result.deal || !result.advertiser) {
      setStageError(result.error || 'Ads Manager handoff could not be created.');
      return;
    }
    updateData((current) => ({ ...current, advertisers: current.advertisers.map((item) => item.id === advertiser.id ? result.advertiser! : item), deals: current.deals.map((item) => item.id === deal.id ? result.deal! : item), handoffs: [result.handoff!, ...current.handoffs] }));
  }

  function createPartnershipFromForm() {
    if (!partnershipForm.organization.trim()) return;
    const partnership = createPartnership({ ...partnershipForm, ownerId: actor.staffId, ownerName: actor.name }, actor);
    updateData((current) => ({ ...current, partnerships: [partnership, ...current.partnerships] }));
    setPartnershipForm({ organization: '', partnershipType: 'Media Partner', contactPerson: '', email: '', phone: '', opportunity: '', estimatedValue: '', startDate: '', endDate: '', notes: '' });
  }

  function saveRateCard() {
    if (!rateForm.productName.trim()) return;
    const now = new Date().toISOString();
    const rate: MarketingRateCard = { id: makeId('rate'), ...rateForm, createdAt: now, updatedAt: now };
    updateData((current) => ({ ...current, rateCards: [rate, ...current.rateCards] }));
    setRateForm({ productName: '', placement: '', description: '', billingModel: 'Fixed', listPrice: '', minimumPrice: '', maximumStaffDiscount: '', active: true });
  }

  function togglePromotionChannel(channel: PromotionChannel) {
    setPromotionForm((current) => ({ ...current, channels: current.channels.includes(channel) ? current.channels.filter((item) => item !== channel) : [...current.channels, channel] }));
  }

  function savePromotion() {
    const result = createPromotion({ ...promotionForm, ownerId: actor.staffId, ownerName: promotionForm.ownerName || actor.name }, actor);
    if (result.error || !result.promotion) {
      setPromotionError(result.error || 'Promotion could not be created.');
      return;
    }
    updateData((current) => ({ ...current, promotions: [result.promotion!, ...current.promotions] }));
    setPromotionForm(createEmptyPromotionForm());
    setPromotionError(null);
  }

  function setPromotionStatus(id: string, status: PromotionStatus) {
    updateData((current) => ({ ...current, promotions: current.promotions.map((promotion) => {
      if (promotion.id !== id) return promotion;
      const result = changePromotionStatus(promotion, status, actor);
      if (result.error) setPromotionError(result.error);
      return result.promotion || promotion;
    }) }));
  }

  function archivePromotionById(id: string) {
    updateData((current) => ({ ...current, promotions: current.promotions.map((promotion) => {
      if (promotion.id !== id) return promotion;
      const result = archivePromotion(promotion, actor);
      if (result.error) setPromotionError(result.error);
      return result.promotion || promotion;
    }) }));
  }

  function duplicatePromotionById(id: string) {
    const promotion = data.promotions.find((item) => item.id === id);
    if (!promotion) return;
    updateData((current) => ({ ...current, promotions: [duplicatePromotion(promotion, actor), ...current.promotions] }));
  }

  function applyUtmPreset(presetId: string) {
    const preset = data.utmPresets.find((item) => item.id === presetId) || DEFAULT_UTM_PRESETS.find((item) => item.id === presetId);
    setUtmForm((current) => ({ ...current, presetId, source: preset?.source || current.source, medium: preset?.medium || current.medium }));
  }

  function savePromotionLink() {
    const promotion = data.promotions.find((item) => item.id === utmForm.promotionId);
    if (!promotion) {
      setPromotionError('Select a promotion before creating a UTM link.');
      return;
    }
    const result = createPromotionLink(promotion, { channel: utmForm.channel, destinationUrl: utmForm.destinationUrl, source: utmForm.source, medium: utmForm.medium, campaign: utmForm.campaign, content: utmForm.content, term: utmForm.term }, actor);
    if (result.error || !result.promotion) {
      setPromotionError(result.error || 'UTM link could not be created.');
      return;
    }
    updateData((current) => ({ ...current, promotions: current.promotions.map((item) => item.id === promotion.id ? result.promotion! : item) }));
    setUtmForm(createEmptyUtmForm());
    setPromotionError(null);
  }

  function saveGrowthGoal() {
    const verifiedCurrent = growthGoalForm.metric === 'Monthly Website Users' ? verifiedMonthlyUsers : growthGoalForm.metric === 'Organic Search Users' ? verifiedOrganicUsers : growthGoalForm.metric === 'Returning Visitors' ? verifiedReturningReaders : null;
    const result = createGrowthGoal({ goalName: growthGoalForm.goalName, metric: growthGoalForm.metric, currentVerifiedValue: verifiedCurrent, targetValue: Number(growthGoalForm.targetValue), startDate: growthGoalForm.startDate, targetDate: growthGoalForm.targetDate, ownerId: actor.staffId, ownerName: growthGoalForm.ownerName || actor.name, status: growthGoalForm.status, notes: growthGoalForm.notes }, actor);
    if (result.error || !result.goal) {
      setPromotionError(result.error || 'Growth goal could not be created.');
      return;
    }
    updateData((current) => ({ ...current, growthGoals: [result.goal!, ...current.growthGoals] }));
    setGrowthGoalForm(createEmptyGrowthGoalForm());
    setPromotionError(null);
  }

  function saveCalendarItem() {
    const promotion = data.promotions.find((item) => item.id === calendarForm.promotionId);
    if (!promotion) {
      setPromotionError('Select a promotion before adding a calendar item.');
      return;
    }
    const next = addPromotionCalendarItem(promotion, { type: calendarForm.type, date: calendarForm.date, channel: calendarForm.channel, notes: calendarForm.notes }, actor);
    updateData((current) => ({ ...current, promotions: current.promotions.map((item) => item.id === promotion.id ? next : item) }));
    setCalendarForm(createEmptyCalendarForm());
    setPromotionError(null);
  }

  function saveManualPromotionActivity() {
    const promotion = data.promotions.find((item) => item.id === manualActivityForm.promotionId);
    if (!promotion) {
      setPromotionError('Select a promotion before logging activity.');
      return;
    }
    const next = logPromotionChannelActivity(promotion, manualActivityForm, actor);
    updateData((current) => ({ ...current, promotions: current.promotions.map((item) => item.id === promotion.id ? next : item) }));
    setManualActivityForm(createEmptyManualActivityForm());
    setPromotionError(null);
  }

  function updateContentQueueStatus(articleId: string, status: MarketingData['contentQueue'][number]['promotionStatus']) {
    updateData((current) => ({ ...current, contentQueue: current.contentQueue.map((item) => item.articleId === articleId ? { ...item, promotionStatus: status, dismissedAt: status === 'Dismissed' ? new Date().toISOString() : item.dismissedAt, updatedAt: new Date().toISOString() } : item) }));
  }

  function createReportForDeal(deal: MarketingDeal) {
    const proposal = data.proposals.find((item) => item.id === deal.proposalId);
    const handoff = data.handoffs.find((item) => item.dealId === deal.id);
    const result = createCampaignReport({ reportType: 'Advertiser Campaign', advertiserId: deal.advertiserId, deal, proposal, handoff, metrics: createEmptyPerformanceMetrics('Not Connected'), campaignNotes: 'Verified ad delivery metrics are not connected yet.' }, actor);
    if (result.error || !result.report) {
      setPerformanceError(result.error || 'Campaign report could not be created.');
      return;
    }
    updateData((current) => ({ ...current, campaignReports: [result.report!, ...current.campaignReports] }));
    setActiveSection('performance');
    setPerformanceError(null);
  }

  function createReportForPromotion(promotion: MarketingPromotion) {
    const result = createCampaignReport({ reportType: 'Promotion Campaign', promotion, metrics: createEmptyPerformanceMetrics('Not Connected'), campaignNotes: 'UTM links exist, but verified promotion attribution is not connected yet.' }, actor);
    if (result.error || !result.report) {
      setPerformanceError(result.error || 'Promotion report could not be created.');
      return;
    }
    updateData((current) => ({ ...current, campaignReports: [result.report!, ...current.campaignReports] }));
    setActiveSection('performance');
    setPerformanceError(null);
  }

  function setCampaignReportStatus(reportId: string, status: CampaignReportStatus) {
    updateData((current) => ({ ...current, campaignReports: current.campaignReports.map((report) => {
      if (report.id !== reportId) return report;
      const result = changeCampaignReportStatus(report, status, actor, new Date().toISOString(), { requireApproval: current.settings.requireCampaignReportApproval });
      if (result.error) setPerformanceError(result.error);
      else setPerformanceError(null);
      return result.report || report;
    }) }));
  }

  function archiveCampaignReportById(reportId: string) {
    updateData((current) => ({ ...current, campaignReports: current.campaignReports.map((report) => {
      if (report.id !== reportId) return report;
      const result = archiveCampaignReport(report, actor);
      if (result.error) setPerformanceError(result.error);
      else setPerformanceError(null);
      return result.report || report;
    }) }));
  }

  function createRenewalForDeal(deal: MarketingDeal) {
    const existing = data.renewals.find((renewal) => renewal.previousDealId === deal.id && !renewal.archivedAt);
    if (existing) {
      setActiveSection('renewals');
      setRenewalError('A renewal opportunity already exists for this deal.');
      return;
    }
    const proposal = data.proposals.find((item) => item.id === deal.proposalId);
    const result = createRenewal({ advertiserId: deal.advertiserId, previousDeal: deal, previousProposal: proposal, previousCampaignValue: deal.agreedValue, campaignEndDate: deal.campaignEnd, suggestedFollowUpDate: addDays(deal.campaignEnd, data.settings.defaultRenewalFollowUpOffsetDays), ownerId: deal.salesOwnerId || actor.staffId, ownerName: deal.salesOwnerName || actor.name }, actor);
    if (result.error || !result.renewal) {
      setRenewalError(result.error || 'Renewal opportunity could not be created.');
      return;
    }
    updateData((current) => ({ ...current, renewals: [result.renewal!, ...current.renewals] }));
    setActiveSection('renewals');
    setRenewalError(null);
  }

  function setRenewalStatusById(renewalId: string, status: RenewalStatus) {
    updateData((current) => ({ ...current, renewals: current.renewals.map((renewal) => {
      if (renewal.id !== renewalId) return renewal;
      const result = changeRenewalStatus(renewal, status, actor);
      if (result.error) setRenewalError(result.error);
      else setRenewalError(null);
      return result.renewal || renewal;
    }) }));
  }

  function archiveRenewalById(renewalId: string) {
    updateData((current) => ({ ...current, renewals: current.renewals.map((renewal) => {
      if (renewal.id !== renewalId) return renewal;
      const result = archiveRenewal(renewal, actor);
      if (result.error) setRenewalError(result.error);
      else setRenewalError(null);
      return result.renewal || renewal;
    }) }));
  }

  function scheduleRenewalFollowUpById(renewalId: string) {
    const renewal = data.renewals.find((item) => item.id === renewalId);
    const advertiser = data.advertisers.find((item) => item.id === renewal?.advertiserId);
    if (!renewal || !advertiser) return;
    const result = scheduleRenewalFollowUp(advertiser, renewal, actor);
    updateData((current) => ({ ...current, advertisers: current.advertisers.map((item) => item.id === advertiser.id ? result.advertiser : item), followUps: [result.followUp, ...current.followUps] }));
    setRenewalError(null);
  }

  function createRenewalProposalById(renewalId: string) {
    const renewal = data.renewals.find((item) => item.id === renewalId);
    const previousProposal = data.proposals.find((item) => item.id === renewal?.previousProposalId);
    if (!renewal) return;
    const result = createProposalDraftFromRenewal(renewal, previousProposal, true, data.rateCards);
    if (result.error || !result.proposal) {
      setRenewalError(result.error || 'Renewal proposal could not be created.');
      return;
    }
    updateData((current) => ({ ...current, proposals: [result.proposal!, ...current.proposals], renewals: current.renewals.map((item) => item.id === renewal.id ? (changeRenewalStatus(item, 'Proposal', actor).renewal || item) : item) }));
    setActiveSection('proposals');
    setRenewalError(null);
  }

  function renderOverview() {
    const summaryCards: Array<[string, string | number]> = [
      ['Active Promotions', activePromotions],
      ['Promotions Planned', plannedPromotions],
      ['Growth Goals', activeGrowthGoals],
      ['Advertiser Leads', data.advertisers.filter((advertiser) => advertiser.stage !== 'won' && advertiser.stage !== 'lost').length],
      ['Follow-ups Due', dueFollowUps],
      ['Open Proposals', openProposals],
      ['Negotiations', negotiations],
      ['Won Deals', wonDeals],
      ['Active Partnerships', activePartnerships],
    ];
    if (audienceState.status === 'connected') {
      if (verifiedMonthlyUsers != null) summaryCards.push(['Monthly Users', verifiedMonthlyUsers.toLocaleString()]);
      if (verifiedOrganicUsers != null) summaryCards.push(['Organic Search', verifiedOrganicUsers.toLocaleString()]);
      if (verifiedReturningReaders != null) summaryCards.push(['Returning Readers', verifiedReturningReaders.toLocaleString()]);
    }
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</div></div>)}
        </div>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Today's Marketing Work</h2><p className="text-sm text-slate-600 dark:text-slate-300">Generated only from saved promotions, follow-ups, proposals, goals and scheduled activities.</p></div></div>
          {todayWork.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">No marketing work scheduled for today.</div> : <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">{todayWork.map((item, index) => <div key={`${item.label}-${index}`} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{item.label}</div><div className="mt-1 text-slate-600 dark:text-slate-300">{item.detail}</div></div>)}</div>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Marketing Activity</h2><p className="text-sm text-slate-600 dark:text-slate-300">Real user-entered marketing updates only.</p></div><button type="button" onClick={openAdvertiserForm} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">+ Add Advertiser</button></div>
          {activities.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">No active marketing activity yet.</div> : <div className="mt-5 space-y-3">{activities.slice(0, 10).map((activity) => <div key={activity.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"><div className="font-semibold text-slate-900 dark:text-white">{activity.message}</div><div className="mt-1 text-slate-600 dark:text-slate-300">{activity.advertiserName} · {activity.actor} ({activity.staffId})</div><div className="mt-1 text-xs text-slate-500">{formatDate(activity.createdAt)}</div></div>)}</div>}
        </section>
      </div>
    );
  }

  function renderAdvertiserForm() {
    if (!formOpen) return null;
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/40">
        <div className="flex items-center justify-between"><h3 className="text-base font-semibold text-slate-950 dark:text-white">Add Advertiser</h3><button type="button" onClick={() => setFormOpen(false)} aria-label="Close advertiser form"><X className="h-4 w-4" /></button></div>
        <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <fieldset className="space-y-3 rounded-lg bg-white p-4 dark:bg-slate-900"><legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Company Information</legend><TextInput label="Company Name" required value={form.companyName} error={formErrors.companyName} onChange={(value) => updateFormField('companyName', value)} /><TextInput label="Industry" required value={form.industry} error={formErrors.industry} onChange={(value) => updateFormField('industry', value)} /><TextInput label="Website" value={form.website} error={formErrors.website} onChange={(value) => updateFormField('website', value)} placeholder="https://" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><TextInput label="City" value={form.city} onChange={(value) => updateFormField('city', value)} /><TextInput label="State" value={form.state} onChange={(value) => updateFormField('state', value)} /></div></fieldset>
          <fieldset className="space-y-3 rounded-lg bg-white p-4 dark:bg-slate-900"><legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Primary Contact</legend><TextInput label="Contact Person" required value={form.contactPerson} error={formErrors.contactPerson} onChange={(value) => updateFormField('contactPerson', value)} /><TextInput label="Designation" value={form.designation} onChange={(value) => updateFormField('designation', value)} /><TextInput label="Email" required type="email" value={form.email} error={formErrors.email} onChange={(value) => updateFormField('email', value)} /><TextInput label="Phone" value={form.phone} onChange={(value) => updateFormField('phone', value)} /></fieldset>
          <fieldset className="space-y-3 rounded-lg bg-white p-4 dark:bg-slate-900"><legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Opportunity</legend><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Interested In</div><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{INTEREST_OPTIONS.map((option) => <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-800"><input type="checkbox" checked={form.interests.includes(option)} onChange={() => toggleFormArray('interests', option)} />{option}</label>)}</div></div><TextInput label="Target Region" value={form.targetRegion} onChange={(value) => updateFormField('targetRegion', value)} /><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Target Languages</div><div className="mt-2 flex flex-wrap gap-2">{LANGUAGE_OPTIONS.map((option) => <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-800"><input type="checkbox" checked={form.targetLanguages.includes(option)} onChange={() => toggleFormArray('targetLanguages', option)} />{option}</label>)}</div></div><TextInput label="Estimated Budget" value={form.estimatedBudget} error={formErrors.estimatedBudget} onChange={(value) => updateFormField('estimatedBudget', value)} /><SelectInput label="Lead Source" value={form.leadSource} onChange={(value) => updateFormField('leadSource', value)} options={LEAD_SOURCE_OPTIONS} /><SelectInput label="Sales Owner" value={form.salesOwnerId} onChange={(value) => { const owner = staffOptions.find((staff) => staff.id === value); updateFormField('salesOwnerId', owner?.id || ''); updateFormField('salesOwnerName', owner?.name || ''); }} options={staffOptions.map((staff) => staff.id)} /><label className="block"><span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Notes</span><textarea value={form.notes} onChange={(event) => updateFormField('notes', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label></fieldset>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-100">Cancel</button><button type="button" onClick={saveAdvertiser} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save Advertiser</button></div>
      </div>
    );
  }

  function renderAdvertisers() {
    const industries = Array.from(new Set(data.advertisers.map((advertiser) => advertiser.industry).filter(Boolean)));
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-semibold text-slate-950 dark:text-white">Corporate Advertisers</h2><p className="text-sm text-slate-600 dark:text-slate-300">Relationship pipeline before Ads Manager campaign delivery.</p></div><button type="button" onClick={openAdvertiserForm} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Advertiser</button></div>
        {renderAdvertiserForm()}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search advertisers..." className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><select value={filters.industry} onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">All Industries</option>{industries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}</select><select value={filters.leadSource} onChange={(event) => setFilters((current) => ({ ...current, leadSource: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">All Lead Sources</option>{LEAD_SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}</select><select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as AdvertiserFilters['sort'] }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="next_follow_up">Next Follow-up</option><option value="estimated_budget">Estimated Budget</option><option value="last_contact">Last Contact</option></select></div>
          <div className="mt-3 flex flex-wrap gap-2">{PIPELINE_FILTERS.map((filter) => <button key={filter.key} type="button" onClick={() => setFilters((current) => ({ ...current, stage: filter.key }))} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filters.stage === filter.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{filter.label}</button>)}</div>
          {stageError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{stageError}</div> : null}
          {pendingLostId ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="text-sm font-semibold text-amber-950">Lost Reason required</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={lostReason} onChange={(event) => setLostReason(event.target.value as LostReason)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"><option value="">Select Lost Reason</option>{LOST_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select><button type="button" onClick={confirmLost} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white">Confirm Lost</button><button type="button" onClick={() => setPendingLostId(null)} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900">Cancel</button></div></div> : null}
          {data.advertisers.length === 0 ? <div className="mt-5"><EmptyState title="No advertisers yet." message="Add your first advertiser or create a lead from an advertising enquiry." action={<button type="button" onClick={openAdvertiserForm} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">+ Add Advertiser</button>} /></div> : <div className="mt-5 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{['Company', 'Primary Contact', 'Industry', 'Opportunity', 'Estimated Budget', 'Pipeline Stage', 'Sales Owner', 'Last Contact', 'Next Follow-up', 'Lead Source', 'Created Date', ''].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{filteredAdvertisers.map((advertiser) => <tr key={advertiser.id} className="align-top"><td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{advertiser.companyName}</td><td className="px-3 py-3"><div>{advertiser.contactPerson}</div><div className="text-xs text-slate-500">{advertiser.email}</div></td><td className="px-3 py-3">{advertiser.industry}</td><td className="px-3 py-3">{advertiser.interests.join(', ') || '-'}</td><td className="px-3 py-3">{advertiser.estimatedBudget || '0'}</td><td className="px-3 py-3"><select value={advertiser.stage} onChange={(event) => requestStage(advertiser.id, event.target.value as AdvertiserStage)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">{ADVERTISER_STAGES.map((stage) => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></td><td className="px-3 py-3">{advertiser.salesOwnerName || '-'}</td><td className="px-3 py-3 text-xs text-slate-500">{formatDate(advertiser.lastContactAt)}</td><td className="px-3 py-3 text-xs text-slate-500">{formatDate(advertiser.nextFollowUpAt)}</td><td className="px-3 py-3">{advertiser.leadSource || '-'}</td><td className="px-3 py-3 text-xs text-slate-500">{formatDate(advertiser.createdAt)}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => { setSelectedAdvertiserId(advertiser.id); setDrawerSection('overview'); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-100">Open</button></td></tr>)}</tbody></table></div>}
        </div>
      </div>
    );
  }

  function renderFollowUps() {
    const groups = [{ key: 'due', title: 'Due Today' }, { key: 'scheduled', title: 'Upcoming' }, { key: 'overdue', title: 'Overdue' }, { key: 'completed', title: 'Completed' }] as const;
    return <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">{groups.map((group) => { const rows = data.followUps.filter((followUp) => followUpComputedStatus(followUp) === group.key); return <section key={group.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold text-slate-950 dark:text-white">{group.title}</h2>{rows.length === 0 ? <p className="mt-4 text-sm text-slate-500">No follow-ups scheduled.</p> : <div className="mt-4 space-y-3">{rows.map((followUp) => { const advertiser = data.advertisers.find((item) => item.id === followUp.advertiserId); return <div key={followUp.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="font-semibold">{advertiser?.companyName || 'Advertiser'}</div><div>{followUp.type}</div><div className="mt-1 text-xs text-slate-500">Due: {followUp.date} {followUp.time}</div><div className="text-xs text-slate-500">Assigned: {followUp.assignedStaffName}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => advertiser && setSelectedAdvertiserId(advertiser.id)} className="rounded border px-2 py-1 text-xs">Open Advertiser</button>{group.key !== 'completed' ? <><select value={completeOutcome} onChange={(event) => setCompleteOutcome(event.target.value as FollowUpOutcome)} className="rounded border px-2 py-1 text-xs"><option value="">Outcome</option>{FOLLOW_UP_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcome}</option>)}</select><button type="button" onClick={() => completeFollowUpById(followUp.id)} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Complete</button></> : null}</div></div>; })}</div>}</section>; })}</div>;
  }

  function renderProposals() {
    const selectedRate = data.rateCards.find((rate) => rate.productName === proposalForm.product);
    return <div className="space-y-5"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Proposals</h2><p className="text-sm text-slate-600 dark:text-slate-300">Pricing comes from internal rate card when configured; otherwise staff can enter values manually.</p></div><button type="button" onClick={createProposalFromForm} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">+ Create Proposal</button></div><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4"><select value={proposalForm.advertiserId || selectedAdvertiser?.id || ''} onChange={(event) => setProposalForm((current) => ({ ...current, advertiserId: event.target.value }))} className="rounded-lg border px-3 py-2 text-sm"><option value="">Advertiser</option>{data.advertisers.map((advertiser) => <option key={advertiser.id} value={advertiser.id}>{advertiser.companyName}</option>)}</select><TextInput label="Proposal Title" value={proposalForm.title} onChange={(value) => setProposalForm((current) => ({ ...current, title: value }))} /><TextInput label="Campaign Objective" value={proposalForm.objective} onChange={(value) => setProposalForm((current) => ({ ...current, objective: value }))} /><SelectInput label="Product" value={proposalForm.product} onChange={(value) => { const rate = data.rateCards.find((item) => item.productName === value); setProposalForm((current) => ({ ...current, product: value, listPrice: rate?.listPrice || current.listPrice, finalPrice: rate?.listPrice || current.finalPrice })); }} options={PROPOSAL_PRODUCT_OPTIONS} /><TextInput label="Start Date" type="date" value={proposalForm.startDate} onChange={(value) => setProposalForm((current) => ({ ...current, startDate: value }))} /><TextInput label="End Date" type="date" value={proposalForm.endDate} onChange={(value) => setProposalForm((current) => ({ ...current, endDate: value }))} /><TextInput label="Valid Until" type="date" value={proposalForm.validUntil} onChange={(value) => setProposalForm((current) => ({ ...current, validUntil: value }))} /><TextInput label="List Price" value={proposalForm.listPrice || selectedRate?.listPrice || ''} onChange={(value) => setProposalForm((current) => ({ ...current, listPrice: value }))} /><TextInput label="Final Price" value={proposalForm.finalPrice} onChange={(value) => setProposalForm((current) => ({ ...current, finalPrice: value }))} /></div>{proposalNeedsDiscountApproval([{ id: 'preview', product: proposalForm.product, description: '', quantity: '1', listPrice: proposalForm.listPrice || selectedRate?.listPrice || '', discount: '', finalPrice: proposalForm.finalPrice || proposalForm.listPrice, notes: '', rateCardId: selectedRate?.id }], data.rateCards) ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Founder approval required.</div> : null}</section>{data.proposals.length === 0 ? <EmptyState title="No proposals yet." message="Create a proposal from a real advertiser record." /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{data.proposals.map((proposal) => { const advertiser = data.advertisers.find((item) => item.id === proposal.advertiserId); const totals = calculateProposalTotals(proposal.items, proposal.taxRate); return <section key={proposal.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-blue-700">{proposal.proposalId}</div><h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{proposal.title}</h3><p className="text-sm text-slate-600 dark:text-slate-300">Prepared For: {advertiser?.companyName || 'Advertiser'}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{proposal.status.replace(/_/g, ' ')}</span></div><div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800"><div className="text-lg font-bold">News Pulse</div><div className="text-xs text-slate-500">Your pulse on what matters most.</div><div className="mt-3 font-semibold">Recommended Advertising Package</div><div>{proposal.items.map((item) => item.product).join(', ')}</div><div className="mt-2">Grand Total: INR {formatInrFromCents(totals.grandTotalCents)}</div><div>Validity: {proposal.validUntil}</div></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => approveProposalById(proposal.id)} className="rounded border px-3 py-1.5 text-xs font-semibold">Approve</button><button type="button" onClick={() => markSentById(proposal.id)} className="rounded border px-3 py-1.5 text-xs font-semibold">Mark as Sent</button><button type="button" onClick={() => acceptProposalById(proposal.id)} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Mark Accepted</button></div></section>; })}</div>}</div>;
  }

  function renderPartnerships() {
    return <div className="space-y-5"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Partnerships</h2><button type="button" onClick={createPartnershipFromForm} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Create Partnership</button></div><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4"><TextInput label="Organization" value={partnershipForm.organization} onChange={(value) => setPartnershipForm((current) => ({ ...current, organization: value }))} /><SelectInput label="Partnership Type" value={partnershipForm.partnershipType} onChange={(value) => setPartnershipForm((current) => ({ ...current, partnershipType: value as PartnershipType }))} options={PARTNERSHIP_TYPES} /><TextInput label="Contact Person" value={partnershipForm.contactPerson} onChange={(value) => setPartnershipForm((current) => ({ ...current, contactPerson: value }))} /><TextInput label="Estimated Value" value={partnershipForm.estimatedValue} onChange={(value) => setPartnershipForm((current) => ({ ...current, estimatedValue: value }))} /><TextInput label="Email" value={partnershipForm.email} onChange={(value) => setPartnershipForm((current) => ({ ...current, email: value }))} /><TextInput label="Phone" value={partnershipForm.phone} onChange={(value) => setPartnershipForm((current) => ({ ...current, phone: value }))} /><TextInput label="Start Date" type="date" value={partnershipForm.startDate} onChange={(value) => setPartnershipForm((current) => ({ ...current, startDate: value }))} /><TextInput label="End Date" type="date" value={partnershipForm.endDate} onChange={(value) => setPartnershipForm((current) => ({ ...current, endDate: value }))} /></div><label className="mt-3 block"><span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Opportunity</span><textarea value={partnershipForm.opportunity} onChange={(event) => setPartnershipForm((current) => ({ ...current, opportunity: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label></section>{data.partnerships.length === 0 ? <EmptyState title="No partnerships yet." message="Partnership records will appear after they are created." /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{data.partnerships.map((partnership) => <section key={partnership.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><Handshake className="mt-1 h-5 w-5 text-blue-600" /><div><h3 className="font-semibold text-slate-950">{partnership.organization}</h3><p className="text-sm text-slate-600">{partnership.partnershipType} · {partnership.status}</p><p className="mt-2 text-sm text-slate-700">{partnership.opportunity || 'No opportunity details yet.'}</p></div></div></section>)}</div>}</div>;
  }

  function renderMediaKit() {
    return <div className="space-y-5"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Internal Rate Card</h2><p className="text-sm text-slate-600 dark:text-slate-300">Internal minimum pricing is not public and only feeds proposal safeguards.</p></div><button type="button" onClick={saveRateCard} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save Rate</button></div><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4"><TextInput label="Product Name" value={rateForm.productName} onChange={(value) => setRateForm((current) => ({ ...current, productName: value }))} /><TextInput label="Placement" value={rateForm.placement} onChange={(value) => setRateForm((current) => ({ ...current, placement: value }))} /><SelectInput label="Billing Model" value={rateForm.billingModel} onChange={(value) => setRateForm((current) => ({ ...current, billingModel: value as RateCardBillingModel }))} options={RATE_CARD_BILLING_MODELS} /><TextInput label="List Price" value={rateForm.listPrice} onChange={(value) => setRateForm((current) => ({ ...current, listPrice: value }))} /><TextInput label="Minimum Price" value={rateForm.minimumPrice} onChange={(value) => setRateForm((current) => ({ ...current, minimumPrice: value }))} /><TextInput label="Maximum Staff Discount" value={rateForm.maximumStaffDiscount} onChange={(value) => setRateForm((current) => ({ ...current, maximumStaffDiscount: value }))} /><TextInput label="Description" value={rateForm.description} onChange={(value) => setRateForm((current) => ({ ...current, description: value }))} /></div></section>{data.rateCards.length === 0 ? <EmptyState title="No rate card has been configured." message="Proposal pricing can be entered manually until internal rates are configured." /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">{data.rateCards.map((rate) => <section key={rate.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="font-semibold text-slate-950">{rate.productName}</div><div className="text-sm text-slate-600">{rate.placement} · {rate.billingModel}</div><div className="mt-2 text-sm">List: INR {rate.listPrice || '0'} · Minimum: INR {rate.minimumPrice || '0'}</div><div className="text-sm">Max Staff Discount: {rate.maximumStaffDiscount || '0'}%</div></section>)}</div>}</div>;
  }

  function renderAudience() {
    const dashboard = audienceState.dashboard;
    const summary = [
      ['Total Users', dashboardTotalsValue(dashboard, ['users', 'totalUsers', 'uniqueReaders', 'readers'])],
      ['New Users', dashboardTotalsValue(dashboard, ['newUsers', 'newReaders'])],
      ['Returning Users', dashboardTotalsValue(dashboard, ['returningUsers', 'returningReaders'])],
      ['Sessions', dashboardTotalsValue(dashboard, ['sessions'])],
      ['Page Views', dashboardTotalsValue(dashboard, ['pageViews', 'views', 'totalViews'])],
      ['Engagement', dashboardTotalsValue(dashboard, ['engagement', 'engagedReads', 'completionRate'])],
      ['Organic Search Users', verifiedOrganicUsers],
      ['Referral Users', findSourceMetric(dashboard, /referral|partner/i)],
    ];
    const languages = ['English', 'Hindi', 'Gujarati'];
    const languageRows = Array.isArray((dashboard as any)?.languages) ? (dashboard as any).languages : [];
    const sources = Array.isArray((dashboard as any)?.sources) ? (dashboard as any).sources : [];
    const channels = ['Organic Search', 'Google News', 'Google Discover', 'Direct', 'Referral', 'Social', 'Email', 'Campaign', 'Other'];

    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-2xl font-bold text-slate-950 dark:text-white">Audience Growth</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Understand how readers discover News Pulse and plan sustainable growth across English, Hindi and Gujarati audiences.</p></div><select value={audienceRange} onChange={(event) => setAudienceRange(event.target.value as AudienceRange)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="today">Today</option><option value="7d">7 Days</option><option value="30d">30 Days</option><option value="90d">90 Days</option><option value="custom">Custom</option></select></div>
          {audienceState.status === 'loading' ? <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">Loading verified analytics...</div> : null}
          {audienceState.status !== 'connected' ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Connect verified analytics sources to display real audience performance.</div> : null}
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{displayMetric(value)}</div></div>)}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Data Source</h3><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">{[['Traffic Analytics', audienceState.status === 'connected' ? 'Connected' : 'Not Connected'], ['Search Performance', verifiedOrganicUsers != null ? 'Connected' : 'Not Connected'], ['Campaign Attribution', 'Not Connected']].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{label}</div><div className="mt-1 text-slate-600 dark:text-slate-300">{value}</div></div>)}</div><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Connect verified analytics sources to display real audience performance.</p></section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Audience by Language</h3><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">{languages.map((language) => { const row = languageRows.find((item: any) => String(item?.language || '').toLowerCase().includes(language.toLowerCase().slice(0, 2))); return <div key={language} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{language}</div><div className="mt-3 grid grid-cols-2 gap-2 text-sm">{[['Users', row?.readers ?? row?.users], ['Sessions', row?.sessions], ['Page Views', row?.views ?? row?.pageViews], ['Growth %', row?.growthPct], ['Engagement', row?.engagement ?? row?.engagedReads]].map(([label, value]) => <div key={label}><div className="text-xs uppercase text-slate-500">{label}</div><div className="font-semibold">{displayMetric(value)}</div></div>)}</div></div>; })}</div></section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Audience by Content Section</h3>{audienceState.categories.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Not Connected</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{['Section', 'Users', 'Page Views', 'Engagement', 'Traffic Share'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{ARTICLE_CATEGORY_OPTIONS.map((option) => { const row = audienceState.categories.find((item) => String(item.category).toLowerCase() === option.key || String(item.category).toLowerCase() === option.label.toLowerCase()); return <tr key={option.key}><td className="px-3 py-3 font-semibold">{option.label}</td><td className="px-3 py-3">{displayMetric(row?.readers ?? row?.uniqueReaders)}</td><td className="px-3 py-3">{displayMetric(row?.views)}</td><td className="px-3 py-3">{displayMetric(row?.engagedReads ?? row?.completionRate)}</td><td className="px-3 py-3">Not Connected</td></tr>; })}</tbody></table></div>}</section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">How Readers Find News Pulse</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{['Channel', 'Status', 'Users', 'Sessions', 'Share', 'Change vs previous period'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{channels.map((channel) => { const pattern = audienceChannelPattern(channel); const row = sources.find((source: any) => pattern.test(String(source?.source || ''))); return <tr key={channel}><td className="px-3 py-3 font-semibold">{channel}</td><td className="px-3 py-3">{row ? 'Connected' : 'Not Connected'}</td><td className="px-3 py-3">{displayMetric(row?.readers ?? row?.users)}</td><td className="px-3 py-3">{displayMetric(row?.sessions)}</td><td className="px-3 py-3">{displayMetric(row?.share)}</td><td className="px-3 py-3">{displayMetric(row?.changePct)}</td></tr>; })}</tbody></table></div></section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><Target className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Growth Goals</h3></div><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4"><TextInput label="Goal Name" value={growthGoalForm.goalName} onChange={(value) => setGrowthGoalForm((current) => ({ ...current, goalName: value }))} /><SelectInput label="Metric" value={growthGoalForm.metric} onChange={(value) => setGrowthGoalForm((current) => ({ ...current, metric: value as MarketingGrowthGoal['metric'] }))} options={GROWTH_GOAL_METRICS} /><TextInput label="Target Value" value={growthGoalForm.targetValue} onChange={(value) => setGrowthGoalForm((current) => ({ ...current, targetValue: value }))} /><SelectInput label="Status" value={growthGoalForm.status} onChange={(value) => setGrowthGoalForm((current) => ({ ...current, status: value as MarketingGrowthGoal['status'] }))} options={GROWTH_GOAL_STATUSES} /><TextInput label="Start Date" type="date" value={growthGoalForm.startDate} onChange={(value) => setGrowthGoalForm((current) => ({ ...current, startDate: value }))} /><TextInput label="Target Date" type="date" value={growthGoalForm.targetDate} onChange={(value) => setGrowthGoalForm((current) => ({ ...current, targetDate: value }))} /><TextInput label="Owner" value={growthGoalForm.ownerName} onChange={(value) => setGrowthGoalForm((current) => ({ ...current, ownerName: value }))} /><TextInput label="Notes" value={growthGoalForm.notes} onChange={(value) => setGrowthGoalForm((current) => ({ ...current, notes: value }))} /></div><div className="mt-4 flex justify-end"><button type="button" onClick={saveGrowthGoal} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Create Growth Goal</button></div>{data.growthGoals.length === 0 ? <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">No growth goals configured.</p> : <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">{data.growthGoals.map((goal) => { const progress = calculateGrowthGoalProgress(goal); return <div key={goal.id} className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{goal.goalName}</div><div className="mt-2 grid grid-cols-2 gap-2"><div>Current: {progress.current == null ? 'Unavailable' : progress.current.toLocaleString()}</div><div>Target: {goal.targetValue.toLocaleString()}</div><div>Remaining: {progress.remaining == null ? 'Cannot calculate' : progress.remaining.toLocaleString()}</div><div>Progress: {progress.progressPct == null ? 'Cannot calculate' : `${progress.progressPct.toFixed(1)}%`}</div></div></div>; })}</div>}</section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold">Language Growth View</h3><div className="mt-3 space-y-2 text-sm">{languages.map((language) => <div key={language} className="rounded border border-slate-200 p-2 dark:border-slate-800"><div className="font-semibold">{language}</div><div>Audience Status: {languageRows.length ? 'Connected' : 'Not Connected'}</div><div>Promotion Campaigns: {data.promotions.filter((promotion) => promotion.primaryLanguage === language || promotion.primaryLanguage === 'All').length}</div><div>Promotion Links: {data.promotions.flatMap((promotion) => promotion.links).filter((link) => data.promotions.find((promotion) => promotion.id === link.promotionId)?.primaryLanguage === language).length}</div></div>)}</div></div><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold">Regional Growth</h3><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">India, Gujarat, other states and international breakdowns will appear only when verified geographic analytics are connected.</p><p className="mt-2 text-sm font-semibold">Not Connected</p></div><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold">Growth Opportunities</h3><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No verified growth opportunities available yet.</p></div></section>
      </div>
    );
  }

  function renderCampaigns() {
    return <div className="space-y-5">{data.deals.length === 0 ? <EmptyState title="No won deals ready for Ads Manager." message="Accepted proposals create deals that can be handed to Ads Manager as drafts." /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{data.deals.map((deal) => { const advertiser = data.advertisers.find((item) => item.id === deal.advertiserId); return <section key={deal.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h3 className="font-semibold text-slate-950">{advertiser?.companyName || 'Advertiser'} Deal</h3><p className="text-sm text-slate-600">Handoff Status: {deal.handoffStatus.replace(/_/g, ' ')}</p><p className="mt-2 text-sm">Agreed Value: INR {deal.agreedValue}</p></div><button type="button" onClick={() => sendDealToAdsManager(deal.id)} disabled={deal.handoffStatus === 'sent_to_ads_manager'} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300">Send to Ads Manager</button></div><div className="mt-3 text-xs text-slate-500">Marketing sends commercial draft data only. Ads Manager remains responsible for creative upload, placement configuration, activation and delivery.</div></section>; })}</div>}{data.handoffs.length > 0 ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-950">Ads Manager Handoffs</h2><div className="mt-3 space-y-2">{data.handoffs.map((handoff) => <div key={handoff.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="font-semibold">{handoff.campaignName}</div><div>Sent by {handoff.sentBy} at {formatDate(handoff.sentAt)}</div></div>)}</div></section> : null}</div>;
  }

  function renderPerformance() {
    const sources = Array.isArray((audienceState.dashboard as any)?.sources) ? (audienceState.dashboard as any).sources : [];
    const hasCampaignAttribution = sources.some((source: any) => /campaign|utm/i.test(String(source?.source || source?.medium || '')));
    const connectedReports = data.campaignReports.filter((report) => report.metrics.sourceStatus === 'Connected').length;
    const dataSources = [
      ['Traffic Analytics', audienceState.status === 'connected' ? 'Connected' : audienceState.status === 'loading' ? 'Partial' : 'Not Connected'],
      ['Ad Tracking', connectedReports > 0 ? 'Connected' : data.handoffs.length > 0 ? 'Partial' : 'Not Connected'],
      ['Campaign Attribution', hasCampaignAttribution ? 'Connected' : 'Not Connected'],
      ['Revenue Data', 'Not Connected'],
    ];
    const cards: Array<[string, string | number]> = [
      ['Active Advertiser Campaigns', activeAdvertiserCampaigns],
      ['Completed Advertiser Campaigns', completedAdvertiserCampaigns],
      ['Active Promotions', activePromotions],
      ['Completed Promotions', completedPromotions],
      ['Renewals Due', renewalDueToday],
      ['Reports Ready', reportsReady],
    ];
    const visibleReports = data.campaignReports.filter((report) => report.status !== 'Archived');

    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div><h2 className="text-2xl font-bold text-slate-950 dark:text-white">Marketing Performance</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Read-only performance workspace for advertiser campaign reports, promotion attribution and growth goal progress.</p></div>
            <select value={audienceRange} onChange={(event) => setAudienceRange(event.target.value as AudienceRange)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="today">Today</option><option value="7d">7 Days</option><option value="30d">30 Days</option><option value="90d">90 Days</option><option value="custom">Custom</option></select>
          </div>
          {performanceError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{performanceError}</div> : null}
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">No fake campaign results are shown. Missing impressions, clicks, revenue or UTM attribution remain Not Connected until verified sources provide them.</div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</div></div>)}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Data Sources</h3><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">{dataSources.map(([label, status]) => <div key={label} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{label}</div><div className="mt-1 text-slate-600 dark:text-slate-300">{status}</div></div>)}</div><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Revenue data is intentionally not displayed here. Deal values require explicit Marketing deal-value permission and finance remains in the finance/analytics modules.</p></section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Advertiser Campaign Performance</h3><p className="text-sm text-slate-600 dark:text-slate-300">Marketing can prepare reports from won deals and Ads Manager handoffs; delivery tracking remains read-only.</p></div></div>
          {data.deals.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No advertiser campaigns exist yet.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{['Advertiser', 'Campaign', 'Ads Manager Status', 'Impressions', 'Clicks', 'CTR', 'Report'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{data.deals.map((deal) => { const advertiser = data.advertisers.find((item) => item.id === deal.advertiserId); const handoff = data.handoffs.find((item) => item.dealId === deal.id); const report = data.campaignReports.find((item) => item.dealId === deal.id && item.status !== 'Archived'); const metrics = report?.metrics || createEmptyPerformanceMetrics('Not Connected'); return <tr key={deal.id}><td className="px-3 py-3 font-semibold">{advertiser?.companyName || 'Advertiser'}</td><td className="px-3 py-3">{handoff?.campaignName || deal.campaignObjective || 'Campaign'}</td><td className="px-3 py-3">{handoff ? mapAdsManagerCampaignStatus(handoff.status) : 'Not Connected'}</td><td className="px-3 py-3">{displayMetric(metrics.impressions)}</td><td className="px-3 py-3">{displayMetric(metrics.clicks)}</td><td className="px-3 py-3">{metrics.ctrPct == null ? 'Not Connected' : `${metrics.ctrPct.toFixed(2)}%`}</td><td className="px-3 py-3">{report ? report.status : <button type="button" onClick={() => createReportForDeal(deal)} className="rounded border px-2 py-1 text-xs font-semibold">Create Report</button>}</td></tr>; })}</tbody></table></div>}
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Campaign performance is not available yet when verified impression/click tracking is not connected.</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Campaign Reports</h3>{visibleReports.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No advertiser or promotion reports have been created yet.</p> : <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">{visibleReports.map((report: MarketingCampaignReport) => <div key={report.id} className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-blue-700">{report.reportType}</div><h4 className="mt-1 font-semibold text-slate-950 dark:text-white">{report.campaignName}</h4><div className="mt-1 text-slate-600 dark:text-slate-300">{report.campaignStart || '-'} to {report.campaignEnd || '-'}</div></div><select value={report.status} onChange={(event) => setCampaignReportStatus(report.id, event.target.value as CampaignReportStatus)} className="rounded border px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950">{CAMPAIGN_REPORT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div><div className="mt-3 grid grid-cols-3 gap-2"><div><div className="text-xs uppercase text-slate-500">Impressions</div><div className="font-semibold">{displayMetric(report.metrics.impressions)}</div></div><div><div className="text-xs uppercase text-slate-500">Clicks</div><div className="font-semibold">{displayMetric(report.metrics.clicks)}</div></div><div><div className="text-xs uppercase text-slate-500">CTR</div><div className="font-semibold">{report.metrics.ctrPct == null ? 'Not Connected' : `${report.metrics.ctrPct.toFixed(2)}%`}</div></div></div><div className="mt-3 rounded border border-slate-200 p-3 dark:border-slate-800"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advertiser Report Preview</div><p className="mt-2 text-slate-600 dark:text-slate-300">{report.summary || report.campaignNotes || 'Report summary is ready for staff notes after verified metrics are available.'}</p></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className="rounded border px-2 py-1 text-xs font-semibold">Print Preview</button><button type="button" onClick={() => archiveCampaignReportById(report.id)} className="rounded border px-2 py-1 text-xs font-semibold">Archive</button></div></div>)}</div>}</section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Promotion Performance</h3>{visiblePromotions.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No News Pulse promotion campaigns exist yet.</p> : <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">{visiblePromotions.map((promotion) => { const report = data.campaignReports.find((item) => item.promotionId === promotion.id && item.status !== 'Archived'); return <div key={promotion.id} className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{promotion.campaignName}</div><div className="mt-1 text-slate-600 dark:text-slate-300">{promotion.channels.join(', ') || 'No channels'} · {promotion.links.length} UTM links</div><div className="mt-3">Verified attribution: {report?.metrics.sourceStatus === 'Connected' ? 'Connected' : 'Not Connected'}</div><button type="button" onClick={() => createReportForPromotion(promotion)} className="mt-3 rounded border px-2 py-1 text-xs font-semibold">{report ? 'Create New Report' : 'Create Report'}</button></div>; })}</div>}</section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Growth Goal Performance</h3>{data.growthGoals.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No growth goals have been created.</p> : <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{data.growthGoals.map((goal) => { const progress = calculateGrowthGoalProgress(goal); return <div key={goal.id} className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{goal.goalName}</div><div className="mt-2 grid grid-cols-3 gap-2"><div><div className="text-xs uppercase text-slate-500">Current</div><div className="font-semibold">{displayMetric(progress.current)}</div></div><div><div className="text-xs uppercase text-slate-500">Target</div><div className="font-semibold">{displayMetric(progress.target)}</div></div><div><div className="text-xs uppercase text-slate-500">Progress</div><div className="font-semibold">{progress.progressPct == null ? 'Cannot calculate' : `${progress.progressPct.toFixed(1)}%`}</div></div></div></div>; })}</div>}</section>
      </div>
    );
  }

  function renderRenewals() {
    const today = todayDate();
    const upcoming7 = renewalRows.filter((renewal) => renewal.suggestedFollowUpDate > today && renewal.suggestedFollowUpDate <= addDays(today, 7)).length;
    const overdue = renewalRows.filter((renewal) => renewal.suggestedFollowUpDate < today && !['Renewed', 'Not Renewing', 'Paused'].includes(renewal.status)).length;
    const interested = renewalRows.filter((renewal) => renewal.status === 'Interested').length;
    const renewed = renewalRows.filter((renewal) => renewal.status === 'Renewed').length;
    const eligibleDeals = data.deals.filter((deal) => deal.status === 'won' || deal.status === 'handoff_ready' || deal.status === 'handoff_sent');

    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-2xl font-bold text-slate-950 dark:text-white">Renewals</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Track renewal opportunities after real won deals or campaign handoffs. Proposals created here copy package scope only, not old prices or tracking IDs.</p></div></div>{renewalError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{renewalError}</div> : null}</section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">{[['Due Today', renewalDueToday], ['Upcoming 7 Days', upcoming7], ['Upcoming 30 Days', renewalUpcoming30], ['Overdue', overdue], ['Interested', interested], ['Renewed', renewed]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</div></div>)}</section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Create Renewal from Won Campaign</h3>{eligibleDeals.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No completed or won advertiser campaign is available for renewal tracking.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{['Advertiser', 'Campaign Objective', 'End Date', 'Owner', 'Renewal'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{eligibleDeals.map((deal) => { const advertiser = data.advertisers.find((item) => item.id === deal.advertiserId); const renewal = data.renewals.find((item) => item.previousDealId === deal.id && !item.archivedAt); return <tr key={deal.id}><td className="px-3 py-3 font-semibold">{advertiser?.companyName || 'Advertiser'}</td><td className="px-3 py-3">{deal.campaignObjective || '-'}</td><td className="px-3 py-3">{deal.campaignEnd || '-'}</td><td className="px-3 py-3">{deal.salesOwnerName || '-'}</td><td className="px-3 py-3">{renewal ? renewal.status : <button type="button" onClick={() => createRenewalForDeal(deal)} className="rounded border px-2 py-1 text-xs font-semibold">Create Renewal</button>}</td></tr>; })}</tbody></table></div>}</section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Renewal Opportunities</h3>{renewalRows.length === 0 ? <EmptyState title="No renewals due." message="Create a renewal from a won campaign when an advertiser contract or campaign reaches its renewal window." /> : <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">{renewalRows.map((renewal) => { const advertiser = data.advertisers.find((item) => item.id === renewal.advertiserId); const previousProposal = data.proposals.find((item) => item.id === renewal.previousProposalId); return <div key={renewal.id} className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Renewal Opportunity</div><h4 className="mt-1 font-semibold text-slate-950 dark:text-white">{advertiser?.companyName || 'Advertiser'}</h4><div className="mt-1 text-slate-600 dark:text-slate-300">Campaign ended {renewal.campaignEndDate || '-'}</div></div><select value={renewal.status} onChange={(event) => setRenewalStatusById(renewal.id, event.target.value as RenewalStatus)} className="rounded border px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950">{RENEWAL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div><div className="mt-3 grid grid-cols-2 gap-2"><div><div className="text-xs uppercase text-slate-500">Follow-up Date</div><div className="font-semibold">{renewal.suggestedFollowUpDate || '-'}</div></div><div><div className="text-xs uppercase text-slate-500">Owner</div><div className="font-semibold">{renewal.ownerName || '-'}</div></div><div><div className="text-xs uppercase text-slate-500">Previous Package</div><div className="font-semibold">{previousProposal?.items.map((item) => proposalItemInventoryId(item)).join(', ') || '-'}</div></div><div><div className="text-xs uppercase text-slate-500">Performance</div><div className="font-semibold">Not Connected</div></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => scheduleRenewalFollowUpById(renewal.id)} className="rounded border px-2 py-1 text-xs font-semibold">Schedule Follow-up</button><button type="button" onClick={() => createRenewalProposalById(renewal.id)} className="rounded border px-2 py-1 text-xs font-semibold">Create Proposal</button><button type="button" onClick={() => archiveRenewalById(renewal.id)} className="rounded border px-2 py-1 text-xs font-semibold">Archive</button></div></div>; })}</div>}</section>
      </div>
    );
  }

  function renderPromotion() {
    const utmPreview = buildUtmUrl(utmForm.destinationUrl, { source: utmForm.source, medium: utmForm.medium, campaign: utmForm.campaign, content: utmForm.content, term: utmForm.term }, { allowExternal: utmForm.allowExternal });
    const calendarItems = visiblePromotions.flatMap((promotion) => [
      promotion.startDate ? { id: `${promotion.id}-start`, date: promotion.startDate, type: 'Campaign start', promotion } : null,
      promotion.endDate ? { id: `${promotion.id}-end`, date: promotion.endDate, type: 'Campaign end', promotion } : null,
      ...promotion.calendarItems.map((item) => ({ id: item.id, date: item.date, type: item.type, channel: item.channel, promotion })),
    ].filter(Boolean) as Array<{ id: string; date: string; type: string; channel?: string; promotion: MarketingPromotion }>).sort((a, b) => a.date.localeCompare(b.date));

    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-2xl font-bold text-slate-950 dark:text-white">Website Promotion</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Plan, organize and track News Pulse promotion campaigns across digital channels.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPromotionView('workspace')} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">+ Create Promotion</button><button type="button" onClick={() => setPromotionView('calendar')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><CalendarDays className="mr-1 inline h-4 w-4" /> Promotion Calendar</button><button type="button" onClick={() => setPromotionView('utm')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"><LinkIcon className="mr-1 inline h-4 w-4" /> UTM Builder</button></div></div>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Promotion sections">{(['workspace', 'calendar', 'utm', 'queue', 'channels'] as const).map((view) => <button key={view} type="button" role="tab" aria-selected={promotionView === view} onClick={() => setPromotionView(view)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${promotionView === view ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 text-slate-600'}`}>{view === 'utm' ? 'UTM Builder' : view === 'queue' ? 'Content Queue' : view[0].toUpperCase() + view.slice(1)}</button>)}</div>
          {promotionError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{promotionError}</div> : null}
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">Marketing Promotion is News Pulse promoting News Pulse. Advertiser campaign delivery remains in Ads Manager.</div>
        </section>

        {promotionView === 'workspace' ? <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Create Promotion</h3><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4"><TextInput label="Campaign Name" required value={promotionForm.campaignName} onChange={(value) => setPromotionForm((current) => ({ ...current, campaignName: value }))} /><SelectInput label="Objective" value={promotionForm.objective} onChange={(value) => setPromotionForm((current) => ({ ...current, objective: value as PromotionObjective }))} options={PROMOTION_OBJECTIVES} /><SelectInput label="Destination Type" value={promotionForm.destinationType} onChange={(value) => setPromotionForm((current) => ({ ...current, destinationType: value as PromotionDestinationType }))} options={PROMOTION_DESTINATION_TYPES} /><TextInput label="Destination URL" required value={promotionForm.destinationUrl} onChange={(value) => setPromotionForm((current) => ({ ...current, destinationUrl: value }))} /><SelectInput label="Primary Language" value={promotionForm.primaryLanguage} onChange={(value) => setPromotionForm((current) => ({ ...current, primaryLanguage: value as PromotionLanguage }))} options={PROMOTION_LANGUAGES} /><SelectInput label="Target Region" value={promotionForm.targetRegion} onChange={(value) => setPromotionForm((current) => ({ ...current, targetRegion: value as PromotionRegion }))} options={PROMOTION_REGIONS} /><TextInput label="Custom Region" value={promotionForm.customRegion} onChange={(value) => setPromotionForm((current) => ({ ...current, customRegion: value }))} /><SelectInput label="Priority" value={promotionForm.priority} onChange={(value) => setPromotionForm((current) => ({ ...current, priority: value as PromotionPriority }))} options={PROMOTION_PRIORITIES} /><TextInput label="Start Date" type="date" value={promotionForm.startDate} onChange={(value) => setPromotionForm((current) => ({ ...current, startDate: value }))} /><TextInput label="End Date" type="date" value={promotionForm.endDate} onChange={(value) => setPromotionForm((current) => ({ ...current, endDate: value }))} /><TextInput label="Owner" value={promotionForm.ownerName} onChange={(value) => setPromotionForm((current) => ({ ...current, ownerName: value }))} /><TextInput label="Notes" value={promotionForm.notes} onChange={(value) => setPromotionForm((current) => ({ ...current, notes: value }))} /></div><label className="mt-3 block"><span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Description</span><textarea value={promotionForm.description} onChange={(event) => setPromotionForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" rows={3} /></label><div className="mt-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Channels</div><div className="mt-2 flex flex-wrap gap-2">{PROMOTION_CHANNELS.map((channel) => <label key={channel} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-800"><input type="checkbox" checked={promotionForm.channels.includes(channel)} onChange={() => togglePromotionChannel(channel)} />{channel}</label>)}</div></div><div className="mt-4 flex justify-end"><button type="button" onClick={savePromotion} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save Campaign</button></div></section>
          {visiblePromotions.length === 0 ? <EmptyState title="No promotion campaigns yet." message="Create a News Pulse audience-growth campaign. No advertiser campaigns are shown here." /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{visiblePromotions.map((promotion) => <section key={promotion.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-blue-700">{promotion.objective}</div><h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{promotion.campaignName}</h3><p className="text-sm text-slate-600 dark:text-slate-300">{promotion.primaryLanguage} · {promotion.targetRegion} · {promotion.channels.join(', ') || 'No channels'}</p></div><select value={promotion.status} onChange={(event) => setPromotionStatus(promotion.id, event.target.value as PromotionStatus)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">{PROMOTION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div>Start: {promotion.startDate || '-'}</div><div>End: {promotion.endDate || '-'}</div><div>Links: {promotion.links.length}</div><div>Activity: {promotion.channelActivities.length}</div></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setPromotionView('utm'); setUtmForm((current) => ({ ...current, promotionId: promotion.id, destinationUrl: promotion.destinationUrl, campaign: promotion.campaignName })); }} className="rounded border px-2 py-1 text-xs font-semibold">Create UTM Link</button><button type="button" onClick={() => { setPromotionView('calendar'); setCalendarForm((current) => ({ ...current, promotionId: promotion.id })); }} className="rounded border px-2 py-1 text-xs font-semibold">Add to Calendar</button><button type="button" onClick={() => duplicatePromotionById(promotion.id)} className="rounded border px-2 py-1 text-xs font-semibold">Duplicate Promotion</button><button type="button" onClick={() => archivePromotionById(promotion.id)} className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800">Archive</button></div><div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">{promotion.activity.slice(0, 3).map((item) => <div key={item.id}>{formatDate(item.createdAt)} · {item.message}</div>)}</div></section>)}</div>}
        </> : null}

        {promotionView === 'utm' ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">UTM Builder</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create trackable News Pulse promotion links. URLs are not shortened or posted automatically.</p><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4"><SelectInput label="Promotion" value={utmForm.promotionId} onChange={(value) => { const promotion = data.promotions.find((item) => item.id === value); setUtmForm((current) => ({ ...current, promotionId: value, destinationUrl: promotion?.destinationUrl || current.destinationUrl, campaign: promotion?.campaignName || current.campaign })); }} options={visiblePromotions.map((promotion) => promotion.id)} /><SelectInput label="Preset" value={utmForm.presetId} onChange={applyUtmPreset} options={data.utmPresets.map((preset) => preset.id)} /><SelectInput label="Channel" value={utmForm.channel} onChange={(value) => setUtmForm((current) => ({ ...current, channel: value as PromotionChannel }))} options={PROMOTION_CHANNELS} /><TextInput label="Destination URL" required value={utmForm.destinationUrl} onChange={(value) => setUtmForm((current) => ({ ...current, destinationUrl: value }))} /><TextInput label="utm_source" required value={utmForm.source} onChange={(value) => setUtmForm((current) => ({ ...current, source: value }))} /><TextInput label="utm_medium" required value={utmForm.medium} onChange={(value) => setUtmForm((current) => ({ ...current, medium: value }))} /><TextInput label="utm_campaign" required value={utmForm.campaign} onChange={(value) => setUtmForm((current) => ({ ...current, campaign: value }))} /><TextInput label="utm_content" value={utmForm.content} onChange={(value) => setUtmForm((current) => ({ ...current, content: value }))} /><TextInput label="utm_term" value={utmForm.term} onChange={(value) => setUtmForm((current) => ({ ...current, term: value }))} /><label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"><input type="checkbox" checked={utmForm.allowExternal} onChange={(event) => setUtmForm((current) => ({ ...current, allowExternal: event.target.checked }))} /> External / Custom</label></div><div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview final URL</div><div className="mt-1 break-all font-mono text-xs">{utmPreview.url || utmPreview.error || 'Enter URL and UTM values.'}</div></div><div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => utmPreview.url && navigator.clipboard?.writeText(utmPreview.url)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Copy URL</button><button type="button" onClick={savePromotionLink} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save UTM Link</button></div></section> : null}

        {promotionView === 'calendar' ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Promotion Calendar</h3><div className="flex gap-2">{(['Month', 'Week', 'List'] as const).map((view) => <button key={view} type="button" onClick={() => setCalendarView(view)} className={`rounded border px-3 py-1 text-xs font-semibold ${calendarView === view ? 'bg-slate-950 text-white' : ''}`}>{view}</button>)}</div></div><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5"><SelectInput label="Promotion" value={calendarForm.promotionId} onChange={(value) => setCalendarForm((current) => ({ ...current, promotionId: value }))} options={visiblePromotions.map((promotion) => promotion.id)} /><SelectInput label="Type" value={calendarForm.type} onChange={(value) => setCalendarForm((current) => ({ ...current, type: value as CalendarFormState['type'] }))} options={PROMOTION_CALENDAR_ITEM_TYPES} /><TextInput label="Date" type="date" value={calendarForm.date} onChange={(value) => setCalendarForm((current) => ({ ...current, date: value }))} /><SelectInput label="Channel" value={calendarForm.channel} onChange={(value) => setCalendarForm((current) => ({ ...current, channel: value as PromotionChannel }))} options={PROMOTION_CHANNELS} /><TextInput label="Notes" value={calendarForm.notes} onChange={(value) => setCalendarForm((current) => ({ ...current, notes: value }))} /></div><div className="mt-4 flex justify-end"><button type="button" onClick={saveCalendarItem} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add Calendar Item</button></div>{calendarItems.length === 0 ? <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">No promotion calendar items yet.</p> : <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">{calendarItems.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{item.promotion.campaignName}</div><div>{item.type} · {item.date}</div><div>{item.channel || item.promotion.channels[0] || '-'}</div><div>{item.promotion.objective} · {item.promotion.primaryLanguage} · {item.promotion.ownerName || '-' } · {item.promotion.status}</div></div>)}</div>}</section> : null}

        {promotionView === 'queue' ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Content Promotion Queue</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Real News Pulse articles only. Article publication status is not changed here.</p>{contentQueueLoading ? <p className="mt-4 text-sm text-slate-600">Loading real articles...</p> : null}{contentQueueError ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{contentQueueError}</div> : null}{data.contentQueue.length === 0 ? <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">No content is currently queued for promotion.</p> : <div className="mt-5 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{['Headline', 'Category', 'Language', 'Published Date', 'Article URL', 'Promotion Status', 'Actions'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{data.contentQueue.filter((item) => item.promotionStatus !== 'Dismissed').map((item) => <tr key={item.id}><td className="px-3 py-3 font-semibold">{item.headline}</td><td className="px-3 py-3">{categoryLabel(item.category)}</td><td className="px-3 py-3">{item.language}</td><td className="px-3 py-3">{item.publishedDate || '-'}</td><td className="px-3 py-3">{item.articleUrl || '-'}</td><td className="px-3 py-3">{item.promotionStatus}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setPromotionView('workspace'); setPromotionForm((current) => ({ ...current, campaignName: item.headline, destinationType: 'Article', destinationUrl: item.articleUrl, primaryLanguage: PROMOTION_LANGUAGES.includes(item.language as PromotionLanguage) ? item.language as PromotionLanguage : 'All' })); updateContentQueueStatus(item.articleId, 'Promotion Planned'); }} className="rounded border px-2 py-1 text-xs">Create Promotion</button><button type="button" onClick={() => { setPromotionView('utm'); setUtmForm((current) => ({ ...current, destinationUrl: item.articleUrl, campaign: item.headline })); }} className="rounded border px-2 py-1 text-xs">Create UTM Link</button><button type="button" onClick={() => updateContentQueueStatus(item.articleId, 'Dismissed')} className="rounded border px-2 py-1 text-xs">Dismiss</button></div></td></tr>)}</tbody></table></div>}</section> : null}

        {promotionView === 'channels' ? <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Channels</h3><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{['Facebook', 'Instagram', 'X', 'YouTube', 'WhatsApp', 'Telegram', 'Email', 'Push'].map((channel) => <div key={channel} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="font-semibold text-slate-950 dark:text-white">{channel}</div><div className="mt-1 text-slate-600 dark:text-slate-300">Manual Only</div></div>)}</div><div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-800"><h4 className="font-semibold">Log Promotion Activity</h4><div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5"><SelectInput label="Promotion" value={manualActivityForm.promotionId} onChange={(value) => setManualActivityForm((current) => ({ ...current, promotionId: value }))} options={visiblePromotions.map((promotion) => promotion.id)} /><SelectInput label="Channel" value={manualActivityForm.channel} onChange={(value) => setManualActivityForm((current) => ({ ...current, channel: value as PromotionChannel }))} options={PROMOTION_CHANNELS} /><SelectInput label="Activity" value={manualActivityForm.activityType} onChange={(value) => setManualActivityForm((current) => ({ ...current, activityType: value as PromotionActivityType }))} options={PROMOTION_ACTIVITY_TYPES} /><TextInput label="Date/time" type="datetime-local" value={manualActivityForm.occurredAt} onChange={(value) => setManualActivityForm((current) => ({ ...current, occurredAt: value }))} /><TextInput label="URL" value={manualActivityForm.url} onChange={(value) => setManualActivityForm((current) => ({ ...current, url: value }))} /><TextInput label="Notes" value={manualActivityForm.notes} onChange={(value) => setManualActivityForm((current) => ({ ...current, notes: value }))} /></div><div className="mt-4 flex justify-end"><button type="button" onClick={saveManualPromotionActivity} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Log Activity</button></div><p className="mt-3 text-xs text-slate-500">This is only a manual activity log. Use “Marked as published externally” for external posts.</p></div></section> : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-semibold text-slate-950 dark:text-white">Promotion Performance</h3></div><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Campaign performance is not connected.</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">UTM links can still be created and managed, but verified traffic results will appear after analytics attribution is connected.</p>{archivedPromotions.length ? <div className="mt-4 text-sm text-slate-600">Archived campaigns: {archivedPromotions.length}</div> : null}</section>
      </div>
    );
  }

  function renderDrawer() {
    if (!selectedAdvertiser) return null;
    const primary = selectedAdvertiser.contacts.find((contact) => contact.primary) || selectedAdvertiser.contacts[0];
    const drawerTabs: DrawerSection[] = ['overview', 'contacts', 'notes', 'activity'];
    return <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950 dark:text-white">{selectedAdvertiser.companyName}</h2><p className="text-sm text-slate-600 dark:text-slate-300">Advertiser workspace</p></div><button type="button" onClick={() => setSelectedAdvertiserId(null)} aria-label="Close advertiser details"><X className="h-4 w-4" /></button></div><div className="mt-4 flex flex-wrap gap-2">{drawerTabs.map((tab) => <button key={tab} type="button" onClick={() => setDrawerSection(tab)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${drawerSection === tab ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 text-slate-600'}`}>{tab}</button>)}</div>{drawerSection === 'overview' ? <div className="mt-4 space-y-4"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{[['Industry', selectedAdvertiser.industry], ['Website', selectedAdvertiser.website || '-'], ['City', selectedAdvertiser.city || '-'], ['State', selectedAdvertiser.state || '-'], ['Lead Source', selectedAdvertiser.leadSource || '-'], ['Pipeline Stage', stageLabel(selectedAdvertiser.stage)], ['Estimated Budget', selectedAdvertiser.estimatedBudget || '0'], ['Target Region', selectedAdvertiser.targetRegion || '-'], ['Target Languages', selectedAdvertiser.targetLanguages.join(', ') || '-'], ['Interested Products', selectedAdvertiser.interests.join(', ') || '-'], ['Sales Owner', selectedAdvertiser.salesOwnerName || '-'], ['Created Date', formatDate(selectedAdvertiser.createdAt)]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-slate-900 dark:text-slate-100">{value}</div></div>)}</div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><select value={selectedAdvertiser.salesOwnerId || ''} onChange={(event) => updateAdvertiser(selectedAdvertiser.id, (advertiser) => assignSalesOwner(advertiser, staffOptions.find((staff) => staff.id === event.target.value), actor))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Unassigned</option>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select><button type="button" onClick={() => scheduleFollowUpFromDrawer()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Schedule Follow-up</button></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><SelectInput label="Interaction Type" value={interactionForm.type} onChange={(value) => setInteractionForm((current) => ({ ...current, type: value as InteractionType }))} options={INTERACTION_TYPES} /><TextInput label="Summary" value={interactionForm.summary} onChange={(value) => setInteractionForm((current) => ({ ...current, summary: value }))} /><TextInput label="Next Action" value={interactionForm.nextAction} onChange={(value) => setInteractionForm((current) => ({ ...current, nextAction: value }))} /><button type="button" onClick={logInteractionFromDrawer} className="self-end rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Log Interaction</button></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><SelectInput label="Follow-up Type" value={followUpForm.type} onChange={(value) => setFollowUpForm((current) => ({ ...current, type: value as FollowUpType }))} options={FOLLOW_UP_TYPES} /><TextInput label="Date" type="date" value={followUpForm.date} onChange={(value) => setFollowUpForm((current) => ({ ...current, date: value }))} /><TextInput label="Time" type="time" value={followUpForm.time} onChange={(value) => setFollowUpForm((current) => ({ ...current, time: value }))} /><TextInput label="Follow-up Notes" value={followUpForm.notes} onChange={(value) => setFollowUpForm((current) => ({ ...current, notes: value }))} /></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setProposalForm((current) => ({ ...current, advertiserId: selectedAdvertiser.id, title: `${selectedAdvertiser.companyName} Advertising Proposal`, objective: selectedAdvertiser.interests.join(', ') }))} className="rounded-lg border px-3 py-2 text-xs font-semibold">Create Proposal</button><button type="button" onClick={() => requestStage(selectedAdvertiser.id, 'won')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Mark Won</button><button type="button" onClick={() => requestStage(selectedAdvertiser.id, 'lost')} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">Mark Lost</button></div></div> : null}{drawerSection === 'contacts' ? <div className="mt-4 space-y-4"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><TextInput label="Name" value={contactForm.name} onChange={(value) => setContactForm((current) => ({ ...current, name: value }))} /><TextInput label="Designation" value={contactForm.designation} onChange={(value) => setContactForm((current) => ({ ...current, designation: value }))} /><TextInput label="Email" value={contactForm.email} onChange={(value) => setContactForm((current) => ({ ...current, email: value }))} /><TextInput label="Phone" value={contactForm.phone} onChange={(value) => setContactForm((current) => ({ ...current, phone: value }))} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={contactForm.primary} onChange={(event) => setContactForm((current) => ({ ...current, primary: event.target.checked }))} /> Primary Contact</label><button type="button" onClick={addContactFromDrawer} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Add Contact</button><div className="space-y-2">{selectedAdvertiser.contacts.map((contact) => <div key={contact.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="font-semibold">{contact.name} {contact.primary ? '(Primary)' : ''}</div><div>{contact.designation || '-'} · {contact.email || '-'} · {contact.phone || '-'}</div><button type="button" onClick={() => updateAdvertiser(selectedAdvertiser.id, (advertiser) => addContact(advertiser, { ...contact, primary: true, archivedAt: undefined }, actor))} className="mt-2 rounded border px-2 py-1 text-xs">Set Primary</button></div>)}</div></div> : null}{drawerSection === 'notes' ? <div className="mt-4 space-y-4"><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Internal sales note" /><button type="button" onClick={addNoteFromDrawer} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Add Internal Note</button>{selectedAdvertiser.notesHistory.length === 0 ? <div className="text-sm text-slate-500">No internal notes yet.</div> : selectedAdvertiser.notesHistory.map((note) => <div key={note.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div>{note.note}</div><div className="mt-1 text-xs text-slate-500">{note.author} ({note.staffId}) · {formatDate(note.createdAt)}</div></div>)}</div> : null}{drawerSection === 'activity' ? <div className="mt-4 space-y-2">{selectedAdvertiser.activity.length === 0 ? <div className="text-sm text-slate-500">No activity yet.</div> : selectedAdvertiser.activity.map((activity) => <div key={activity.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="font-medium">{activity.message}</div><div className="mt-1 text-xs text-slate-500">{activity.actor} ({activity.staffId}) · {formatDate(activity.createdAt)}</div></div>)}</div> : null}<div className="sr-only">Primary contact: {primary?.name || 'None'}</div></aside>;
  }

  function renderProposalWorkspace() {
    const selectedProduct = findMarketingProduct(proposalItemDraft.productId) || MARKETING_PRODUCT_OPTIONS[0];
    const selectedPlacementStatus = placementStatusText(adsPlacementStatus, selectedProduct?.placementId);
    const approvalPreview = proposalItems.length > 0 && proposalNeedsDiscountApproval(proposalItems, data.rateCards);

    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Proposals</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Build commercial proposals using the same placement identifiers Ads Manager already owns. Marketing never activates placements.</p>
            </div>
            <button type="button" onClick={createProposalFromForm} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">+ Create Proposal</button>
          </div>

          {stageError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{stageError}</div> : null}

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Advertiser</span>
              <select value={proposalForm.advertiserId || selectedAdvertiser?.id || ''} onChange={(event) => setProposalForm((current) => ({ ...current, advertiserId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">Advertiser</option>
                {data.advertisers.map((advertiser) => <option key={advertiser.id} value={advertiser.id}>{advertiser.companyName}</option>)}
              </select>
            </label>
            <TextInput label="Proposal Title" value={proposalForm.title} onChange={(value) => setProposalForm((current) => ({ ...current, title: value }))} />
            <TextInput label="Campaign Objective" value={proposalForm.objective} onChange={(value) => setProposalForm((current) => ({ ...current, objective: value }))} />
            <TextInput label="Valid Until" type="date" value={proposalForm.validUntil} onChange={(value) => setProposalForm((current) => ({ ...current, validUntil: value }))} />
            <TextInput label="Start Date" type="date" value={proposalForm.startDate} onChange={(value) => setProposalForm((current) => ({ ...current, startDate: value }))} />
            <TextInput label="End Date" type="date" value={proposalForm.endDate} onChange={(value) => setProposalForm((current) => ({ ...current, endDate: value }))} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold text-slate-950 dark:text-white">Proposal Line Items</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">OFF placements remain selectable for future campaigns. Prices are entered by staff or internal rate cards; none are preloaded.</p>
            </div>
            {adsPlacementStatusNote ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{adsPlacementStatusNote}</div> : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-4">
            <label className="block xl:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Product</span>
              <select aria-label="Product" value={proposalItemDraft.productId} onChange={(event) => updateProposalProduct(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                {MARKETING_PRODUCT_GROUPS.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Placement ID</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedProduct?.placementId || selectedProduct?.id || '-'}</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ads Manager Status</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedPlacementStatus}</div>
            </div>
            <TextInput label="Description" value={proposalItemDraft.description || selectedProduct?.description || ''} onChange={(value) => setProposalItemDraft((current) => ({ ...current, description: value }))} />
            <TextInput label="Duration / quantity" value={proposalItemDraft.quantity} placeholder="30 days, 7 days, 1 article" onChange={(value) => setProposalItemDraft((current) => ({ ...current, quantity: value }))} />
            <TextInput label="List Price" value={proposalItemDraft.listPrice} placeholder="Manual price" onChange={(value) => setProposalItemDraft((current) => ({ ...current, listPrice: value }))} />
            <TextInput label="Discount" value={proposalItemDraft.discount} onChange={(value) => setProposalItemDraft((current) => ({ ...current, discount: value }))} />
            <TextInput label="Final Price" value={proposalItemDraft.finalPrice} placeholder="Manual price" onChange={(value) => setProposalItemDraft((current) => ({ ...current, finalPrice: value }))} />
            <TextInput label="Notes" value={proposalItemDraft.notes} onChange={(value) => setProposalItemDraft((current) => ({ ...current, notes: value }))} />
          </div>
          <div className="mt-4 flex justify-end"><button type="button" onClick={addProposalLineItem} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-100">Add Line Item</button></div>

          {proposalItems.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">No proposal products added yet.</div> : <div className="mt-5 overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{['Product', 'Placement ID', 'Current Status', 'Duration / quantity', 'List Price', 'Discount', 'Final Price', 'Notes', ''].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{proposalItems.map((item) => <tr key={item.id}><td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{item.product}</td><td className="px-3 py-3">{item.placementId || item.productId || '-'}</td><td className="px-3 py-3">{placementStatusText(adsPlacementStatus, item.placementId)}</td><td className="px-3 py-3">{item.quantity || '-'}</td><td className="px-3 py-3">{item.listPrice || '-'}</td><td className="px-3 py-3">{item.discount || '-'}</td><td className="px-3 py-3">{item.finalPrice || '-'}</td><td className="px-3 py-3">{item.notes || '-'}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => removeProposalLineItem(item.id)} className="rounded border px-2 py-1 text-xs font-semibold">Remove</button></td></tr>)}</tbody></table></div>}
          {approvalPreview ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Founder approval required.</div> : null}
        </section>

        {data.proposals.length === 0 ? <EmptyState title="No proposals yet." message="Create a proposal from a real advertiser record." /> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{data.proposals.map((proposal) => { const advertiser = data.advertisers.find((item) => item.id === proposal.advertiserId); const totals = calculateProposalTotals(proposal.items, proposal.taxRate); return <section key={proposal.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-blue-700">{proposal.proposalId}</div><h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{proposal.title}</h3><p className="text-sm text-slate-600 dark:text-slate-300">Prepared For: {advertiser?.companyName || 'Advertiser'}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{proposal.status.replace(/_/g, ' ')}</span></div><div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800"><div className="text-lg font-bold">News Pulse</div><div className="text-xs text-slate-500">Your pulse on what matters most.</div><div className="mt-3 font-semibold">Recommended Advertising Package</div><div className="mt-2 space-y-2">{proposal.items.map((item) => <div key={item.id} className="rounded border border-slate-200 p-2 dark:border-slate-800"><div className="font-semibold">{item.product}</div><div className="text-xs text-slate-500">Identifier: {proposalItemInventoryId(item)} · {item.quantity || 'Duration not set'}</div><div className="text-xs text-slate-500">Final Price: {item.finalPrice || '-'}</div></div>)}</div><div className="mt-3">Grand Total: INR {formatInrFromCents(totals.grandTotalCents)}</div><div>Validity: {proposal.validUntil}</div></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => approveProposalById(proposal.id)} className="rounded border px-3 py-1.5 text-xs font-semibold">Approve</button><button type="button" onClick={() => markSentById(proposal.id)} className="rounded border px-3 py-1.5 text-xs font-semibold">Mark as Sent</button><button type="button" onClick={() => acceptProposalById(proposal.id)} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Mark Accepted</button></div></section>; })}</div>}
      </div>
    );
  }

  function renderSection() {
    if (isLoading) return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Loading Marketing...</div>;
    if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><div>{error}</div><button type="button" onClick={() => loadMarketingData()} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500">Retry</button></div>;
    if (activeSection === 'overview') return renderOverview();
    if (activeSection === 'advertisers') return renderAdvertisers();
    if (activeSection === 'follow-ups') return renderFollowUps();
    if (activeSection === 'proposals') return renderProposalWorkspace();
    if (activeSection === 'partnerships') return renderPartnerships();
    if (activeSection === 'campaigns') return renderCampaigns();
    if (activeSection === 'media-kit') return renderMediaKit();
    if (activeSection === 'audience') return renderAudience();
    if (activeSection === 'promotion') return renderPromotion();
    if (activeSection === 'performance') return renderPerformance();
    if (activeSection === 'renewals') return renderRenewals();
    const state = EMPTY_SECTIONS[activeSection];
    return <EmptyState title={state?.title || 'No data yet.'} message={state?.message || 'This Marketing section has no data or configuration yet.'} />;
  }

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-200"><Megaphone className="h-4 w-4" /> News Pulse Marketing</div><h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">Marketing</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Grow the News Pulse audience, promote the website, build advertiser relationships and manage marketing campaigns.</p>{isSaving ? <p className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-200">Saving Marketing changes to backend...</p> : null}</div><button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-100" title="Founder-controlled Marketing settings"><Settings className="h-4 w-4" /> Marketing Settings</button></div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Marketing sections">{SECTION_TABS.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={activeSection === tab.key} onClick={() => setActiveSection(tab.key)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${activeSection === tab.key ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{tab.label}</button>)}</div>
      </div>
      <div className={selectedAdvertiser ? 'grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_460px]' : 'space-y-5'}>{renderSection()}{renderDrawer()}</div>
    </section>
  );
}
