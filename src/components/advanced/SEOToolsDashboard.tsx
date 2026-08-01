import { useEffect, useMemo, useState } from 'react';
import { Search, Link as LinkIcon, FileText, BarChart3, ExternalLink, Plus, Trash2, Play, RefreshCw, Edit3, ShieldAlert, AlertTriangle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { listArticles, type Article } from '@/lib/api/articles';
import {
  checkSeoSitemaps,
  createSeoRedirect,
  getLatestSeoAudit,
  deleteSeoRedirect,
  getSeoAuditStatus,
  getSeoSitemapStatus,
  listSeoAuditHistory,
  listSeoRedirects,
  setSeoRedirectActive,
  startSeoAudit,
  testSeoRedirect,
  updateSeoRedirect,
  type SeoApiError,
  type SeoAudit,
  type SeoAuditIssue,
  type SeoAuditMode,
  type SeoIssueSeverity,
  type SeoPerformanceScore,
  type SeoRedirect,
  type SeoRedirectInput,
  type SeoSitemapItem,
} from '@/lib/api/seo';

type Tab = 'audit' | 'redirects' | 'sitemap' | 'meta';
type LoadState = 'idle' | 'loading' | 'success' | 'error';
type IssueFilter = 'all' | 'critical' | 'warning' | 'passed';
type RedirectFormState = SeoRedirectInput;

const AUDIT_HISTORY_LIMIT = 10;
const ISSUE_PAGE_SIZE = 8;
const AUDIT_POLL_INTERVAL_MS = 3000;
const ACCESS_DENIED_MESSAGE = 'Access Denied. Founder permission is required.';
const SELECTED_AUDIT_STORAGE_KEY = 'np:selected-seo-audit-id';

const AUDIT_MODE_OPTIONS: Array<{ value: SeoAuditMode; label: string; description: string }> = [
  { value: 'quick', label: 'Quick Audit — Recommended', description: 'Essential SEO checks for daily use.' },
  { value: 'full', label: 'Full Audit — Deep Scan', description: 'Deeper scan that can take longer.' },
];

const LANGUAGE_FILTERS = [
  { value: 'all', label: 'All languages' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
];

const PUBLICATION_STATUS_FILTERS = [
  { value: 'all', label: 'All publication statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
];

const SEO_STATUS_FILTERS = [
  { value: 'all', label: 'All SEO statuses' },
  { value: 'good', label: 'Good' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
  { value: 'unknown', label: 'Not analyzed' },
];

const readableSelectClass = 'bg-white border border-emerald-700 rounded-lg px-3 py-2 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-200';

const emptyRedirectForm: RedirectFormState = {
  sourcePath: '',
  destination: '',
  type: 301,
  reason: '',
  active: true,
};

function errorMessage(error: unknown, fallback: string): string {
  const apiError = error as SeoApiError;
  const status = apiError?.status;
  if (status === 400) return apiError.message || 'Validation failed. Check the submitted values.';
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return ACCESS_DENIED_MESSAGE;
  if (status === 404) return 'SEO endpoint unavailable.';
  if (status === 409) return apiError.message || 'Audit already running.';
  if (status && status >= 500) return 'SEO backend returned a server error.';
  if ((apiError?.code || '').toUpperCase().includes('TIMEOUT')) return 'The SEO request timed out. Please try again.';
  if (!status && (apiError?.code === 'BACKEND_OFFLINE' || apiError?.message === 'Backend offline')) return 'Unable to connect to backend.';
  return apiError?.message || fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
}

function formatDuration(ms?: number | null): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return 'Not available';
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes <= 0 ? `${remainder}s` : `${minutes}m ${remainder}s`;
}

function formatElapsedSeconds(seconds?: number | null): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'Not available';
  const rounded = Math.max(0, Math.round(seconds));
  return `${rounded} ${rounded === 1 ? 'second' : 'seconds'}`;
}

function formatNumber(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : 'Not available';
}

function formatScore(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}/100` : 'Not available';
}

function performanceLabel(score: SeoPerformanceScore): string {
  if (typeof score.score === 'number' && Number.isFinite(score.score)) return `${Math.round(score.score)}/100`;
  if (score.status === 'not_configured') return 'Not configured';
  if (score.status === 'failed' || score.status === 'unavailable') return 'Unavailable';
  return 'Not available';
}

function scoreClass(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'text-emerald-100';
  if (value >= 80) return 'text-green-400';
  if (value >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (['completed', 'available', 'active'].includes(normalized)) return 'bg-green-500/20 text-green-200 border-green-500/30';
  if (['queued', 'running', 'warning'].includes(normalized)) return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30';
  if (['failed', 'unavailable', 'disabled'].includes(normalized)) return 'bg-red-500/20 text-red-200 border-red-500/30';
  return 'bg-emerald-500/20 text-emerald-100 border-emerald-500/30';
}

function issueClass(severity: SeoIssueSeverity): string {
  if (severity === 'critical') return 'bg-red-500/10 border-red-500/30 text-red-200';
  if (severity === 'warning') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-100';
  if (severity === 'passed') return 'bg-green-500/10 border-green-500/30 text-green-100';
  return 'bg-blue-500/10 border-blue-500/30 text-blue-100';
}

function safeOpenUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed || /^javascript:/i.test(trimmed)) return;
  window.open(trimmed, '_blank', 'noopener,noreferrer');
}

function collectUserKeys(user: any): Set<string> {
  const keys = new Set<string>();
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(add);
      return;
    }
    const text = String(value || '').trim();
    if (text) keys.add(text);
  };
  [
    user?.permissions,
    user?.specialPermissions,
    user?.specialRights,
    user?.rights,
    user?.access?.permissions,
    user?.access?.specialRights,
    user?.accessControl?.permissions,
    user?.accessControl?.specialRights,
    user?.accessOverrides?.permissions,
    user?.accessOverrides?.specialRights,
  ].forEach(add);
  return keys;
}

function hasSeoActionPermission(user: any, permission: string): boolean {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'founder' || role === 'admin') return true;
  const keys = collectUserKeys(user);
  return keys.has('*') || keys.has('seo.*') || keys.has(permission);
}

function getSelectedAuditId(): string {
  try {
    return localStorage.getItem(SELECTED_AUDIT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setSelectedAuditId(id: string): void {
  try {
    if (id) localStorage.setItem(SELECTED_AUDIT_STORAGE_KEY, id);
  } catch {
    // ignore storage failures
  }
}

function getArticleSeo(article: Article): Record<string, any> {
  const anyArticle = article as any;
  return anyArticle.seo || anyArticle.seoMeta || anyArticle.metadata?.seo || anyArticle.meta || {};
}

function getArticlePublicUrl(article: Article): string {
  const anyArticle = article as any;
  const seo = getArticleSeo(article);
  const direct = anyArticle.publicUrl || anyArticle.url || seo.publicUrl || seo.canonicalUrl || seo.canonical;
  if (direct) return String(direct);
  return article.slug ? `/news/${article.slug}` : '';
}

function getArticleIssueCount(article: Article): number | null {
  const seo = getArticleSeo(article);
  const direct = (article as any).seoIssueCount ?? seo.issueCount ?? seo.issuesCount;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  if (Array.isArray(seo.issues)) return seo.issues.length;
  return null;
}

function normalizeArticleLanguageCode(article: Article): string {
  return String(article.language || article.lang || '').trim().toLowerCase();
}

function normalizeArticlePublicationStatus(article: Article): string {
  const anyArticle = article as any;
  const raw = String(article.status || anyArticle.state || anyArticle.publishStatus || '').trim().toLowerCase();
  return raw === 'unpublished' ? 'draft' : raw;
}

function getArticleSeoStatus(article: Article): 'good' | 'warning' | 'critical' | 'unknown' {
  const seo = getArticleSeo(article);
  const explicit = String(seo.status || seo.seoStatus || seo.health || '').trim().toLowerCase();
  if (['good', 'ok', 'passed', 'pass'].includes(explicit)) return 'good';
  if (['warning', 'warn'].includes(explicit)) return 'warning';
  if (['critical', 'error', 'failed', 'fail'].includes(explicit)) return 'critical';

  const issues = Array.isArray(seo.issues) ? seo.issues : [];
  if (issues.some((issue: any) => ['critical', 'error', 'high'].includes(String(issue?.severity || issue?.level || issue?.status || '').toLowerCase()))) return 'critical';
  if (issues.length > 0) return 'warning';

  const score = typeof seo.score === 'number' && Number.isFinite(seo.score) ? seo.score : null;
  if (score === null) return 'unknown';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warning';
  return 'critical';
}

function filterMetaArticles(articles: Article[], filters: { search: string; language: string; status: string; seoStatus: string }): Article[] {
  const query = filters.search.trim().toLowerCase();
  return articles.filter((article) => {
    const matchesSearch = !query
      || String(article.title || '').toLowerCase().includes(query)
      || String(article.slug || '').toLowerCase().includes(query);
    const matchesLanguage = filters.language === 'all' || normalizeArticleLanguageCode(article) === filters.language;
    const matchesStatus = filters.status === 'all' || normalizeArticlePublicationStatus(article) === filters.status;
    const matchesSeo = filters.seoStatus === 'all' || getArticleSeoStatus(article) === filters.seoStatus;
    return matchesSearch && matchesLanguage && matchesStatus && matchesSeo;
  });
}

function getSeoField(article: Article, ...keys: string[]): string {
  const anyArticle = article as any;
  const seo = getArticleSeo(article);
  for (const key of keys) {
    const value = seo[key] ?? anyArticle[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function PermissionText({ allowed }: { allowed: boolean }) {
  if (allowed) return null;
  return <p className="mt-2 text-sm text-red-200">{ACCESS_DENIED_MESSAGE}</p>;
}

function StatCard({ label, value, title, valueClass }: { label: string; value: string; title?: string; valueClass?: string }) {
  return (
    <div className="bg-emerald-700/30 rounded-lg p-4" title={title}>
      <p className="text-emerald-300 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueClass || 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function SEOToolsDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('audit');
  const [auditState, setAuditState] = useState<LoadState>('idle');
  const [auditHistory, setAuditHistory] = useState<SeoAudit[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<SeoAudit | null>(null);
  const [auditError, setAuditError] = useState('');
  const [auditHistoryError, setAuditHistoryError] = useState('');
  const [showingPreviousAudit, setShowingPreviousAudit] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditMode, setAuditMode] = useState<SeoAuditMode>('quick');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
  const [issueSearch, setIssueSearch] = useState('');
  const [issueCategory, setIssueCategory] = useState('all');
  const [issuePage, setIssuePage] = useState(1);
  const [redirectState, setRedirectState] = useState<LoadState>('idle');
  const [redirects, setRedirects] = useState<SeoRedirect[]>([]);
  const [redirectError, setRedirectError] = useState('');
  const [redirectFormOpen, setRedirectFormOpen] = useState(false);
  const [redirectEditingId, setRedirectEditingId] = useState('');
  const [redirectForm, setRedirectForm] = useState<RedirectFormState>(emptyRedirectForm);
  const [redirectFormError, setRedirectFormError] = useState('');
  const [redirectSaving, setRedirectSaving] = useState(false);
  const [deleteRedirectId, setDeleteRedirectId] = useState('');
  const [redirectTestMessage, setRedirectTestMessage] = useState('');
  const [sitemapState, setSitemapState] = useState<LoadState>('idle');
  const [sitemapItems, setSitemapItems] = useState<SeoSitemapItem[]>([]);
  const [sitemapError, setSitemapError] = useState('');
  const [sitemapChecking, setSitemapChecking] = useState(false);
  const [metaState, setMetaState] = useState<LoadState>('idle');
  const [metaArticles, setMetaArticles] = useState<Article[]>([]);
  const [metaTotalPages, setMetaTotalPages] = useState(1);
  const [metaError, setMetaError] = useState('');
  const [metaSearch, setMetaSearch] = useState('');
  const [metaLanguage, setMetaLanguage] = useState('all');
  const [metaStatus, setMetaStatus] = useState('all');
  const [metaIssueFilter, setMetaIssueFilter] = useState('all');
  const [metaPage, setMetaPage] = useState(1);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const canRunAudit = hasSeoActionPermission(user, 'seo.run_audit');
  const canManageRedirects = hasSeoActionPermission(user, 'seo.manage_redirects');
  const canDeleteRedirects = hasSeoActionPermission(user, 'seo.delete_redirects');
  const canCheckSitemaps = hasSeoActionPermission(user, 'seo.check_sitemaps');

  const loadAuditHistory = async (showLoading = true) => {
    if (showLoading) setAuditState('loading');
    setAuditError('');
    setAuditHistoryError('');
    try {
      const [latestResult, historyResult] = await Promise.allSettled([
        getLatestSeoAudit(),
        listSeoAuditHistory({ limit: AUDIT_HISTORY_LIMIT }),
      ]);

      if (latestResult.status === 'rejected' && historyResult.status === 'rejected') {
        throw historyResult.reason || latestResult.reason;
      }

      const latest = latestResult.status === 'fulfilled' ? latestResult.value : null;
      const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
      if (historyResult.status === 'rejected') {
        setAuditHistoryError(errorMessage(historyResult.reason, 'Audit history could not be loaded.'));
      }
      setAuditHistory(history);
      const persisted = getSelectedAuditId();
      const nextAudit = history.find((audit) => audit.id === persisted) || latest || history[0] || null;
      setSelectedAudit(nextAudit);
      setShowingPreviousAudit(false);
      setAuditState('success');
    } catch (error) {
      setAuditError(errorMessage(error, 'Failed to load SEO audit data.'));
      setShowingPreviousAudit(Boolean(selectedAudit));
      setAuditState('error');
    }
  };

  const loadRedirects = async () => {
    setRedirectState('loading');
    setRedirectError('');
    try {
      setRedirects(await listSeoRedirects());
      setRedirectState('success');
    } catch (error) {
      setRedirectError(errorMessage(error, 'Failed to load redirects.'));
      setRedirects([]);
      setRedirectState('error');
    }
  };

  const loadSitemap = async () => {
    setSitemapState('loading');
    setSitemapError('');
    try {
      setSitemapItems(await getSeoSitemapStatus());
      setSitemapState('success');
    } catch (error) {
      setSitemapError(errorMessage(error, 'Failed to load sitemap data.'));
      setSitemapItems([]);
      setSitemapState('error');
    }
  };

  const loadMetaArticles = async () => {
    setMetaState('loading');
    setMetaError('');
    try {
      const response = await listArticles({
        q: metaSearch.trim() || undefined,
        language: metaLanguage === 'all' ? undefined : metaLanguage,
        status: metaStatus === 'all' ? 'all' : metaStatus as any,
        page: metaPage,
        limit: 10,
        sort: '-updatedAt',
      });
      const rows = filterMetaArticles(response.rows, {
        search: metaSearch,
        language: metaLanguage,
        status: metaStatus,
        seoStatus: metaIssueFilter,
      });
      setMetaArticles(rows);
      setMetaTotalPages(response.pages || 1);
      setSelectedArticle((current) => current && rows.some((article) => article._id === current._id) ? current : rows[0] || null);
      setMetaState('success');
    } catch (error) {
      setMetaError(errorMessage(error, 'Failed to load real articles for meta tag analysis.'));
      setMetaArticles([]);
      setSelectedArticle(null);
      setMetaState('error');
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') void loadAuditHistory(true);
    if (activeTab === 'redirects') void loadRedirects();
    if (activeTab === 'sitemap') void loadSitemap();
    if (activeTab === 'meta') void loadMetaArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (activeTab === 'meta') void loadMetaArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaSearch, metaLanguage, metaStatus, metaIssueFilter, metaPage]);

  useEffect(() => {
    setIssuePage(1);
  }, [issueFilter, issueSearch, issueCategory, selectedAudit?.id]);

  useEffect(() => {
    if (activeTab !== 'audit' || !selectedAudit || !['queued', 'running'].includes(selectedAudit.status)) return;
    let stopped = false;

    const pollAuditStatus = async () => {
      try {
        const latest = await getSeoAuditStatus(selectedAudit.id);
        if (stopped) return;
        setSelectedAudit(latest);
        setSelectedAuditId(latest.id);
        setAuditHistory((current) => [latest, ...current.filter((item) => item.id !== latest.id)]);
        setAuditError('');
        setShowingPreviousAudit(false);
        setAuditState('success');
        if (latest.status === 'completed') {
          await loadAuditHistory(false);
        }
      } catch (error) {
        if (stopped) return;
        setAuditError(errorMessage(error, 'Failed to refresh SEO audit status.'));
        setShowingPreviousAudit(Boolean(selectedAudit));
      }
    };

    const pollId = window.setInterval(() => { void pollAuditStatus(); }, AUDIT_POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedAudit?.id, selectedAudit?.status]);

  const runAudit = async () => {
    if (!canRunAudit) {
      setAuditError(ACCESS_DENIED_MESSAGE);
      return;
    }
    if (runningAudit || selectedAudit?.status === 'queued' || selectedAudit?.status === 'running') return;
    setRunningAudit(true);
    setAuditError('');
    try {
      const audit = await startSeoAudit({ mode: auditMode });
      setSelectedAudit(audit);
      setSelectedAuditId(audit.id);
      setAuditHistory((current) => [audit, ...current.filter((item) => item.id !== audit.id)]);
      setAuditState('success');
      toast.success(audit.status === 'queued' ? 'SEO audit queued' : 'SEO audit started');
    } catch (error) {
      setAuditError(errorMessage(error, 'Failed to start SEO audit.'));
      setAuditState('error');
    } finally {
      setRunningAudit(false);
    }
  };

  const filteredIssues = useMemo(() => {
    const issues = selectedAudit?.issues || [];
    const query = issueSearch.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesSeverity = issueFilter === 'all' || issue.severity === issueFilter;
      const matchesCategory = issueCategory === 'all' || issue.category === issueCategory;
      const matchesSearch = !query || issue.pageUrl.toLowerCase().includes(query) || issue.title.toLowerCase().includes(query);
      return matchesSeverity && matchesCategory && matchesSearch;
    });
  }, [selectedAudit, issueFilter, issueSearch, issueCategory]);

  const issueCategories = useMemo(() => {
    const counts = new Map<string, number>();
    (selectedAudit?.issues || []).forEach((issue) => {
      const category = issue.category || 'General';
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [selectedAudit]);

  const pagedIssues = useMemo(() => {
    const start = (issuePage - 1) * ISSUE_PAGE_SIZE;
    return filteredIssues.slice(start, start + ISSUE_PAGE_SIZE);
  }, [filteredIssues, issuePage]);

  const issuePages = Math.max(1, Math.ceil(filteredIssues.length / ISSUE_PAGE_SIZE));
  const duplicateAuditDisabled = runningAudit || selectedAudit?.status === 'queued' || selectedAudit?.status === 'running';

  const openRedirectForm = (redirect?: SeoRedirect) => {
    setRedirectFormError('');
    if (redirect) {
      setRedirectEditingId(redirect.id);
      setRedirectForm({
        sourcePath: redirect.sourcePath,
        destination: redirect.destination,
        type: redirect.type,
        reason: redirect.reason,
        active: redirect.active,
      });
    } else {
      setRedirectEditingId('');
      setRedirectForm(emptyRedirectForm);
    }
    setRedirectFormOpen(true);
  };

  const validateRedirect = (form: RedirectFormState): string => {
    if (!form.sourcePath.trim().startsWith('/')) return 'Source path must begin with /.';
    if (!form.destination.trim()) return 'Destination is required.';
    if (form.sourcePath.trim() === form.destination.trim()) return 'Source and destination cannot be the same.';
    return '';
  };

  const saveRedirect = async () => {
    if (!canManageRedirects) {
      setRedirectFormError(ACCESS_DENIED_MESSAGE);
      return;
    }
    const validation = validateRedirect(redirectForm);
    if (validation) {
      setRedirectFormError(validation);
      return;
    }
    setRedirectSaving(true);
    setRedirectFormError('');
    try {
      if (redirectEditingId) {
        await updateSeoRedirect(redirectEditingId, redirectForm);
      } else {
        await createSeoRedirect(redirectForm);
      }
      setRedirectFormOpen(false);
      setRedirectEditingId('');
      toast.success('Redirect saved');
      await loadRedirects();
    } catch (error) {
      setRedirectFormError(errorMessage(error, 'Failed to save redirect.'));
    } finally {
      setRedirectSaving(false);
    }
  };

  const toggleRedirect = async (redirect: SeoRedirect) => {
    if (!canManageRedirects) {
      setRedirectError(ACCESS_DENIED_MESSAGE);
      return;
    }
    try {
      await setSeoRedirectActive(redirect.id, !redirect.active);
      toast.success(redirect.active ? 'Redirect disabled' : 'Redirect enabled');
      await loadRedirects();
    } catch (error) {
      setRedirectError(errorMessage(error, 'Failed to update redirect.'));
    }
  };

  const confirmDeleteRedirect = async () => {
    if (!deleteRedirectId) return;
    if (!canDeleteRedirects) {
      setRedirectError(ACCESS_DENIED_MESSAGE);
      setDeleteRedirectId('');
      return;
    }
    try {
      await deleteSeoRedirect(deleteRedirectId);
      toast.success('Redirect deleted');
      setDeleteRedirectId('');
      await loadRedirects();
    } catch (error) {
      setRedirectError(errorMessage(error, 'Failed to delete redirect.'));
    }
  };

  const testRedirect = async (redirect: SeoRedirect) => {
    setRedirectTestMessage('');
    try {
      const result = await testSeoRedirect(redirect.sourcePath);
      setRedirectTestMessage(`${redirect.sourcePath}: ${result.message}${result.finalUrl ? ` -> ${result.finalUrl}` : ''}`);
    } catch (error) {
      setRedirectTestMessage(errorMessage(error, 'Failed to test redirect.'));
    }
  };

  const checkSitemaps = async () => {
    if (!canCheckSitemaps) {
      setSitemapError(ACCESS_DENIED_MESSAGE);
      return;
    }
    setSitemapChecking(true);
    setSitemapError('');
    try {
      setSitemapItems(await checkSeoSitemaps());
      setSitemapState('success');
      toast.success('Sitemap check completed');
    } catch (error) {
      setSitemapError(errorMessage(error, 'Failed to check sitemaps.'));
      setSitemapItems([]);
      setSitemapState('error');
    } finally {
      setSitemapChecking(false);
    }
  };

  const sitemapRows = useMemo(() => {
    const defaults = [
      { key: 'main', label: 'Main Sitemap' },
      { key: 'news', label: 'News Sitemap' },
      { key: 'robots', label: 'robots.txt' },
    ];
    return defaults.map((item) => sitemapItems.find((row) => row.key === item.key) || {
      key: item.key,
      label: item.label,
      url: '',
      httpStatus: null,
      status: 'not_checked' as const,
      lastChecked: null,
      urlCount: null,
      validUrls: null,
      invalidUrls: null,
      duplicateUrls: null,
      errorUrls: null,
      warnings: [],
      issues: [],
      raw: null,
    });
  }, [sitemapItems]);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'audit', label: 'SEO Audit', icon: BarChart3 },
    { id: 'redirects', label: 'Redirects', icon: LinkIcon },
    { id: 'sitemap', label: 'Sitemap', icon: FileText },
    { id: 'meta', label: 'Meta Tags', icon: Search },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3 mb-2">
          <Search className="w-9 h-9 md:w-10 md:h-10 text-emerald-300" />
          SEO Tools & Audit
        </h1>
        <p className="text-emerald-200 mb-8">Optimize your site for search engines</p>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2" role="tablist" aria-label="SEO tools">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-emerald-800/50 text-emerald-200 hover:bg-emerald-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'audit' && (
          <AuditTab
            state={auditState}
            audit={selectedAudit}
            history={auditHistory}
            error={auditError}
            historyError={auditHistoryError}
            showingPrevious={showingPreviousAudit}
            runningAudit={runningAudit}
            auditMode={auditMode}
            duplicateAuditDisabled={duplicateAuditDisabled}
            canRunAudit={canRunAudit}
            issueFilter={issueFilter}
            issueSearch={issueSearch}
            issueCategory={issueCategory}
            issueCategories={issueCategories}
            pagedIssues={pagedIssues}
            issuePage={issuePage}
            issuePages={issuePages}
            filteredIssueCount={filteredIssues.length}
            onRunAudit={runAudit}
            onAuditMode={setAuditMode}
            onRefresh={() => loadAuditHistory(false)}
            onSelectAudit={(audit) => {
              setSelectedAudit(audit);
              setSelectedAuditId(audit.id);
            }}
            onIssueFilter={setIssueFilter}
            onIssueSearch={setIssueSearch}
            onIssueCategory={setIssueCategory}
            onIssuePage={setIssuePage}
          />
        )}

        {activeTab === 'redirects' && (
          <RedirectsTab
            state={redirectState}
            redirects={redirects}
            error={redirectError}
            formOpen={redirectFormOpen}
            editingId={redirectEditingId}
            form={redirectForm}
            formError={redirectFormError}
            saving={redirectSaving}
            canManage={canManageRedirects}
            canDelete={canDeleteRedirects}
            deleteId={deleteRedirectId}
            testMessage={redirectTestMessage}
            onOpenForm={openRedirectForm}
            onCloseForm={() => setRedirectFormOpen(false)}
            onFormChange={setRedirectForm}
            onSave={saveRedirect}
            onToggle={toggleRedirect}
            onDeleteRequest={setDeleteRedirectId}
            onDeleteCancel={() => setDeleteRedirectId('')}
            onDeleteConfirm={confirmDeleteRedirect}
            onTest={testRedirect}
            onRefresh={loadRedirects}
          />
        )}

        {activeTab === 'sitemap' && (
          <SitemapTab
            state={sitemapState}
            items={sitemapRows}
            hasChecks={sitemapItems.length > 0}
            error={sitemapError}
            checking={sitemapChecking}
            canCheck={canCheckSitemaps}
            onCheck={checkSitemaps}
            onRefresh={loadSitemap}
          />
        )}

        {activeTab === 'meta' && (
          <MetaTagsTab
            state={metaState}
            error={metaError}
            articles={metaArticles}
            selectedArticle={selectedArticle}
            search={metaSearch}
            language={metaLanguage}
            status={metaStatus}
            issueFilter={metaIssueFilter}
            page={metaPage}
            pages={metaTotalPages}
            onSearch={(value) => { setMetaPage(1); setMetaSearch(value); }}
            onLanguage={(value) => { setMetaPage(1); setMetaLanguage(value); }}
            onStatus={(value) => { setMetaPage(1); setMetaStatus(value); }}
            onIssueFilter={(value) => { setMetaPage(1); setMetaIssueFilter(value); }}
            onPage={setMetaPage}
            onSelectArticle={setSelectedArticle}
            onRefresh={loadMetaArticles}
          />
        )}
      </div>
    </div>
  );
}

function AuditTab(props: {
  state: LoadState;
  audit: SeoAudit | null;
  history: SeoAudit[];
  error: string;
  historyError: string;
  showingPrevious: boolean;
  runningAudit: boolean;
  auditMode: SeoAuditMode;
  duplicateAuditDisabled: boolean;
  canRunAudit: boolean;
  issueFilter: IssueFilter;
  issueSearch: string;
  issueCategory: string;
  issueCategories: Array<{ category: string; count: number }>;
  pagedIssues: SeoAuditIssue[];
  issuePage: number;
  issuePages: number;
  filteredIssueCount: number;
  onRunAudit: () => void;
  onAuditMode: (mode: SeoAuditMode) => void;
  onRefresh: () => void;
  onSelectAudit: (audit: SeoAudit) => void;
  onIssueFilter: (filter: IssueFilter) => void;
  onIssueSearch: (value: string) => void;
  onIssueCategory: (value: string) => void;
  onIssuePage: (page: number) => void;
}) {
  const audit = props.audit;
  const selectedMode = AUDIT_MODE_OPTIONS.find((option) => option.value === props.auditMode) || AUDIT_MODE_OPTIONS[0];
  return (
    <div className="space-y-6">
      <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Latest SEO Audit</h2>
            {audit && <p className="text-sm text-emerald-300 mt-1">Status: <StatusPill value={audit.status} /></p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(audit?.status === 'running' || audit?.status === 'queued') && (
              <button type="button" onClick={props.onRefresh} className="px-4 py-2 bg-emerald-700/70 hover:bg-emerald-700 text-white rounded-lg font-medium transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                <RefreshCw className="w-4 h-4" /> Refresh Status
              </button>
            )}
            <button
              type="button"
              onClick={props.onRunAudit}
              disabled={!props.canRunAudit || props.duplicateAuditDisabled}
              title={!props.canRunAudit ? ACCESS_DENIED_MESSAGE : props.duplicateAuditDisabled ? 'An audit is already queued or running.' : 'Run New Audit'}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <Play className="w-4 h-4" />
              {props.runningAudit ? 'Starting...' : 'Run New Audit'}
            </button>
          </div>
        </div>
        <div className="mb-6 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-4">
          <label className="block text-sm font-semibold text-emerald-100 mb-2" htmlFor="seo-audit-mode">Audit mode</label>
          <select id="seo-audit-mode" value={props.auditMode} onChange={(event) => props.onAuditMode(event.target.value as SeoAuditMode)} disabled={props.duplicateAuditDisabled} className="w-full sm:max-w-sm bg-white border border-emerald-700 rounded-lg px-3 py-2 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-70">
            {AUDIT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p className="mt-2 text-sm text-emerald-200"><span className="font-semibold text-white">{selectedMode.label}:</span> {selectedMode.description}</p>
        </div>
        <PermissionText allowed={props.canRunAudit} />
        {props.state === 'loading' && <LoadingBlock label="Loading SEO audit data..." />}
        {props.error && <ErrorBanner message={props.error} previous={props.showingPrevious} />}
        {props.state !== 'loading' && !audit && !props.error && (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-emerald-600 mx-auto mb-4 opacity-50" />
            <p className="text-emerald-100 mb-2 font-semibold">No SEO audit has been run yet</p>
            <button type="button" onClick={props.onRunAudit} disabled={!props.canRunAudit} className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200">
              Run New Audit
            </button>
          </div>
        )}
        {audit?.status === 'queued' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-5 text-yellow-100">
            <h3 className="text-lg font-semibold">Audit queued</h3>
            <p className="mt-2 text-sm">The backend has accepted this SEO audit. Duplicate audit starts are disabled until it begins or completes.</p>
            <p className="mt-2 text-sm">Start time: {formatDate(audit.startedAt)}</p>
          </div>
        )}
        {audit?.status === 'running' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-5 text-yellow-100">
            <h3 className="text-lg font-semibold">Audit running</h3>
            <div className="mt-3 h-3 bg-emerald-950/70 rounded-full overflow-hidden" aria-label="Audit progress">
              {audit.totalPages === null ? <div className="h-full w-full bg-yellow-400/60 animate-pulse" /> : <div className="h-full bg-yellow-400" style={{ width: `${Math.min(100, Math.max(0, audit.progressPercent ?? 0))}%` }} />}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 text-sm">
              <span>Scanning pages: {formatNumber(audit.pagesChecked)} / {formatNumber(audit.totalPages)}</span>
              <span>Progress: {audit.progressPercent === null ? 'Not available' : `${Math.round(audit.progressPercent)}%`}</span>
              <span>Stage: {audit.currentStage || 'Not available'}</span>
              <span>Elapsed: {formatElapsedSeconds(audit.elapsedSeconds)}</span>
              <span>Start time: {formatDate(audit.startedAt)}</span>
            </div>
          </div>
        )}
        {audit?.status === 'failed' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-5 text-red-100">
            <h3 className="text-lg font-semibold flex items-center gap-2"><XCircle className="w-5 h-5" /> SEO audit failed</h3>
            <p className="mt-2">{audit.safeErrorMessage || 'The backend did not provide a detailed failure reason.'}</p>
            <button type="button" onClick={props.onRunAudit} disabled={!props.canRunAudit || props.runningAudit} className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-200">
              Retry
            </button>
          </div>
        )}
        {audit && (audit.status === 'completed' || audit.status === 'unknown') && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="SEO Score" value={formatScore(audit.score)} valueClass={scoreClass(audit.score)} title="Overall score returned by the SEO backend." />
              <StatCard label="Pages Checked" value={formatNumber(audit.pagesChecked)} />
              <StatCard label="Critical Issues" value={formatNumber(audit.criticalIssues)} valueClass="text-red-300" />
              <StatCard label="Warnings" value={formatNumber(audit.warnings)} valueClass="text-yellow-300" />
              <StatCard label="Passed Checks" value={formatNumber(audit.passedChecks)} valueClass="text-green-300" />
              <StatCard label="Desktop Performance" value={performanceLabel(audit.desktopPerformance)} title={audit.desktopPerformance.message || 'Desktop score from the backend performance provider.'} />
              <StatCard label="Mobile Performance" value={performanceLabel(audit.mobilePerformance)} title={audit.mobilePerformance.message || 'Mobile score from the backend performance provider.'} />
              <StatCard label="Duration" value={formatDuration(audit.durationMs)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-emerald-100 mb-6">
              <div>Completed: <span className="text-white">{formatDate(audit.completedAt)}</span></div>
              <div>Started by: <span className="text-white">{audit.startedBy || 'Not available'}</span></div>
              <div>Started: <span className="text-white">{formatDate(audit.startedAt)}</span></div>
            </div>
            <AuditIssues {...props} />
          </>
        )}
      </div>
      <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50">
        <h2 className="text-xl font-bold text-white mb-4">Audit History</h2>
        {props.historyError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-100">
            <p className="font-semibold">Audit history could not be loaded.</p>
            <p className="mt-1 text-sm">{props.historyError}</p>
          </div>
        ) : props.error && props.history.length === 0 ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-100">
            <p className="font-semibold">Audit history could not be loaded.</p>
            <p className="mt-1 text-sm">{props.error}</p>
          </div>
        ) : props.history.length === 0 ? (
          <p className="text-emerald-200">No audit history returned by the backend.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="text-emerald-300">
                <tr><th className="py-2 pr-4">Date/time</th><th className="py-2 pr-4">Score</th><th className="py-2 pr-4">Pages</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Started by</th><th className="py-2 pr-4">Critical</th><th className="py-2 pr-4">Warnings</th><th className="py-2 pr-4">Action</th></tr>
              </thead>
              <tbody className="text-emerald-50">
                {props.history.map((item) => (
                  <tr key={item.id} className="border-t border-emerald-700/50">
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDate(item.completedAt || item.startedAt)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatScore(item.score)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatNumber(item.pagesChecked)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap"><StatusPill value={item.status} /></td>
                    <td className="py-3 pr-4 whitespace-nowrap">{item.startedBy || 'Not available'}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatNumber(item.criticalIssues)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatNumber(item.warnings)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap"><button type="button" onClick={() => props.onSelectAudit(item)} className="text-emerald-200 hover:text-white underline focus:outline-none focus:ring-2 focus:ring-emerald-200 rounded">View Audit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditIssues(props: Parameters<typeof AuditTab>[0]) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Audit Issues</h3>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'critical', 'warning', 'passed'] as IssueFilter[]).map((filter) => (
            <button key={filter} type="button" onClick={() => props.onIssueFilter(filter)} className={`px-3 py-2 rounded-lg text-sm font-medium capitalize focus:outline-none focus:ring-2 focus:ring-emerald-200 ${props.issueFilter === filter ? 'bg-emerald-500 text-white' : 'bg-emerald-900/50 text-emerald-200'}`}>{filter === 'all' ? 'All' : filter === 'warning' ? 'Warnings' : filter}</button>
          ))}
        </div>
        <input value={props.issueSearch} onChange={(event) => props.onIssueSearch(event.target.value)} placeholder="Search URL or issue" className="bg-emerald-950/60 border border-emerald-700 rounded-lg px-3 py-2 text-white placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
        <select value={props.issueCategory} onChange={(event) => props.onIssueCategory(event.target.value)} className="bg-emerald-950/60 border border-emerald-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
          <option value="all">All categories</option>
          {props.issueCategories.map((item) => <option key={item.category} value={item.category}>{item.category} ({item.count})</option>)}
        </select>
      </div>
      {props.pagedIssues.length === 0 ? <p className="text-emerald-200 bg-emerald-900/30 rounded-lg p-4">No audit issues match the current filters.</p> : (
        <div className="space-y-3">
          {props.pagedIssues.map((issue) => (
            <div key={issue.id} className={`p-4 rounded-lg border ${issueClass(issue.severity)}`}>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                <div><span className="text-xs px-2 py-1 rounded uppercase font-semibold bg-black/20">{issue.severity}</span><h4 className="text-white font-semibold mt-2">{issue.title}</h4><p className="text-sm text-emerald-100 break-all">{issue.pageUrl || 'Page URL not provided'}</p></div>
                {issue.pageUrl && <button type="button" onClick={() => safeOpenUrl(issue.pageUrl)} className="text-sm text-emerald-100 hover:text-white underline flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-emerald-200 rounded"><ExternalLink className="w-4 h-4" /> Open public page</button>}
              </div>
              {issue.explanation && <p className="text-sm mb-2">{issue.explanation}</p>}
              {issue.currentValue && <p className="text-sm mb-2"><span className="font-semibold">Current value:</span> {issue.currentValue}</p>}
              {issue.recommendedAction && <p className="text-sm mb-2"><span className="font-semibold">Recommended action:</span> {issue.recommendedAction}</p>}
              {issue.checkCode && <p className="text-xs text-emerald-200">Check code: {issue.checkCode}</p>}
            </div>
          ))}
        </div>
      )}
      <Pager page={props.issuePage} pages={props.issuePages} label={`${props.filteredIssueCount} issues`} onPage={props.onIssuePage} />
    </div>
  );
}

function RedirectsTab(props: { state: LoadState; redirects: SeoRedirect[]; error: string; formOpen: boolean; editingId: string; form: RedirectFormState; formError: string; saving: boolean; canManage: boolean; canDelete: boolean; deleteId: string; testMessage: string; onOpenForm: (redirect?: SeoRedirect) => void; onCloseForm: () => void; onFormChange: (form: RedirectFormState) => void; onSave: () => void; onToggle: (redirect: SeoRedirect) => void; onDeleteRequest: (id: string) => void; onDeleteCancel: () => void; onDeleteConfirm: () => void; onTest: (redirect: SeoRedirect) => void; onRefresh: () => void }) {
  return (
    <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50 max-w-full overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 min-w-0"><h2 className="text-2xl font-bold text-white">URL Redirects ({props.redirects.length})</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto"><button type="button" onClick={props.onRefresh} className="w-full px-4 py-2 bg-emerald-700/70 hover:bg-emerald-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"><RefreshCw className="w-4 h-4" /> Refresh</button><button type="button" onClick={() => props.onOpenForm()} disabled={!props.canManage} title={!props.canManage ? ACCESS_DENIED_MESSAGE : 'Add Redirect'} className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"><Plus className="w-4 h-4" /> Add Redirect</button></div></div>
      <PermissionText allowed={props.canManage} />
      {props.state === 'loading' && <LoadingBlock label="Loading redirects..." />}
      {props.error && <ErrorBanner message={props.error} />}
      {props.testMessage && <div className="mb-4 rounded-lg bg-emerald-900/50 border border-emerald-700 p-3 text-emerald-100">{props.testMessage}</div>}
      {props.formOpen && <RedirectFormPanel {...props} />}
      {props.redirects.length === 0 && props.state !== 'loading' ? <p className="text-emerald-200 bg-emerald-900/30 rounded-lg p-4">No redirects returned by the backend.</p> : <RedirectTable {...props} />}
      {props.deleteId && <DeleteRedirectDialog onCancel={props.onDeleteCancel} onConfirm={props.onDeleteConfirm} />}
    </div>
  );
}

function RedirectFormPanel(props: Parameters<typeof RedirectsTab>[0]) {
  return (
    <div className="mb-6 rounded-lg border border-emerald-700 bg-emerald-950/30 p-4 max-w-full overflow-hidden">
      <h3 className="text-lg font-semibold text-white mb-4">{props.editingId ? 'Edit Redirect' : 'Add Redirect'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-full">
        <label className="text-sm text-emerald-200 min-w-0">Source path<input value={props.form.sourcePath} onChange={(event) => props.onFormChange({ ...props.form, sourcePath: event.target.value })} className="mt-1 w-full min-w-0 bg-emerald-950/60 border border-emerald-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder="/old-path" /></label>
        <label className="text-sm text-emerald-200 min-w-0">Destination URL/path<input value={props.form.destination} onChange={(event) => props.onFormChange({ ...props.form, destination: event.target.value })} className="mt-1 w-full min-w-0 bg-emerald-950/60 border border-emerald-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder="/new-path" /></label>
        <label className="text-sm text-emerald-200 min-w-0">Redirect type<select value={String(props.form.type)} onChange={(event) => props.onFormChange({ ...props.form, type: Number(event.target.value) as 301 | 302 })} className="mt-1 w-full min-w-0 bg-white border border-emerald-700 rounded-lg px-3 py-2 text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"><option value="301">301 Permanent</option><option value="302">302 Temporary</option></select></label>
        <label className="text-sm text-emerald-200 min-w-0">Reason<input value={props.form.reason || ''} onChange={(event) => props.onFormChange({ ...props.form, reason: event.target.value })} className="mt-1 w-full min-w-0 bg-emerald-950/60 border border-emerald-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-200" /></label>
        <label className="text-sm text-emerald-200 flex items-center gap-2"><input type="checkbox" checked={props.form.active} onChange={(event) => props.onFormChange({ ...props.form, active: event.target.checked })} className="rounded border-emerald-700 text-emerald-500 focus:ring-emerald-300" /> Active</label>
      </div>
      {props.formError && <p className="mt-3 text-sm text-red-200">{props.formError}</p>}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:max-w-sm"><button type="button" onClick={props.onSave} disabled={props.saving || !props.canManage} className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200">{props.saving ? 'Saving...' : 'Save'}</button><button type="button" onClick={props.onCloseForm} className="w-full px-4 py-2 bg-emerald-900/70 hover:bg-emerald-900 text-emerald-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200">Cancel</button></div>
    </div>
  );
}

function RedirectTable(props: Parameters<typeof RedirectsTab>[0]) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed text-sm text-left">
        <thead className="text-emerald-300">
          <tr>
            <th className="py-2 pr-4 w-[15%]">Source path</th>
            <th className="py-2 pr-4 w-[25%]">Destination</th>
            <th className="py-2 pr-4 w-[8%]">Type</th>
            <th className="py-2 pr-4 w-[10%]">Status</th>
            <th className="py-2 pr-4 w-[14%]">Created by</th>
            <th className="py-2 pr-4 w-[14%]">Updated date</th>
            <th className="py-2 pr-4 w-[14%]">Actions</th>
          </tr>
        </thead>
        <tbody className="text-emerald-50">
          {props.redirects.map((redirect) => (
            <tr key={redirect.id} className="border-t border-emerald-700/50 align-top">
              <td className="py-3 pr-4 font-mono text-emerald-200 break-all">{redirect.sourcePath}</td>
              <td className="py-3 pr-4 font-mono break-all">{redirect.destination}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{redirect.type}</td>
              <td className="py-3 pr-4 whitespace-nowrap"><StatusPill value={redirect.active ? 'active' : 'disabled'} /></td>
              <td className="py-3 pr-4 break-words">{redirect.createdBy || 'Not available'}</td>
              <td className="py-3 pr-4 whitespace-nowrap">{formatDate(redirect.updatedAt || redirect.createdAt)}</td>
              <td className="py-3 pr-4">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => props.onOpenForm(redirect)} disabled={!props.canManage} className="text-emerald-200 hover:text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-200 rounded" title="Edit"><Edit3 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => props.onToggle(redirect)} disabled={!props.canManage} className="text-emerald-200 hover:text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-200 rounded">{redirect.active ? 'Disable' : 'Enable'}</button>
                  <button type="button" onClick={() => props.onTest(redirect)} className="text-emerald-200 hover:text-white underline focus:outline-none focus:ring-2 focus:ring-emerald-200 rounded">Test Redirect</button>
                  <button type="button" onClick={() => props.onDeleteRequest(redirect.id)} disabled={!props.canDelete} className="text-red-300 hover:text-red-200 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-red-200 rounded" title={!props.canDelete ? ACCESS_DENIED_MESSAGE : 'Delete'}><Trash2 className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeleteRedirectDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="delete-redirect-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md rounded-xl border border-red-500/40 bg-emerald-950 p-6 text-white shadow-xl"><h3 id="delete-redirect-title" className="text-lg font-semibold flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-300" /> Delete redirect?</h3><p className="mt-2 text-sm text-emerald-100">This requires the delete redirects special right and will only complete after backend confirmation.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="px-4 py-2 bg-emerald-900 text-emerald-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200">Cancel</button><button type="button" onClick={onConfirm} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200">Delete</button></div></div></div>;
}

function SitemapTab(props: { state: LoadState; items: SeoSitemapItem[]; hasChecks: boolean; error: string; checking: boolean; canCheck: boolean; onCheck: () => void; onRefresh: () => void }) {
  return (
    <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"><h2 className="text-2xl font-bold text-white">Sitemap Health</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto"><button type="button" onClick={props.onRefresh} className="w-full px-4 py-2 bg-emerald-700/70 hover:bg-emerald-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"><RefreshCw className="w-4 h-4" /> Refresh</button><button type="button" onClick={props.onCheck} disabled={!props.canCheck || props.checking} title={!props.canCheck ? ACCESS_DENIED_MESSAGE : 'Check Sitemaps'} className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"><FileText className="w-4 h-4" /> {props.checking ? 'Checking...' : 'Check Sitemaps'}</button></div></div>
      <PermissionText allowed={props.canCheck} />
      {props.state === 'loading' && <LoadingBlock label="Loading sitemap status..." />}
      {props.error && <ErrorBanner message={props.error} />}
      {!props.hasChecks && props.state !== 'loading' && <div className="mb-4 rounded-lg bg-emerald-900/40 border border-emerald-700 p-4 text-emerald-100"><p className="font-semibold">No sitemap check has been run yet.</p></div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{props.items.map((item) => <div key={item.key} className="rounded-lg bg-emerald-700/30 border border-emerald-700/50 p-4 text-emerald-50 min-w-0"><div className="flex items-start justify-between gap-3 mb-3"><h3 className="text-lg font-semibold text-white">{item.label}</h3><StatusPill value={item.status.replace('_', ' ')} /></div><div className="space-y-2 text-sm"><p className="break-all">URL: <span className="text-white">{item.url || 'Not available'}</span></p><p>HTTP status: <span className="text-white">{item.httpStatus ?? 'Not available'}</span></p><p>Availability: <span className="text-white capitalize">{item.status.replace('_', ' ')}</span></p><p>Last checked: <span className="text-white">{formatDate(item.lastChecked)}</span></p><p>URL count: <span className="text-white">{formatNumber(item.urlCount)}</span></p><p>Valid count: <span className="text-white">{formatNumber(item.validUrls)}</span></p><p>Invalid count: <span className="text-white">{formatNumber(item.invalidUrls)}</span></p><p>Duplicates: <span className="text-white">{formatNumber(item.duplicateUrls)}</span></p><p>Warnings: <span className="text-white">{item.warnings.length}</span></p></div><div className="mt-4 flex flex-wrap gap-2">{item.url && <button type="button" onClick={() => safeOpenUrl(item.url)} className="text-sm text-emerald-100 hover:text-white underline focus:outline-none focus:ring-2 focus:ring-emerald-200 rounded">View File</button>}</div>{(item.warnings.length > 0 || item.issues.length > 0) && <div className="mt-4 rounded-lg bg-emerald-950/40 p-3"><p className="text-sm font-semibold text-white mb-2">Issues</p>{[...item.warnings, ...item.issues].map((message) => <p key={message} className="text-sm text-yellow-100">{message}</p>)}</div>}</div>)}</div>
    </div>
  );
}

function MetaTagsTab(props: { state: LoadState; error: string; articles: Article[]; selectedArticle: Article | null; search: string; language: string; status: string; issueFilter: string; page: number; pages: number; onSearch: (value: string) => void; onLanguage: (value: string) => void; onStatus: (value: string) => void; onIssueFilter: (value: string) => void; onPage: (page: number) => void; onSelectArticle: (article: Article) => void; onRefresh: () => void }) {
  return (
    <div className="bg-emerald-800/30 backdrop-blur-sm rounded-xl p-6 border border-emerald-700/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Meta Tags Analyzer</h2>
        <button type="button" onClick={props.onRefresh} className="px-4 py-2 bg-emerald-700/70 hover:bg-emerald-700 text-white rounded-lg font-medium transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search title or slug" className="bg-emerald-950/60 border border-emerald-700 rounded-lg px-3 py-2 text-white placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
        <select aria-label="Language filter" value={props.language} onChange={(event) => props.onLanguage(event.target.value)} className={readableSelectClass}>
          {LANGUAGE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label="Publication status filter" value={props.status} onChange={(event) => props.onStatus(event.target.value)} className={readableSelectClass}>
          {PUBLICATION_STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label="SEO status filter" value={props.issueFilter} onChange={(event) => props.onIssueFilter(event.target.value)} className={readableSelectClass}>
          {SEO_STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {props.state === 'loading' && <LoadingBlock label="Loading real News Pulse articles..." />}
      {props.error && <ErrorBanner message={props.error} />}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5"><div className="space-y-3">{props.articles.length === 0 && props.state !== 'loading' ? <p className="text-emerald-200 bg-emerald-900/30 rounded-lg p-4">No matching articles found</p> : props.articles.map((article) => <ArticleMetaRow key={article._id} article={article} onSelect={props.onSelectArticle} />)}<Pager page={props.page} pages={props.pages} label={`${props.articles.length} articles shown`} onPage={props.onPage} /></div><ArticleSeoDetails article={props.selectedArticle} /></div>
    </div>
  );
}

function ArticleMetaRow({ article, onSelect }: { article: Article; onSelect: (article: Article) => void }) {
  const issueCount = getArticleIssueCount(article);
  const publicUrl = getArticlePublicUrl(article);
  const seo = getArticleSeo(article);
  const score = typeof seo.score === 'number' ? `${seo.score}/100` : (seo.status || 'Not analyzed');
  return <div className="rounded-lg bg-emerald-700/30 border border-emerald-700/50 p-4 text-emerald-50"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3"><div><h3 className="font-semibold text-white">{article.title}</h3><p className="text-sm text-emerald-200">{article.language || article.lang || 'Language not available'} | {article.status || 'Status not available'}</p><p className="text-sm text-emerald-300 break-all">{publicUrl || 'Public URL not available'}</p><p className="text-sm mt-2">SEO score/status: <span className="text-white">{score}</span></p><p className="text-sm">Issue count: <span className="text-white">{issueCount === null ? 'Not analyzed' : issueCount}</span></p></div><button type="button" onClick={() => onSelect(article)} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-200">Analyze/View Details</button></div></div>;
}

function ArticleSeoDetails({ article }: { article: Article | null }) {
  if (!article) return <div className="rounded-lg bg-emerald-900/30 border border-emerald-700/50 p-5 text-emerald-200">Select an article to view backend SEO metadata.</div>;
  const seo = getArticleSeo(article);
  const anyArticle = article as any;
  const publicUrl = getArticlePublicUrl(article);
  const seoTitle = getSeoField(article, 'seoTitle', 'titleTag', 'metaTitle');
  const description = getSeoField(article, 'metaDescription', 'description') || article.description || article.summary || '';
  const canonical = getSeoField(article, 'canonicalUrl', 'canonical') || getArticlePublicUrl(article);
  const issues = Array.isArray(seo.issues) ? seo.issues : [];
  const recommendations = Array.isArray(seo.recommendations) ? seo.recommendations : [];
  const rows = [['Article title', article.title], ['Slug', anyArticle.slug], ['Language', normalizeArticleLanguageCode(article) || article.language || anyArticle.lang], ['Publication status', normalizeArticlePublicationStatus(article) || article.status], ['Public URL', publicUrl], ['SEO title', seoTitle], ['Title length', seoTitle ? `${seoTitle.length} characters` : 'Missing'], ['Meta description', description], ['Description length', description ? `${description.length} characters` : 'Missing'], ['Canonical URL', canonical], ['Robots value', getSeoField(article, 'robots')], ['Open Graph title', getSeoField(article, 'ogTitle', 'openGraphTitle')], ['Open Graph description', getSeoField(article, 'ogDescription', 'openGraphDescription')], ['Open Graph image', getSeoField(article, 'ogImage', 'openGraphImage')], ['Twitter/X metadata', getSeoField(article, 'twitterTitle', 'twitterCard')], ['Structured-data status', getSeoField(article, 'structuredDataStatus', 'schemaStatus')], ['Image alt status', getSeoField(article, 'imageAltStatus', 'altStatus')]];
  return <div className="rounded-lg bg-emerald-700/30 border border-emerald-700/50 p-5 text-emerald-50"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"><h3 className="text-xl font-semibold text-white">Article SEO Details</h3>{publicUrl && <button type="button" onClick={() => safeOpenUrl(publicUrl)} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-200">Open Public URL</button>}</div><div className="space-y-3">{rows.map(([label, value]) => <div key={label} className="border-b border-emerald-700/40 pb-2"><p className="text-sm text-emerald-300">{label}</p><p className="text-sm text-white break-words">{missingText(value)}</p></div>)}</div><div className="mt-5"><h4 className="font-semibold text-white mb-2">Detected issues</h4>{issues.length === 0 ? <p className="text-sm text-emerald-200">No article-level SEO issues returned by backend.</p> : issues.map((issue: any, index: number) => <p key={index} className="text-sm text-yellow-100">{String(issue?.title || issue?.message || issue)}</p>)}</div><div className="mt-5"><h4 className="font-semibold text-white mb-2">Recommendations</h4>{recommendations.length === 0 ? <p className="text-sm text-emerald-200">No backend recommendations returned.</p> : recommendations.map((item: any, index: number) => <p key={index} className="text-sm text-emerald-100">{String(item?.title || item?.message || item)}</p>)}</div></div>;
}

function StatusPill({ value }: { value: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${statusClass(value)}`}>{value}</span>;
}

function LoadingBlock({ label }: { label: string }) {
  return <div className="bg-emerald-900/30 rounded-xl p-8 text-center mb-4"><div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-400 border-t-transparent mx-auto mb-4" /><p className="text-emerald-200">{label}</p></div>;
}

function ErrorBanner({ message, previous }: { message: string; previous?: boolean }) {
  return <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-100 flex gap-3"><AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" /><div><p>{message}</p>{previous && <p className="text-sm mt-1">Showing previous results until a fresh request succeeds.</p>}</div></div>;
}

function Pager({ page, pages, label, onPage }: { page: number; pages: number; label: string; onPage: (page: number) => void }) {
  return <div className="flex items-center justify-between gap-3 mt-4 text-sm text-emerald-200"><span>{label}</span><div className="flex items-center gap-2"><button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 rounded bg-emerald-900/60 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-200">Previous</button><span>Page {page} of {pages}</span><button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages} className="px-3 py-1 rounded bg-emerald-900/60 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-200">Next</button></div></div>;
}

function missingText(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text || 'Missing';
}