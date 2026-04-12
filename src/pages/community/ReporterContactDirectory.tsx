import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ReporterProfileDrawer from '../../components/community/ReporterProfileDrawer';
import ReporterStoriesDrawer from '@/components/community/ReporterStoriesDrawer';
import { useAuth } from '@/context/AuthContext';
import {
  bulkDeleteReporterContacts,
  bulkHideReporterContacts,
  bulkRestoreReporterContacts,
  listReporterContactsAll,
  type RebuildReporterDirectoryResult,
  type ReporterContactListStats,
  type ReporterRequestTrace,
  rebuildReporterDirectory,
  type ReporterContact,
} from '@/lib/api/reporterDirectory';

type DirectoryTab = 'table';
type DirectoryView = 'active' | 'removed';
type ProfileTab = 'overview' | 'contact' | 'coverage' | 'stories' | 'notes' | 'tasks' | 'activity';
type DirectoryRow = ReporterContact & { contactId: string; directoryStatus: 'active' | 'removed' };

const ALL_OPTION = 'all';
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export default function ReporterContactDirectory() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = String(user?.role || '').trim().toLowerCase();
  const canManage = role === 'founder' || role === 'admin';

  const directoryTab: DirectoryTab = 'table';
  const [directoryView, setDirectoryView] = useState<DirectoryView>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'archived'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'community' | 'journalist'>('all');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'pending' | 'limited' | 'revoked' | 'unverified' | 'community default'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive' | 'new' | 'on_leave' | 'blacklisted'>('all');
  const [countryFilter, setCountryFilter] = useState(ALL_OPTION);
  const [stateFilter, setStateFilter] = useState(ALL_OPTION);
  const [cityFilter, setCityFilter] = useState(ALL_OPTION);
  const [districtFilter, setDistrictFilter] = useState(ALL_OPTION);
  const [beatFilter, setBeatFilter] = useState(ALL_OPTION);
  const [areaTypeFilter, setAreaTypeFilter] = useState<'all' | 'metro' | 'corporation' | 'district_hq' | 'taluka' | 'village' | 'other'>('all');
  const [missingDataFilter, setMissingDataFilter] = useState<'all' | 'unresolved_identity' | 'missing_email' | 'missing_phone' | 'missing_location' | 'no_stories' | 'inactive_30' | 'inactive_60' | 'inactive_90'>('all');
  const [hasNotesOnly, setHasNotesOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedReporter, setSelectedReporter] = useState<ReporterContact | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');
  const [storiesTarget, setStoriesTarget] = useState<ReporterContact | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const lastAutoResetSearchRef = useRef('');
  const [latestRebuildResult, setLatestRebuildResult] = useState<RebuildReporterDirectoryResult | null>(null);

  const fetchDirectoryStateSnapshot = async () => {
    const [active, removed] = await Promise.all([
      listReporterContactsAll({ limit: 500 }, { includeSubmissionFallback: true, view: 'active' }),
      listReporterContactsAll({ limit: 500 }, { view: 'removed' }),
    ]);
    return {
      active,
      removed,
    };
  };

  const directoryStateQuery = useQuery({
    queryKey: ['reporter-contacts', 'directory-state', refreshTick],
    queryFn: fetchDirectoryStateSnapshot,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });

  const activeDirectorySnapshot = directoryStateQuery.data?.active;
  const removedDirectorySnapshot = directoryStateQuery.data?.removed;
  const directoryQuery = directoryStateQuery;

  const activeRows = useMemo(() => {
    const rows = ((activeDirectorySnapshot?.items || activeDirectorySnapshot?.rows || (activeDirectorySnapshot as any)?.contacts || []) as ReporterContact[]) || [];
    const normalized = rows.map((row) => normalizeDirectoryRow(row, 'active')).filter(Boolean) as DirectoryRow[];
    return normalized.filter((row) => row.directoryStatus === 'active');
  }, [activeDirectorySnapshot]);

  const removedRows = useMemo(() => {
    const rows = ((removedDirectorySnapshot?.items || removedDirectorySnapshot?.rows || (removedDirectorySnapshot as any)?.contacts || []) as ReporterContact[]) || [];
    const normalized = rows.map((row) => normalizeDirectoryRow(row, 'removed')).filter(Boolean) as DirectoryRow[];
    return normalized.filter((row) => row.directoryStatus === 'removed');
  }, [removedDirectorySnapshot]);

  const activeRequestTrace = activeDirectorySnapshot?.requestTrace as ReporterRequestTrace | undefined;
  const removedRequestTrace = removedDirectorySnapshot?.requestTrace as ReporterRequestTrace | undefined;
  const activeReturnedStats = activeDirectorySnapshot?.stats as ReporterContactListStats | undefined;
  const removedReturnedStats = removedDirectorySnapshot?.stats as ReporterContactListStats | undefined;
  const activeFilters = useMemo(() => {
    return {
      searchQuery: searchQuery.trim(),
      status: statusFilter,
      type: typeFilter,
      verification: verificationFilter,
      activity: activityFilter,
      country: countryFilter,
      state: stateFilter,
      city: cityFilter,
      district: districtFilter,
      beat: beatFilter,
      areaType: areaTypeFilter,
      missingData: missingDataFilter,
      hasNotesOnly,
      tab: directoryTab,
      view: directoryView,
    };
  }, [activityFilter, areaTypeFilter, beatFilter, cityFilter, countryFilter, directoryTab, directoryView, districtFilter, hasNotesOnly, missingDataFilter, searchQuery, stateFilter, statusFilter, typeFilter, verificationFilter]);

  const globalRows = useMemo(() => {
    const merged = new Map<string, DirectoryRow>();
    [...removedRows, ...activeRows].forEach((row) => {
      const key = row.contactId || row.id;
      if (!key) return;
      const existing = merged.get(key);
      if (!existing || row.directoryStatus === 'active') {
        merged.set(key, row);
      }
    });
    return Array.from(merged.values());
  }, [activeRows, removedRows]);

  const globalSummary = useMemo(() => {
    return {
      ...buildSummary(globalRows),
      totalReporters: activeRows.length + removedRows.length,
    };
  }, [activeRows.length, globalRows, removedRows.length]);

  const pageState = useMemo(() => {
    const currentRows = directoryView === 'removed' ? removedRows : activeRows;
    const query = searchQuery.trim().toLowerCase();

    const filteredRows = currentRows.filter((row) => {
      const normalizedStatus = normalizeStatus(row.status);
      const normalizedVerification = normalizeVerification(row.verificationLevel);
      const normalizedType = String(row.reporterType || '').trim().toLowerCase() || 'unknown';
      const normalizedActivity = normalizeActivity(row);

      if (directoryView === 'active') {
        if (row.directoryStatus === 'removed' || normalizedStatus === 'archived') return false;
        if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
      } else if (row.directoryStatus !== 'removed' && normalizedStatus !== 'archived') {
        return false;
      }
      if (typeFilter !== 'all' && normalizedType !== typeFilter) return false;
      if (verificationFilter !== 'all' && normalizedVerification !== verificationFilter) return false;
      if (activityFilter !== 'all' && normalizedActivity !== activityFilter) return false;
      if (countryFilter !== ALL_OPTION && !compareText(row.country, countryFilter)) return false;
      if (stateFilter !== ALL_OPTION && !compareText(row.state, stateFilter)) return false;
      if (cityFilter !== ALL_OPTION && !compareText(row.city, cityFilter)) return false;
      if (districtFilter !== ALL_OPTION && !compareText((row as any).district, districtFilter)) return false;
      if (beatFilter !== ALL_OPTION && !hasBeat(row, beatFilter)) return false;
      if (areaTypeFilter !== 'all' && String((row as any).areaType || '').trim().toLowerCase() !== areaTypeFilter) return false;
      if (hasNotesOnly && !hasValue(row.notes)) return false;
      if (missingDataFilter === 'unresolved_identity' && !missingIdentity(row)) return false;
      if (missingDataFilter === 'missing_email' && hasValue(row.email)) return false;
      if (missingDataFilter === 'missing_phone' && hasValue(row.phone)) return false;
      if (missingDataFilter === 'missing_location' && hasLocation(row)) return false;
      if (missingDataFilter === 'no_stories' && Number(row.totalStories || 0) > 0) return false;
      if (missingDataFilter === 'inactive_30' && daysSince(row.lastSubmissionAt || row.lastStoryAt) < 30) return false;
      if (missingDataFilter === 'inactive_60' && daysSince(row.lastSubmissionAt || row.lastStoryAt) < 60) return false;
      if (missingDataFilter === 'inactive_90' && daysSince(row.lastSubmissionAt || row.lastStoryAt) < 90) return false;
      if (query) {
        const haystack = [
          row.name,
          row.email,
          row.phone,
          row.whatsapp,
          row.city,
          (row as any).district,
          row.state,
          row.country,
          row.reporterKey,
        ].map((value) => String(value || '').toLowerCase()).join(' ');
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const sortedRows = [...filteredRows].sort((left, right) => {
      const rightTime = storyTimestamp(right);
      const leftTime = storyTimestamp(left);
      if (rightTime !== leftTime) return rightTime - leftTime;
      return String(left.name || left.email || '').localeCompare(String(right.name || right.email || ''));
    });

    return {
      activeCount: activeRows.length,
      removedCount: removedRows.length,
      globalSummary,
      currentRows,
      filteredRows,
      sortedRows,
      requestTrace: directoryView === 'removed' ? removedRequestTrace : activeRequestTrace,
      returnedStats: directoryView === 'removed' ? removedReturnedStats : activeReturnedStats,
    };
  }, [activeRequestTrace, activeReturnedStats, activeRows, activityFilter, areaTypeFilter, beatFilter, cityFilter, countryFilter, directoryView, districtFilter, globalSummary, hasNotesOnly, missingDataFilter, removedRequestTrace, removedReturnedStats, removedRows, searchQuery, stateFilter, statusFilter, typeFilter, verificationFilter]);

  const reporters = pageState.currentRows;
  const sortedRows = pageState.sortedRows;
  const summary = pageState.globalSummary;
  const requestTrace = pageState.requestTrace;
  const returnedStats = pageState.returnedStats;
  const activeCount = pageState.activeCount;
  const removedCount = pageState.removedCount;
  const currentItemCount = reporters.length;
  const currentCountLabel = `${sortedRows.length} ${directoryView}`;

  const countries = useMemo(() => optionize(uniqueValues(reporters.map((row) => row.country)), 'All countries'), [reporters]);
  const states = useMemo(() => {
    const source = countryFilter === ALL_OPTION ? reporters : reporters.filter((row) => compareText(row.country, countryFilter));
    return optionize(uniqueValues(source.map((row) => row.state)), 'All states');
  }, [countryFilter, reporters]);
  const cities = useMemo(() => {
    const source = reporters.filter((row) => {
      if (countryFilter !== ALL_OPTION && !compareText(row.country, countryFilter)) return false;
      if (stateFilter !== ALL_OPTION && !compareText(row.state, stateFilter)) return false;
      return true;
    });
    return optionize(uniqueValues(source.map((row) => row.city)), 'All cities');
  }, [countryFilter, reporters, stateFilter]);
  const districts = useMemo(() => {
    const source = reporters.filter((row) => {
      if (countryFilter !== ALL_OPTION && !compareText(row.country, countryFilter)) return false;
      if (stateFilter !== ALL_OPTION && !compareText(row.state, stateFilter)) return false;
      return true;
    });
    return optionize(uniqueValues(source.map((row) => String((row as any).district || '').trim())), 'All districts');
  }, [countryFilter, reporters, stateFilter]);
  const beats = useMemo(() => {
    const values = new Set<string>();
    reporters.forEach((row) => {
      const items = Array.isArray((row as any).beatsProfessional) ? (row as any).beatsProfessional : [];
      items.forEach((value: string) => {
        const clean = String(value || '').trim();
        if (clean) values.add(clean);
      });
    });
    return optionize(Array.from(values).sort((left, right) => left.localeCompare(right)), 'All beats');
  }, [reporters]);

  useEffect(() => {
    if (!isSelectableValue(countryFilter)) return;
    if (!countries.some((option) => option.value === countryFilter)) {
      setCountryFilter(ALL_OPTION);
    }
  }, [countries, countryFilter]);

  useEffect(() => {
    if (!isSelectableValue(stateFilter)) return;
    if (!states.some((option) => option.value === stateFilter)) {
      setStateFilter(ALL_OPTION);
    }
  }, [stateFilter, states]);

  useEffect(() => {
    if (!isSelectableValue(cityFilter)) return;
    if (!cities.some((option) => option.value === cityFilter)) {
      setCityFilter(ALL_OPTION);
    }
  }, [cities, cityFilter]);

  useEffect(() => {
    if (!isSelectableValue(districtFilter)) return;
    if (!districts.some((option) => option.value === districtFilter)) {
      setDistrictFilter(ALL_OPTION);
    }
  }, [districtFilter, districts]);

  useEffect(() => {
    if (!isSelectableValue(beatFilter)) return;
    if (!beats.some((option) => option.value === beatFilter)) {
      setBeatFilter(ALL_OPTION);
    }
  }, [beatFilter, beats]);

  useEffect(() => {
    if (!selectedReporter) return;
    const match = reporters.find((row) => row.id === selectedReporter.id) || reporters.find((row) => sameReporter(row, selectedReporter));
    if (!match) {
      if (profileOpen) return;
      setSelectedReporter(null);
      return;
    }
    if (match !== selectedReporter) {
      setSelectedReporter(match);
    }
  }, [profileOpen, reporters, selectedReporter]);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(location.search || '');
      const query = String(searchParams.get('q') || '').trim();
      const reporterKey = String(searchParams.get('reporterKey') || '').trim().toLowerCase();
      const shouldOpen = String(searchParams.get('open') || '').trim() === '1';
      if (searchParams.has('q')) {
        setSearchQuery(query);
      }
      if (!shouldOpen || !reporterKey) return;
      const match = reporters.find((row) => {
        return [row.id, row.reporterKey, row.email, row.phone]
          .map((value) => String(value || '').trim().toLowerCase())
          .includes(reporterKey);
      });
      if (match) {
        setSelectedReporter(match);
        setProfileTab('overview');
        setProfileOpen(true);
      }
    } catch {
      // ignore invalid query state
    }
  }, [location.search, reporters]);

  const selectableRows = useMemo(() => {
    if (!canManage) return [] as DirectoryRow[];
    return sortedRows.filter((row) => !!row.contactId);
  }, [canManage, sortedRows]);

  const selectedRows = useMemo(() => {
    if (!selectedIds.size) return [] as DirectoryRow[];
    return sortedRows.filter((row) => selectedIds.has(row.contactId));
  }, [selectedIds, sortedRows]);

  const selectedCount = selectedRows.length;
  const allVisibleSelectableSelected = selectableRows.length > 0 && selectableRows.every((row) => selectedIds.has(row.contactId));
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search || '');
    const urlQuery = String(searchParams.get('q') || '').trim();
    const hasOnlyUrlSearchFilter = Boolean(urlQuery)
      && statusFilter === 'all'
      && typeFilter === 'all'
      && verificationFilter === 'all'
      && activityFilter === 'all'
      && countryFilter === ALL_OPTION
      && stateFilter === ALL_OPTION
      && cityFilter === ALL_OPTION
      && districtFilter === ALL_OPTION
      && beatFilter === ALL_OPTION
      && areaTypeFilter === 'all'
      && missingDataFilter === 'all'
      && !hasNotesOnly;

    if (!hasOnlyUrlSearchFilter) return;
    if (!reporters.length || sortedRows.length > 0) return;
    if (lastAutoResetSearchRef.current === urlQuery) return;

    lastAutoResetSearchRef.current = urlQuery;
    setSearchQuery('');

    const nextParams = new URLSearchParams(location.search || '');
    nextParams.delete('q');
    nextParams.delete('open');
    nextParams.delete('reporterKey');
    navigate({ pathname: location.pathname, search: nextParams.toString() ? `?${nextParams.toString()}` : '' }, { replace: true });

    if (isLocalhostRuntime()) {
      console.info('[ReporterContactDirectory] cleared stale URL search filter', {
        staleQuery: urlQuery,
        backendRowCount: reporters.length,
      });
    }
  }, [activityFilter, areaTypeFilter, beatFilter, cityFilter, countryFilter, directoryTab, districtFilter, hasNotesOnly, location.pathname, location.search, missingDataFilter, navigate, reporters.length, sortedRows.length, stateFilter, statusFilter, typeFilter, verificationFilter]);

  useEffect(() => {
    setSelectedIds((current) => {
      if (!current.size) return current;
      const visibleIds = new Set(selectableRows.map((row) => row.contactId));
      const next = new Set(Array.from(current).filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [selectableRows]);

  const refreshDirectory = async () => {
    await queryClient.cancelQueries({ queryKey: ['reporter-contacts'] });
    queryClient.removeQueries({ queryKey: ['reporter-contacts'] });
    const nextTick = Date.now();
    const snapshot = await queryClient.fetchQuery({
      queryKey: ['reporter-contacts', 'directory-state', nextTick],
      queryFn: fetchDirectoryStateSnapshot,
      staleTime: 0,
    });
    setRefreshTick(nextTick);
    return {
      active: snapshot.active,
      removed: snapshot.removed,
      current: directoryView === 'removed' ? snapshot.removed : snapshot.active,
    };
  };

  const buildBulkActionSelection = (rows: ReporterContact[], action: 'hide' | 'restore' | 'delete') => {
    const selectedRows = rows.map((row) => ({
      rawRow: row,
      normalizedRow: normalizeDirectoryRow(row),
    }));
    const ids = selectedRows.map(({ normalizedRow }) => String(normalizedRow?.contactId || '').trim()).filter(Boolean);
    const contributorIds = selectedRows
      .map(({ normalizedRow }) => String(normalizedRow?.contributorId || '').trim())
      .filter(Boolean);
    const reporterKeys = selectedRows
      .map(({ normalizedRow }) => String(normalizedRow?.reporterKey || '').trim())
      .filter(Boolean);
    const emails = selectedRows
      .map(({ normalizedRow }) => String(normalizedRow?.email || '').trim())
      .filter(Boolean);
    const payload = {
      ids,
      contactIds: ids,
      selectedContactIds: ids,
      contributorIds,
      reporterKeys,
      emails,
      sourceView: directoryView,
      ...(action === 'delete'
        ? {
            permanent: true,
            hardDelete: true,
            confirmPermanentDelete: true,
            action: 'delete-permanently',
          }
        : action === 'restore'
          ? { action: 'restore' }
          : { action: 'hide' }),
    };

    if (isLocalhostRuntime()) {
      console.info(`[reporter-bulk-${action}]`, {
        selectedRows,
        ids,
        payload,
      });
    }

    if (ids.length === 0) {
      throw new Error('No valid ReporterContact ids found in the selected rows');
    }
    if (ids.length !== rows.length) {
      throw new Error('Some selected rows do not have a valid ReporterContact id');
    }

    return payload;
  };

  const rebuildMutation = useMutation({
    mutationFn: rebuildReporterDirectory,
    onSuccess: async (result) => {
      setLatestRebuildResult(result);
      toast.success(result.message || 'Directory rebuild completed');
      setRebuildOpen(false);
      const snapshot = await refreshDirectory();

      if (isLocalhostRuntime()) {
        console.info('[ReporterContactDirectory] rebuild result', {
          requestUrl: result.requestUrl || '',
          statusCode: result.statusCode ?? null,
          responseBody: result.responseBody ?? null,
          endpointUsed: result.endpointUsed || '',
          postRebuildActiveCount: snapshot.active.rows?.length ?? snapshot.active.items?.length ?? 0,
          postRebuildRemovedCount: snapshot.removed.rows?.length ?? snapshot.removed.items?.length ?? 0,
          postRebuildRequestUrl: snapshot.current.requestTrace?.requestUrl || '',
        });
      }
    },
    onError: (error: any) => {
      if (isLocalhostRuntime()) {
        console.info('[ReporterContactDirectory] rebuild failed', {
          requestUrl: error?.requestUrl || '',
          statusCode: error?.statusCode ?? error?.status ?? null,
          responseBody: error?.responseBody ?? error?.response?.data ?? null,
        });
      }
      toast.error(error?.message || 'Failed to rebuild directory');
    },
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: async (rows: ReporterContact[]) => {
      const selection = buildBulkActionSelection(rows, 'hide');
      await bulkHideReporterContacts(selection.ids);
      return { total: rows.length, successCount: rows.length, failures: [] as PromiseRejectedResult[] };
    },
    onSuccess: async (result) => {
      setBulkRemoveOpen(false);
      setSelectedIds(new Set());
      await refreshDirectory();

      if (result.failures.length === 0) {
        toast.success(result.successCount === 1 ? 'Removed 1 contact from Directory' : `Removed ${result.successCount} contacts from Directory`);
        return;
      }

      if (result.successCount > 0) {
        toast.error(`Removed ${result.successCount} contacts, ${result.failures.length} failed`);
        return;
      }

      const firstFailure = result.failures[0]?.reason as any;
      toast.error(firstFailure?.message || 'Failed to remove selected contacts');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to remove selected contacts');
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: async (rows: ReporterContact[]) => {
      const selection = buildBulkActionSelection(rows, 'restore');
      await bulkRestoreReporterContacts(selection);
      return { total: rows.length, successCount: rows.length, failures: [] as PromiseRejectedResult[] };
    },
    onSuccess: async (result) => {
      setBulkRestoreOpen(false);
      setSelectedIds(new Set());
      await refreshDirectory();

      if (result.failures.length === 0) {
        toast.success(result.successCount === 1 ? 'Restored 1 contact to the directory' : `Restored ${result.successCount} contacts to the directory`);
        return;
      }

      if (result.successCount > 0) {
        toast.error(`Restored ${result.successCount} contacts, ${result.failures.length} failed`);
        return;
      }

      const firstFailure = result.failures[0]?.reason as any;
      toast.error(firstFailure?.message || 'Failed to restore selected contacts');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to restore selected contacts');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (rows: ReporterContact[]) => {
      const selection = buildBulkActionSelection(rows, 'delete');
      const result = await bulkDeleteReporterContacts(selection);
      return {
        total: rows.length,
        successCount: Number(result.deletedCount ?? result.deleted ?? 0) || 0,
        failures: (result.failures || []).map((failure) => ({ reason: failure })) as PromiseRejectedResult[],
        failedIds: result.failedIds || [],
        missingIds: result.missingIds || [],
        invalidStateIds: result.invalidStateIds || [],
      };
    },
    onSuccess: async (result) => {
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      await refreshDirectory();

      if (result.failures.length === 0) {
        toast.success(result.successCount === 1 ? 'Permanently deleted 1 contact' : `Permanently deleted ${result.successCount} contacts`);
        return;
      }

      if (result.successCount > 0) {
        toast.error(`Deleted ${result.successCount} contacts, ${result.failures.length} failed`);
        return;
      }

      const firstFailure = result.failures[0]?.reason as any;
      toast.error(firstFailure?.message || 'Failed to permanently delete selected contacts');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to permanently delete selected contacts');
    },
  });

  useEffect(() => {
    if (!isLocalhostRuntime() || !requestTrace) return;
    console.info('[reporter-directory-sync]', {
      view: directoryView,
      activeCount,
      removedCount,
      stats: summary,
      itemCount: currentItemCount,
      visibleCount: sortedRows.length,
      requestUrl: requestTrace.requestUrl || '',
      queryParams: requestTrace.queryParams || {},
      viewStats: returnedStats ?? null,
      activeFilters,
    });
  }, [activeCount, activeFilters, currentItemCount, directoryView, removedCount, requestTrace, returnedStats, sortedRows.length, summary]);

  useEffect(() => {
    if (!isLocalhostRuntime() || !latestRebuildResult) return;
    console.info('[ReporterContactDirectory] latest rebuild summary', {
      rebuildApiUrl: latestRebuildResult.requestUrl || '',
      rebuildStatusCode: latestRebuildResult.statusCode ?? null,
      rebuildResponseBody: latestRebuildResult.responseBody ?? null,
      refetchedRowCount: requestTrace?.responseRowCount ?? reporters.length,
    });
  }, [latestRebuildResult, reporters.length, requestTrace?.responseRowCount]);

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setVerificationFilter('all');
    setActivityFilter('all');
    setCountryFilter(ALL_OPTION);
    setStateFilter(ALL_OPTION);
    setCityFilter(ALL_OPTION);
    setDistrictFilter(ALL_OPTION);
    setBeatFilter(ALL_OPTION);
    setAreaTypeFilter('all');
    setMissingDataFilter('all');
    setHasNotesOnly(false);
    lastAutoResetSearchRef.current = '';
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
  }

  function openProfile(row: ReporterContact, tab: ProfileTab = 'overview') {
    setSelectedReporter(row);
    setProfileTab(tab);
    setProfileOpen(true);
  }

  function toggleSelect(row: ReporterContact) {
    const normalizedRow = normalizeDirectoryRow(row);
    const id = normalizedRow?.contactId || '';
    if (!id) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (isLocalhostRuntime() && directoryView === 'active') {
        console.info('[reporter-active-selection]', {
          rawRow: row,
          normalizedRow,
          contactId: id,
          selectedIds: Array.from(next),
        });
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (!selectableRows.length) return current;
      if (allVisibleSelectableSelected) return new Set();
      const next = new Set(selectableRows.map((row) => row.contactId));
      if (isLocalhostRuntime() && directoryView === 'active') {
        console.info('[reporter-active-selection]', {
          rawRow: null,
          normalizedRow: selectableRows,
          contactId: null,
          selectedIds: Array.from(next),
        });
      }
      return next;
    });
  }

  function exportCsv() {
    const headers = ['Name', 'Email', 'City', 'District', 'State', 'Type', 'Verification', 'Stories', 'Approved', 'Pending', 'Last Submission'];
    const rows = sortedRows.map((row) => [
      row.name || '',
      row.email || '',
      row.city || '',
      String((row as any).district || ''),
      row.state || '',
      formatReporterType(row.reporterType),
      formatVerification(row.verificationLevel),
      row.totalStories || 0,
      row.approvedStories || 0,
      row.pendingStories || 0,
      formatDateTime(row.lastSubmissionAt || row.lastStoryAt),
    ].map(csvEscape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporter-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-4">
      <ConfirmModal
        open={rebuildOpen}
        title="Rebuild reporter directory?"
        description="This refreshes the reporter directory from contributor and submission-linked records. Summary cards, table rows, and the open profile drawer will update after the rebuild finishes."
        confirmLabel="Rebuild directory"
        confirmDisabled={rebuildMutation.isPending}
        confirmBusyLabel="Rebuilding..."
        onCancel={() => {
          if (rebuildMutation.isPending) return;
          setRebuildOpen(false);
        }}
        onConfirm={async () => {
          await rebuildMutation.mutateAsync();
        }}
      />

      <ConfirmModal
        open={bulkRemoveOpen}
        title={selectedCount === 1 ? 'Remove 1 contact from Directory?' : `Remove ${selectedCount} contacts from Directory?`}
        description={selectedCount <= 0
          ? 'Select one or more contacts to continue.'
          : 'This will remove the selected contacts from the visible Reporter Contact Directory. It will not permanently delete them.'}
        confirmLabel={selectedCount === 1 ? 'Remove contact' : `Remove ${selectedCount} contacts`}
        confirmDisabled={selectedCount <= 0 || bulkRemoveMutation.isPending}
        confirmBusyLabel={selectedCount === 1 ? 'Removing contact...' : 'Removing contacts...'}
        onCancel={() => {
          if (bulkRemoveMutation.isPending) return;
          setBulkRemoveOpen(false);
        }}
        onConfirm={async () => {
          await bulkRemoveMutation.mutateAsync(selectedRows);
        }}
      />

      <ConfirmModal
        open={bulkRestoreOpen}
        title={selectedCount === 1 ? 'Restore 1 contact?' : `Restore ${selectedCount} contacts?`}
        description={selectedCount <= 0
          ? 'Select one or more removed contacts to continue.'
          : 'This will restore the selected contacts back into the visible Reporter Contact Directory.'}
        confirmLabel={selectedCount === 1 ? 'Restore contact' : `Restore ${selectedCount} contacts`}
        confirmDisabled={selectedCount <= 0 || bulkRestoreMutation.isPending}
        confirmBusyLabel={selectedCount === 1 ? 'Restoring contact...' : 'Restoring contacts...'}
        onCancel={() => {
          if (bulkRestoreMutation.isPending) return;
          setBulkRestoreOpen(false);
        }}
        onConfirm={async () => {
          await bulkRestoreMutation.mutateAsync(selectedRows);
        }}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title={selectedCount === 1 ? 'Delete 1 removed contact permanently?' : `Delete ${selectedCount} removed contacts permanently?`}
        description={selectedCount <= 0
          ? 'Select one or more removed contacts to continue.'
          : 'This will permanently delete the selected removed contacts. This action cannot be undone.'}
        confirmLabel={selectedCount === 1 ? 'Delete Permanently' : `Delete ${selectedCount} Permanently`}
        confirmVariant="danger"
        confirmDisabled={selectedCount <= 0 || bulkDeleteMutation.isPending}
        confirmBusyLabel={selectedCount === 1 ? 'Deleting contact...' : 'Deleting contacts...'}
        onCancel={() => {
          if (bulkDeleteMutation.isPending) return;
          setBulkDeleteOpen(false);
        }}
        onConfirm={async () => {
          await bulkDeleteMutation.mutateAsync(selectedRows);
        }}
      />

      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reporter Contact Directory</h1>
        <p className="text-sm text-slate-600">Founder-grade reporter identity, contact, follow-up, and coverage planning directory.</p>
      </header>

      {directoryQuery.isError && ((directoryQuery.error as any)?.status === 401 || (directoryQuery.error as any)?.isUnauthorized) ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your admin session does not currently have access to the reporter directory. Please sign in again with a founder or admin account.
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        <p className="text-sm text-slate-600">Summary cards reflect preserved directory totals across both Active and Removed contacts. Only Delete Permanently removes data.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <SummaryCard label="Total Reporters" value={summary.totalReporters} />
          <SummaryCard label="Verified" value={summary.verified} />
          <SummaryCard label="Missing Phone" value={summary.missingPhone} />
          <SummaryCard label="Missing Location" value={summary.missingLocation} />
          <SummaryCard label="Active This Month" value={summary.activeThisMonth} />
          <SummaryCard label="New This Month" value={summary.newThisMonth} />
          <SummaryCard label="Last Submission" value={summary.lastSubmissionLabel} isText />
        </div>
      </div>

      <section className="mt-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setDirectoryView('active')}
              className={[
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                directoryView === 'active' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              {activeCount} active
            </button>
            <button
              type="button"
              onClick={() => setDirectoryView('removed')}
              className={[
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                directoryView === 'removed' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              {removedCount} removed
            </button>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{currentCountLabel}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.35fr)_repeat(3,minmax(160px,0.8fr))]">
              <FilterField label="Search">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, email, phone, city..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </FilterField>
              <FilterField label="Status">
                <select
                  value={directoryView === 'active' ? statusFilter : 'archived'}
                  onChange={(event) => setStatusFilter(event.target.value as any)}
                  disabled={directoryView === 'removed'}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {directoryView === 'active' ? (
                    <>
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="blocked">Blocked</option>
                    </>
                  ) : (
                    <option value="archived">Removed only</option>
                  )}
                </select>
              </FilterField>
              <FilterField label="Verification">
                <select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="all">All</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="limited">Limited</option>
                  <option value="revoked">Revoked</option>
                  <option value="unverified">Unverified</option>
                  <option value="community default">Community Default</option>
                </select>
              </FilterField>
              <FilterField label="Type">
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="all">All</option>
                  <option value="community">Community Reporter</option>
                  <option value="journalist">Journalist</option>
                </select>
              </FilterField>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={clearFilters} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Clear filters</button>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{currentCountLabel}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Activity">
              <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="all">All activity</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="new">New</option>
                <option value="on_leave">On leave</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </FilterField>
            <FilterField label="State">
              <select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setCityFilter(ALL_OPTION); setDistrictFilter(ALL_OPTION); }} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {states.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="District">
              <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {districts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="City">
              <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {cities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="Beat / Area">
              <div className="grid grid-cols-2 gap-2">
                <select value={beatFilter} onChange={(event) => setBeatFilter(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {beats.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={areaTypeFilter} onChange={(event) => setAreaTypeFilter(event.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="all">All areas</option>
                  <option value="metro">Metro</option>
                  <option value="corporation">Corporation</option>
                  <option value="district_hq">District HQ</option>
                  <option value="taluka">Taluka / block</option>
                  <option value="village">Village / rural</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </FilterField>
            <FilterField label="Missing data">
              <select value={missingDataFilter} onChange={(event) => setMissingDataFilter(event.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="all">All reporters</option>
                <option value="unresolved_identity">Unresolved identity</option>
                <option value="missing_email">Missing email</option>
                <option value="missing_phone">Missing phone</option>
                <option value="missing_location">Missing location</option>
                <option value="no_stories">No stories yet</option>
                <option value="inactive_30">Inactive 30+ days</option>
                <option value="inactive_60">Inactive 60+ days</option>
                <option value="inactive_90">Inactive 90+ days</option>
              </select>
            </FilterField>
            <FilterField label="Country">
              <select value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setStateFilter(ALL_OPTION); setCityFilter(ALL_OPTION); setDistrictFilter(ALL_OPTION); }} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {countries.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="Notes">
              <label className="inline-flex h-[42px] items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700">
                <input type="checkbox" checked={hasNotesOnly} onChange={(event) => setHasNotesOnly(event.target.checked)} />
                Only reporters with notes
              </label>
            </FilterField>
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                disabled={!canManage || rebuildMutation.isPending}
                onClick={() => setRebuildOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
                {rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild directory'}
              </button>
              {directoryView === 'active' ? (
                <button
                  type="button"
                  disabled={!canManage || selectedCount <= 0 || bulkRemoveMutation.isPending}
                  onClick={() => setBulkRemoveOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkRemoveMutation.isPending ? 'Removing...' : `Remove from Directory (${selectedCount})`}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!canManage || selectedCount <= 0 || bulkRestoreMutation.isPending}
                    onClick={() => setBulkRestoreOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkRestoreMutation.isPending ? 'Restoring...' : `Restore (${selectedCount})`}
                  </button>
                  <button
                    type="button"
                    disabled={!canManage || selectedCount <= 0 || bulkDeleteMutation.isPending}
                    onClick={() => setBulkDeleteOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete Permanently (${selectedCount})`}
                  </button>
                </>
              )}
            </div>
            <div className="text-sm text-slate-600">
              {directoryView === 'active'
                ? 'Select multiple contacts for bulk cleanup from the active directory.'
                : 'Removed contacts can be restored or permanently deleted from here.'}
            </div>
          </div>
        </div>

        <DirectoryTable
          isLoading={directoryQuery.isLoading}
          isError={directoryQuery.isError}
          error={directoryQuery.error as any}
          directoryView={directoryView}
          items={sortedRows}
          canManage={canManage}
          selectedIds={selectedIds}
          allVisibleSelectableSelected={allVisibleSelectableSelected}
          onGoToLogin={() => navigate('/admin/login')}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onSelect={(row) => openProfile(row, 'overview')}
          onOpenStories={(row) => {
            const contactId = row.contactId;
            if (contactId) {
              setStoriesTarget(row);
              return;
            }
            toast.error('Missing contact id for stories');
          }}
        />
      </section>

      <ReporterProfileDrawer
        open={profileOpen}
        reporter={selectedReporter}
        initialTab={profileTab}
        onClose={() => setProfileOpen(false)}
        onRefresh={async () => { await refreshDirectory(); }}
        onOpenStories={(key: string) => {
          const params = new URLSearchParams();
          params.set('reporterKey', key);
          if (selectedReporter?.name || selectedReporter?.email) params.set('name', String(selectedReporter?.name || selectedReporter?.email || ''));
          navigate(`/community/reporter-stories?${params.toString()}`, { state: { reporterKey: key, reporterName: selectedReporter?.name || selectedReporter?.email || '' } });
        }}
        onOpenQueue={(key: string) => navigate(`/community/reporter?reporterKey=${encodeURIComponent(key)}`)}
      />

      <ReporterStoriesDrawer
        open={!!storiesTarget}
        contactId={resolveReporterContactRecordId(storiesTarget)}
        contactName={String(storiesTarget?.name || storiesTarget?.email || '').trim()}
        canDelete={canManage}
        onClose={() => setStoriesTarget(null)}
        onAfterMutation={() => setRefreshTick((value) => value + 1)}
      />
    </div>
  );
}

function SummaryCard({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={isText ? 'mt-1 text-sm font-semibold text-slate-900' : 'mt-1 text-2xl font-semibold text-slate-900'}>{value}</div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function DirectoryTable({
  isLoading,
  isError,
  error,
  directoryView,
  items,
  canManage,
  selectedIds,
  allVisibleSelectableSelected,
  onToggleSelect,
  onToggleSelectAll,
  onSelect,
  onOpenStories,
  onGoToLogin,
}: {
  isLoading: boolean;
  isError: boolean;
  error: any;
  directoryView: DirectoryView;
  items: DirectoryRow[];
  canManage: boolean;
  selectedIds: Set<string>;
  allVisibleSelectableSelected: boolean;
  onToggleSelect: (row: DirectoryRow) => void;
  onToggleSelectAll: () => void;
  onSelect: (row: DirectoryRow) => void;
  onOpenStories: (row: DirectoryRow) => void;
  onGoToLogin: () => void;
}) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {Array.from({ length: directoryView === 'active' ? 13 : 12 }).map((_, index) => (
                <th key={index} className="px-4 py-3 text-left text-xs font-medium text-slate-500">&nbsp;</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: directoryView === 'active' ? 13 : 12 }).map((__, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2.5">
                    <div className="h-4 w-full max-w-[140px] animate-pulse rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isError && (((error as any)?.isUnauthorized === true) || ((error as any)?.status === 401))) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <div className="font-semibold">Admin session expired</div>
        <div className="mt-1">Please sign in again to view reporter contact details.</div>
        <button onClick={onGoToLogin} className="mt-4 rounded-md bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-800">Go to Admin Login</button>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {(error as any)?.message || 'Failed to load reporter contacts'}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Reporter table</div>
          <div className="text-xs text-slate-500">
            {directoryView === 'active'
              ? 'Select multiple contacts for bulk cleanup from the active directory.'
              : 'Removed contacts can be restored or permanently deleted from here.'}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {directoryView === 'active' ? 'Use Profile for details and View stories for reporting history.' : 'Use Profile to inspect details before restoring or permanently deleting records.'}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full divide-y divide-slate-200 whitespace-nowrap ${directoryView === 'active' ? 'min-w-[1120px]' : 'min-w-[1040px]'}`}>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={allVisibleSelectableSelected}
                  disabled={!canManage || !items.some((row) => !!row.contactId)}
                  onChange={onToggleSelectAll}
                  aria-label="Select all visible contacts"
                />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">City</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">District</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">State</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Verification</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Stories</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Approved</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Pending</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Last Submission</th>
              {directoryView === 'removed' ? <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Directory Status</th> : null}
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.length ? items.map((row) => (
              <tr key={row.id} className="group transition-colors hover:bg-slate-50">
                <td className="px-4 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.contactId)}
                    disabled={!canManage || !row.contactId}
                    onChange={() => onToggleSelect(row)}
                    aria-label={`Select ${row.name || row.email || 'reporter'}`}
                  />
                </td>
                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{row.name || row.email || 'Unknown reporter'}</td>
                <td className="max-w-[240px] px-4 py-2.5 text-sm text-slate-700">
                  <div className="truncate" title={row.email || 'Not provided'}>{row.email || 'Not provided'}</div>
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{row.city || '—'}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{String((row as any).district || '').trim() || '—'}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{row.state || '—'}</td>
                <td className="px-4 py-2.5 text-sm"><InlineBadge tone={row.reporterType === 'journalist' ? 'blue' : 'slate'}>{formatReporterType(row.reporterType)}</InlineBadge></td>
                <td className="px-4 py-2.5 text-sm"><InlineBadge tone={verificationTone(row.verificationLevel)}>{formatVerification(row.verificationLevel)}</InlineBadge></td>
                <td className="px-4 py-2.5 text-sm text-slate-900">{row.totalStories || 0}</td>
                <td className="px-4 py-2.5 text-sm text-slate-900">{row.approvedStories || 0}</td>
                <td className="px-4 py-2.5 text-sm text-slate-900">{row.pendingStories || 0}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{formatDateTime(row.lastSubmissionAt || row.lastStoryAt)}</td>
                {directoryView === 'removed' ? (
                  <td className="px-4 py-2.5 text-sm"><InlineBadge tone="slate">Removed</InlineBadge></td>
                ) : null}
                <td className="px-4 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <div className="inline-flex items-center gap-2">
                    <button type="button" onClick={() => onSelect(row)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">Profile</button>
                    {directoryView === 'active' ? <button type="button" onClick={() => onOpenStories(row)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">View stories</button> : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={directoryView === 'active' ? 13 : 13} className="px-6 py-12 text-center text-sm text-slate-500">No reporters match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InlineBadge({ children, tone }: { children: ReactNode; tone: 'slate' | 'green' | 'amber' | 'rose' | 'blue' }) {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  }[tone];

  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${toneClass}`}>{children}</span>;
}

function optionize(values: string[], allLabel: string) {
  return [{ value: ALL_OPTION, label: allLabel }, ...values.map((value) => ({ value, label: value }))];
}

function isSelectableValue(value: string) {
  return String(value || '').trim() !== '' && value !== ALL_OPTION;
}

function isLocalhostRuntime() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return LOCALHOST_HOSTS.has(window.location.hostname);
}

function compareText(left: unknown, right: string) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function hasValue(value: unknown) {
  return String(value || '').trim().length > 0;
}

function hasLocation(row: ReporterContact) {
  return hasValue(row.city) || hasValue((row as any).district) || hasValue(row.state) || hasValue(row.country);
}

function hasBeat(row: ReporterContact, beat: string) {
  const beats = Array.isArray((row as any).beatsProfessional) ? (row as any).beatsProfessional : [];
  return beats.some((value: string) => compareText(value, beat));
}

function missingIdentity(row: ReporterContact) {
  const hasName = hasValue(row.name);
  const hasAnyContact = hasValue(row.email) || hasValue(row.phone);
  return !hasName || !hasAnyContact;
}

function normalizeStatus(value: ReporterContact['status']) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'active') return 'active';
  if (raw === 'archived') return 'archived';
  return 'blocked';
}

function normalizeVerification(value: ReporterContact['verificationLevel']) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'unverified';
  if (raw === 'community_default') return 'community default';
  return raw;
}

function normalizeActivity(row: ReporterContact) {
  const raw = String((row as any).activity || '').trim().toLowerCase();
  if (raw) return raw as any;
  return daysSince(row.lastSubmissionAt || row.lastStoryAt) <= 31 ? 'active' : 'inactive';
}

function storyTimestamp(row: ReporterContact) {
  const raw = String(row.lastSubmissionAt || row.lastStoryAt || '').trim();
  if (!raw) return 0;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function daysSince(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return Infinity;
  const timestamp = new Date(raw).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return Infinity;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function buildSummary(rows: ReporterContact[]) {
  const latestStory = rows
    .map((row) => storyTimestamp(row))
    .filter((value) => value > 0)
    .sort((left, right) => right - left)[0];

  return {
    totalReporters: rows.length,
    verified: rows.filter((row) => normalizeVerification(row.verificationLevel) === 'verified').length,
    missingPhone: rows.filter((row) => !hasValue(row.phone)).length,
    missingLocation: rows.filter((row) => !hasLocation(row)).length,
    activeThisMonth: rows.filter((row) => daysSince(row.lastSubmissionAt || row.lastStoryAt) <= 31).length,
    newThisMonth: rows.filter((row) => normalizeActivity(row) === 'new').length,
    lastSubmissionLabel: latestStory ? new Date(latestStory).toLocaleString() : '—',
  };
}

function normalizeDirectoryRow(row: ReporterContact | null | undefined, fallbackDirectoryStatus: DirectoryView = 'active'): DirectoryRow | null {
  if (!row) return null;
  const contactId = resolveReporterContactRecordId(row);
  if (!contactId) return null;
  const rawStatus = String((row as any).directoryStatus || '').trim().toLowerCase();
  const directoryStatus: DirectoryView = rawStatus === 'removed' ? 'removed' : fallbackDirectoryStatus;
  return {
    ...row,
    contactId,
    directoryStatus,
  };
}

function resolveReporterContactRecordId(row: ReporterContact | null | undefined) {
  if (!row) return '';
  const raw = ((row as any)?.debugRawContact && typeof (row as any).debugRawContact === 'object') ? (row as any).debugRawContact : null;
  if (String(row.identitySource || '').trim().toLowerCase() === 'submission-derived') return '';
  return firstNonEmptyString(
    row.contactId,
    (row as any)?.contactRecordId,
    raw?.contactId,
    raw?.contactID,
    raw?.contactRecordId,
    raw?.contactRecordID,
    raw?.contact?._id,
    raw?.contact?.id,
    row.id,
  );
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function sameReporter(left: ReporterContact, right: ReporterContact) {
  const leftValues = [left.id, left.reporterKey, left.email, left.phone].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
  const rightValues = [right.id, right.reporterKey, right.email, right.phone].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
  return leftValues.some((value) => rightValues.includes(value));
}

function formatReporterType(value: ReporterContact['reporterType']) {
  return value === 'journalist' ? 'Journalist' : value === 'community' ? 'Community' : 'Unknown';
}

function formatVerification(value: ReporterContact['verificationLevel']) {
  const normalized = normalizeVerification(value);
  if (normalized === 'community default') return 'Community Default';
  if (normalized === 'unverified') return 'Unverified';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function verificationTone(value: ReporterContact['verificationLevel']) {
  const normalized = normalizeVerification(value);
  if (normalized === 'verified') return 'green';
  if (normalized === 'pending' || normalized === 'limited') return 'amber';
  if (normalized === 'revoked') return 'rose';
  return 'slate';
}

function formatDateTime(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toLocaleString() : '—';
}

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${escaped}"` : escaped;
}
