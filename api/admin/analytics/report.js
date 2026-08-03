import { jwtVerify } from 'jose';

const ACCESS_DENIED_MESSAGE = 'Access Denied. Founder permission is required.';
const NOT_CONFIGURED_MESSAGE = 'Connect an approved analytics provider to display real News Pulse traffic and performance data. No placeholder or sample information is being displayed.';
const ANALYTICS_RIGHTS = {
  traffic: 'analytics.view_traffic',
  adPerformance: 'analytics.view_ad_performance',
  revenue: 'analytics.view_revenue',
  refresh: 'analytics.refresh',
  export: 'analytics.export',
};

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  String(header).split(';').forEach((cookie) => {
    const [key, ...rest] = cookie.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeRole(role) {
  const raw = String(role || '').trim().toLowerCase();
  const normalized = raw.replace(/[\s/-]+/g, '_');
  const aliases = {
    owner: 'founder',
    ads_revenue_manager: 'ads_revenue_growth_manager',
    'ads_&_revenue_growth_manager': 'ads_revenue_growth_manager',
    finance_accounts_manager: 'finance_accounts_manager',
    'finance_&_accounts_manager': 'finance_accounts_manager',
  };
  return aliases[raw] || aliases[normalized] || normalized;
}

function defaultRightsForRole(role) {
  if (role === 'founder' || role === 'admin') return Object.values(ANALYTICS_RIGHTS);
  if (role === 'ads_revenue_growth_manager') return [ANALYTICS_RIGHTS.traffic, ANALYTICS_RIGHTS.adPerformance];
  if (role === 'finance_accounts_manager') return [ANALYTICS_RIGHTS.revenue];
  if (role === 'manager' || role === 'editor' || role === 'social_media_manager') return [ANALYTICS_RIGHTS.traffic];
  return [];
}

function getPayloadRole(payload) {
  return normalizeRole(payload?.role || payload?.user?.role || payload?.data?.user?.role || '');
}

function getPayloadEmail(payload) {
  return String(payload?.email || payload?.user?.email || payload?.data?.user?.email || '').trim().toLowerCase();
}

function getPayloadRights(payload) {
  return toArray(payload?.specialRights || payload?.rights || payload?.access?.specialRights || payload?.accessControl?.specialRights || payload?.roleAccess?.specialRights || payload?.permissions);
}

function getPayloadModules(payload) {
  return toArray(payload?.moduleAccess || payload?.moduleAccessKeys || payload?.modules || payload?.access?.modules || payload?.accessControl?.modules || payload?.roleAccess?.modules);
}

function hasFounderEmail(email) {
  const configured = String(process.env.FOUNDER_EMAIL || process.env.ADMIN_FOUNDER_EMAIL || '').trim().toLowerCase();
  return Boolean(configured && email && configured === email);
}

function permissionSetFor(payload) {
  const role = getPayloadRole(payload);
  const email = getPayloadEmail(payload);
  const modules = getPayloadModules(payload);
  const explicitRights = getPayloadRights(payload);
  const founder = role === 'founder' || hasFounderEmail(email);
  const rights = new Set(founder ? Object.values(ANALYTICS_RIGHTS) : [...defaultRightsForRole(role), ...explicitRights]);
  const hasAnalyticsModule = founder || modules.length === 0 || modules.includes('analytics');

  return {
    role: founder ? 'founder' : role,
    email,
    viewTraffic: hasAnalyticsModule && rights.has(ANALYTICS_RIGHTS.traffic),
    viewAdPerformance: hasAnalyticsModule && rights.has(ANALYTICS_RIGHTS.adPerformance),
    viewRevenue: hasAnalyticsModule && rights.has(ANALYTICS_RIGHTS.revenue),
    refresh: hasAnalyticsModule && rights.has(ANALYTICS_RIGHTS.refresh),
    export: hasAnalyticsModule && rights.has(ANALYTICS_RIGHTS.export),
  };
}

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

function audit(action, context) {
  const entry = {
    action,
    actor: context.email || 'unknown',
    role: context.role || 'unknown',
    range: context.range,
    ip: context.ip,
    ts: new Date().toISOString(),
  };
  console.info('[ANALYTICS_AUDIT]', JSON.stringify(entry));
}

async function authenticate(req, res) {
  const mockOn = String(process.env.VITE_USE_MOCK || process.env.USE_MOCK || '').toLowerCase() === 'true';
  if (mockOn) {
    return { role: normalizeRole(req.headers['x-role'] || 'founder'), email: String(req.headers['x-email'] || process.env.FOUNDER_EMAIL || '') };
  }

  const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const cookies = parseCookies(req.headers.cookie);
  const token = bearer || cookies.np_admin;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const secretValue = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret');
  if (!secretValue) {
    res.status(500).json({ error: 'Analytics auth is not configured' });
    return null;
  }

  try {
    const secret = new TextEncoder().encode(secretValue);
    try {
      const { payload } = await jwtVerify(token, secret, { audience: 'admin', issuer: 'newspulse' });
      return payload;
    } catch {
      const { payload } = await jwtVerify(token, secret);
      return payload;
    }
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
    return null;
  }
}

function integrationState(envKey, sourceKey) {
  const provider = String(process.env[sourceKey] || '').trim();
  const configured = String(process.env[envKey] || '').trim().toLowerCase() === 'true';
  if (configured && provider) return { status: 'configuration_required', source: provider, message: 'Provider credentials are configured, but data ingestion is not wired in this endpoint yet.' };
  if (provider) return { status: 'configuration_required', source: provider };
  return { status: 'not_connected', source: null };
}

export default async function handler(req, res) {
  setNoStore(res);

  if ((req.method || 'GET').toUpperCase() === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = await authenticate(req, res);
  if (!payload) return;

  const permissions = permissionSetFor(payload);
  const hasAnyView = permissions.viewTraffic || permissions.viewAdPerformance || permissions.viewRevenue;
  if (!hasAnyView) {
    return res.status(403).json({ error: ACCESS_DENIED_MESSAGE });
  }

  if (req.query.refresh === '1' && !permissions.refresh) {
    return res.status(403).json({ error: ACCESS_DENIED_MESSAGE });
  }

  if (req.query.export === '1' && !permissions.export) {
    return res.status(403).json({ error: ACCESS_DENIED_MESSAGE });
  }

  const range = String(req.query.range || 'today');
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || undefined;
  if (req.query.refresh === '1') audit('analytics.refresh', { ...permissions, range, ip });
  if (permissions.viewRevenue) audit('analytics.view_revenue', { ...permissions, range, ip });
  if (req.query.export === '1') audit('analytics.export_attempt', { ...permissions, range, ip });

  return res.status(200).json({
    ok: true,
    range,
    analyticsState: 'not_configured',
    dataSourceName: 'Not connected',
    lastUpdatedAt: null,
    message: NOT_CONFIGURED_MESSAGE,
    permissions: {
      viewTraffic: permissions.viewTraffic,
      viewAdPerformance: permissions.viewAdPerformance,
      viewRevenue: permissions.viewRevenue,
      refresh: permissions.refresh,
      export: permissions.export,
    },
    integrations: {
      trafficAnalytics: integrationState('ANALYTICS_TRAFFIC_ENABLED', 'ANALYTICS_TRAFFIC_PROVIDER'),
      adTracking: integrationState('ANALYTICS_AD_TRACKING_ENABLED', 'ANALYTICS_AD_TRACKING_PROVIDER'),
      financeData: integrationState('ANALYTICS_FINANCE_ENABLED', 'ANALYTICS_FINANCE_PROVIDER'),
    },
    overview: {
      pageViews: null,
      uniqueVisitors: null,
      adImpressions: null,
      adClicks: null,
      ctr: null,
      estimatedAdRevenue: null,
      confirmedRevenue: null,
    },
    adPerformance: {
      campaigns: [],
      devicePerformance: [],
      placementPerformance: [],
      recommendations: [],
    },
  });
}
