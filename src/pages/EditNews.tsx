import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { adminApiClient as api } from '@/lib/adminApiClient';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { usePublishFlag } from '../context/PublishFlagContext';
import { guardAction } from '../lib/articleWorkflowGuard';
import { debug } from '../lib/debug';

import type { WorkflowChecklist, WorkflowState } from '@/types/api';
import CoverImageUpload from '@/components/articles/CoverImageUpload';
import { uploadCoverImage } from '@/lib/api/media';
import { publishArticle, updateArticle, type Article, type ArticleMutationResponse } from '@/lib/api/articles';
import { ArticleSaveProgressError, articleCmsId, articleFollowUpWarning, normalizeArticleError, refreshArticleQueries } from '@/lib/articleLifecycle';
import { useEditorialAccess } from '@/hooks/useEditorialAccess';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import TrendingTopicSelector from '@/components/news/TrendingTopicSelector';
import { TopicMembershipSaveError, useArticleTrendingTopics } from '@/hooks/useArticleTrendingTopics';

interface NewsForm {
  title: string;
  content: string;
  category: string;
  language: string;
  summary?: string;
}

type SaveSnapshot = { form: NewsForm; coverUrl: string; coverPublicId: string };
type EditorOperation = 'save' | 'publish' | 'workflow' | 'checklist' | 'cover' | 'summary' | 'refresh';
type SaveRecovery =
  | { kind: 'article'; snapshot: SaveSnapshot; uncertain: boolean }
  | { kind: 'topic'; topicId: string; selected: boolean; uncertain: boolean }
  | { kind: 'publish'; uncertain: boolean };
type ArticleDetail = Article & { id?: string };
type ArticleDetailResponse = (ArticleDetail | { article: ArticleDetail } | { data: ArticleDetail | { article: ArticleDetail } })
  & { ok?: boolean; success?: boolean };

class LegacyEditorError extends Error {}

async function readLegacyArticle(id: string): Promise<Article> {
  const { data } = await api.get<ArticleDetailResponse>(`articles/${encodeURIComponent(id)}`);
  if (!data || typeof data !== 'object' || data.ok === false || data.success === false) {
    throw new LegacyEditorError('The article response could not be verified.');
  }
  const body = 'article' in data ? data.article : 'data' in data ? data.data : data;
  const article = body && 'article' in body ? body.article : body;
  const articleId = article?._id || article?.id;
  if (!article || typeof articleId !== 'string' || !articleId.trim()) {
    throw new LegacyEditorError('The article response returned no CMS News identity.');
  }
  return { ...article, _id: articleId };
}

function snapshotFromArticle(article: Article): SaveSnapshot {
  const cover = article.coverImage;
  const secureUrl = cover && typeof cover === 'object' && 'secureUrl' in cover && typeof cover.secureUrl === 'string' ? cover.secureUrl : '';
  const legacyUrl = cover && typeof cover === 'object' && 'secure_url' in cover && typeof cover.secure_url === 'string' ? cover.secure_url : '';
  const legacyPublicId = cover && typeof cover === 'object' && 'public_id' in cover && typeof cover.public_id === 'string' ? cover.public_id : '';
  return {
    form: {
      title: article.title || '', content: article.content || '', category: article.category || '',
      language: article.language || article.lang || '', summary: article.summary || '',
    },
    coverUrl: String((cover && typeof cover === 'object'
      ? cover.url || secureUrl || legacyUrl
      : '') || article.coverImageUrl || article.imageUrl || (typeof cover === 'string' ? cover : '') || '').trim(),
    coverPublicId: String(cover && typeof cover === 'object' ? cover.publicId || legacyPublicId : '').trim(),
  };
}

function languageIdentity(value: unknown): string {
  if (typeof value !== 'string') throw new LegacyEditorError('Article language identity is unavailable.');
  const code = value.trim().toLowerCase();
  if (code === 'en' || code === 'english') return 'en';
  if (code === 'hi' || code === 'hindi') return 'hi';
  if (code === 'gu' || code === 'gujarati') return 'gu';
  throw new LegacyEditorError('Article language identity is unsupported.');
}

function sameSnapshot(a: SaveSnapshot | null, b: SaveSnapshot): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

function matchesSavedFields(article: Article, snapshot: SaveSnapshot): boolean {
  const actual = snapshotFromArticle(article);
  return JSON.stringify(actual.form) === JSON.stringify(snapshot.form)
    && (!snapshot.coverUrl || actual.coverUrl === snapshot.coverUrl && actual.coverPublicId === snapshot.coverPublicId);
}

const CATEGORY_OPTIONS = [
  'Breaking News', 'Regional', 'Politics', 'National', 'International',
  'Business', 'Tech', 'Lifestyle', 'Glamorous', 'Sports',
  'Web Stories', 'Editorial', 'Login'
];

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Gujarati'];

export default function EditNews() {
  const { id } = useParams();
  const access = useEditorialAccess();
  if (access.loading) return <div>Checking article access...</div>;
  if (access.canManageNews) return <LegacyEditor key={id} />;
  if (id && access.canReadOwnDrafts) return <Navigate to={`/draft-desk/${encodeURIComponent(id)}?mode=edit`} replace />;
  return <div role="alert">{access.reason}</div>;
}

function LegacyEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editorialAccess = useEditorialAccess();
  const { user } = useAuth();
  const cmsId = useRef<string | null>(null);
  const { publishEnabled } = usePublishFlag();
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const operationRef = useRef<EditorOperation | null>(null);
  const [operation, setOperation] = useState<EditorOperation | null>(null);
  const [recovery, setRecovery] = useState<SaveRecovery | null>(null);
  const recoveryRef = useRef<SaveRecovery | null>(null);
  const [message, setMessage] = useState('');
  const [committedWarnings, setCommittedWarnings] = useState<string[]>([]);
  const acknowledged = useRef<SaveSnapshot | null>(null);
  const originalArticle = useRef<Article | null>(null);
  const articleCommitted = useRef(false);
  const publicationCommitted = useRef(false);
  const accessRef = useRef(editorialAccess);
  accessRef.current = editorialAccess;
  const actorRef = useRef(user?.id || user?._id || '');
  actorRef.current = user?.id || user?._id || '';
  const flagRef = useRef(publishEnabled);
  flagRef.current = publishEnabled;
  const inlineUploadRef = useRef(false);
  const [inlineUploadPending, setInlineUploadPending] = useState(false);

  const [form, setForm] = useState<NewsForm>({
    title: '',
    content: '',
    category: '',
    language: '',
    summary: ''
  });
  const trendingTopics = useArticleTrendingTopics({
    storyId: id || null,
    resetKey: id || null,
    lang: /^gu/i.test(form.language) ? 'gu' : /^hi/i.test(form.language) ? 'hi' : 'en',
  });
  const topicsRef = useRef(trendingTopics);
  topicsRef.current = trendingTopics;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cover image
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPublicId, setCoverPublicId] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Editorial workflow state
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [wfLoading, setWfLoading] = useState(true);
  const [wfError, setWfError] = useState('');
  const [checklist, setChecklist] = useState<WorkflowChecklist>({
    ptiCompliance: false,
    rightsCleared: false,
    attributionPresent: false,
    defamationScanOk: false,
  });
  const [scheduleAt, setScheduleAt] = useState<string>('');
  const workflowRef = useRef({ workflow, checklist });
  workflowRef.current = { workflow, checklist };
  const currentSnapshot = { form, coverUrl: coverUrl.trim(), coverPublicId: coverPublicId.trim() };
  const snapshotRef = useRef(currentSnapshot);
  snapshotRef.current = currentSnapshot;
  const editingLocked = operation !== null || recovery !== null;
  const saving = operation === 'save';
  const transitionPending = operation === 'publish';
  useUnsavedChanges(!loading && (!sameSnapshot(acknowledged.current, currentSnapshot)
    || trendingTopics.isDirty || recovery !== null), operation !== null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const onPendingUploadChange = useCallback((pending: boolean) => {
    inlineUploadRef.current = pending;
    if (mounted.current) setInlineUploadPending(pending);
  }, []);

  function pauseForVerification(next: SaveRecovery) {
    recoveryRef.current = next;
    if (mounted.current) setRecovery(next);
  }

  function keepWarning(warning: string) {
    if (mounted.current) setCommittedWarnings(previous => previous.includes(warning) ? previous : [...previous, warning]);
    toast(warning);
  }

  function beginOperation(next: EditorOperation): boolean {
    if (!mounted.current || operationRef.current) return false;
    if (!accessRef.current.canManageNews) {
      toast.error('Manage News access could not be verified. No action was attempted.');
      return false;
    }
    if (next !== 'refresh' && recoveryRef.current) {
      toast.error('Refresh the latest saved state before continuing. Your edits have been kept.');
      return false;
    }
    if (inlineUploadRef.current) {
      toast.error('Please wait for the inline image upload to finish.');
      return false;
    }
    operationRef.current = next;
    // BrowserRouter's navigation guard must observe the lock before any async work.
    flushSync(() => setOperation(next));
    return true;
  }

  function endOperation() {
    operationRef.current = null;
    if (mounted.current) flushSync(() => setOperation(null));
  }

  function canChangeValues(): boolean {
    return mounted.current && !operationRef.current && !recoveryRef.current && accessRef.current.canManageNews;
  }

  function ensureCurrent(target: string, actor: string, publishing = false) {
    if (!mounted.current || cmsId.current !== target || actorRef.current !== actor || !accessRef.current.canManageNews) {
      throw new LegacyEditorError('The editor or its authorization changed. Remaining operations were not attempted. Reopen the original story to verify its saved state.');
    }
    if (publishing) {
      const current = workflowRef.current;
      const guard = guardAction('publish', flagRef.current, {
        isFounder: accessRef.current.isFounder, canPublish: accessRef.current.canPublish,
        stage: current.workflow?.stage,
        checklistOk: Object.values(current.checklist).every(Boolean),
      });
      if (!guard.allowed || publicationCommitted.current) {
        throw new LegacyEditorError(guard.reason || 'Publication is already confirmed. It will not be repeated.');
      }
    }
  }

  function verifyIdentity(article: Article, target: string, language?: string) {
    if (article.sourceNewsId != null && (typeof article.sourceNewsId !== 'string' || !article.sourceNewsId.trim())) {
      throw new LegacyEditorError('The canonical article identity is invalid.');
    }
    if (articleCmsId(article) !== target) throw new LegacyEditorError('The article identity changed. No returned ID will be used for another operation.');
    const languages = [article.language, article.lang].filter(value => value != null).map(languageIdentity);
    if (new Set(languages).size > 1 || language && languages.some(value => value !== languageIdentity(language))) {
      throw new LegacyEditorError('The article language identity changed. Your values were kept and no publication was attempted.');
    }
    for (const key of ['translationGroupId', 'translationKey'] as const) {
      if (article[key] !== undefined && (article[key] ?? null) !== (originalArticle.current?.[key] ?? null)) {
        throw new LegacyEditorError('The article translation group changed. Preserve your edits and review the original story.');
      }
    }
  }

  function needsVerification(error: unknown): { required: boolean; uncertain: boolean } {
    const failure = normalizeArticleError(error, 'The operation was not confirmed');
    return { required: failure.status !== 401 && failure.status !== 403 && failure.status !== 419,
      uncertain: failure.status === null || failure.status >= 500 };
  }

  function reportFailure(error: unknown, fallback: string) {
    const cause = error instanceof TopicMembershipSaveError || error instanceof ArticleSaveProgressError ? error.cause : error;
    const detail = normalizeArticleError(cause, error instanceof Error ? error.message : fallback);
    const text = error instanceof ArticleSaveProgressError ? error.message
      : error instanceof TopicMembershipSaveError
        ? `${articleCommitted.current ? 'The article was saved, but topic changes were not fully confirmed. ' : ''}${error.message}`
        : `${detail.message}${articleCommitted.current ? ' Earlier article saves remain committed and will not be repeated unchanged.' : ''}`;
    if (mounted.current) setMessage(text);
    console.error('[EditNews] operation not completed', { status: detail.status, code: detail.code });
    toast.error(text);
  }

  useEffect(() => {
    let cancelled = false;
    const fetchNews = async () => {
      try {
        if (!id) throw new LegacyEditorError('Missing article id');
        const article = await readLegacyArticle(id);
        if (cancelled) return;
        if (article._id !== id && article.sourceNewsId !== id) throw new LegacyEditorError('The loaded article does not match this workspace.');
        cmsId.current = articleCmsId(article);
        originalArticle.current = article;
        publicationCommitted.current = article.status === 'published';
        const snapshot = snapshotFromArticle(article);
        verifyIdentity(article, cmsId.current, snapshot.form.language);
        languageIdentity(snapshot.form.language);
        acknowledged.current = snapshot;
        setForm(snapshot.form);
        setCoverUrl(snapshot.coverUrl);
        setCoverPublicId(snapshot.coverPublicId);
        setCoverFile(null);
      } catch (err: unknown) {
        if (!cancelled) setError(normalizeArticleError(err, err instanceof LegacyEditorError ? err.message : 'Failed to load article').message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchNews();
    return () => { cancelled = true; };
  }, [id]);

  // Load workflow state
  useEffect(() => {
    let cancelled = false;
    const fetchWorkflow = async () => {
      if (!id) return;
      setWfLoading(true);
      try {
        const res = await api.get(`/news/${encodeURIComponent(id)}/workflow`);
        if (cancelled) return;
        const w = res.data?.data || res.data?.workflow || res.data;
        if (w) {
          setWorkflow(w);
          const cl = w.checklist || {};
          setChecklist({
            ptiCompliance: !!cl.ptiCompliance,
            rightsCleared: !!cl.rightsCleared,
            attributionPresent: !!cl.attributionPresent,
            defamationScanOk: !!cl.defamationScanOk,
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.warn('[EditNews] workflow read failed');
          setWfError(normalizeArticleError(err, 'Workflow data unavailable').message);
        }
      } finally {
        if (!cancelled) setWfLoading(false);
      }
    };
    fetchWorkflow();
    return () => { cancelled = true; };
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    if (!canChangeValues()) return;
    const { name, value } = e.target;
    setForm(previous => ({ ...previous, [name]: value }));
  };

  async function saveRequiredChanges(target: string, actor: string, publishing = false) {
    ensureCurrent(target, actor, publishing);
    if (topicsRef.current.hasPendingChanges() && !topicsRef.current.access.canEdit) {
      throw new LegacyEditorError('Manage News access and the Edit news special right are required to save Trending Topics.');
    }
    const snapshot = snapshotRef.current;
    if (/data-np-inline-image-uploading/i.test(snapshot.form.content)) {
      throw new LegacyEditorError('Please wait for the inline image upload to finish.');
    }
    if (!sameSnapshot(acknowledged.current, snapshot) || !publishing && !articleCommitted.current) {
      if (!snapshot.form.title.trim() || !snapshot.form.content.trim() || !snapshot.form.category || !snapshot.form.language) {
        throw new LegacyEditorError('All article fields are required before saving or publishing.');
      }
      try {
        const payload: Partial<Article> = {
          ...snapshot.form,
          imageUrl: snapshot.coverUrl || undefined,
          coverImageUrl: snapshot.coverUrl || undefined,
          coverImage: snapshot.coverUrl ? { url: snapshot.coverUrl, publicId: snapshot.coverPublicId || undefined } : undefined,
        };
        const result: ArticleMutationResponse = await updateArticle(target, payload);
        const warning = articleFollowUpWarning(result);
        if (warning) keepWarning(`Article save committed. ${warning}`);
        const returned = result?.article || result?.data?.article;
        if (returned) {
          try {
            verifyIdentity(returned, target, snapshot.form.language);
            if ((['title', 'content', 'summary'] as const).some(key =>
              returned[key] !== undefined && (returned[key] ?? '') !== (snapshot.form[key] ?? ''))) {
              throw new LegacyEditorError('The returned article text does not confirm the submitted edit. Verify the saved state before publication.');
            }
          } catch (error: unknown) {
            keepWarning('The article save was acknowledged, but its returned state could not be verified. Do not repeat the write without verifying it.');
            throw error;
          }
        }
        articleCommitted.current = true;
        acknowledged.current = snapshot;
        if (warning) {
          pauseForVerification({ kind: 'article', snapshot, uncertain: false });
          throw new ArticleSaveProgressError('Article save committed with a follow-up warning. Refresh the saved state; remaining operations were not attempted.', null);
        }
      } catch (error: unknown) {
        if (!(error instanceof ArticleSaveProgressError)) {
          const verification = needsVerification(error);
          if (verification.required) pauseForVerification({ kind: 'article', snapshot, uncertain: verification.uncertain });
        }
        throw error;
      }
    }
    ensureCurrent(target, actor, publishing);
    const selectedTopics = topicsRef.current.snapshotChanges();
    for (const [topicId, selected] of Object.entries(selectedTopics)) {
      ensureCurrent(target, actor, publishing);
      if (!topicsRef.current.access.canEdit) throw new LegacyEditorError('Manage News access and the Edit news special right are required to save Trending Topics.');
      try {
        const warning = await topicsRef.current.saveChanges(target, { [topicId]: selected });
        if (warning) {
          keepWarning(warning);
          pauseForVerification({ kind: 'topic', topicId, selected, uncertain: false });
          throw new ArticleSaveProgressError('Topic changes were saved with a follow-up warning. Refresh the saved state; remaining operations were not attempted.', null);
        }
      } catch (error: unknown) {
        if (!(error instanceof ArticleSaveProgressError)) {
          const cause = error instanceof TopicMembershipSaveError ? error.cause : error;
          const verification = needsVerification(cause);
          if (verification.required) pauseForVerification({ kind: 'topic', topicId, selected, uncertain: verification.uncertain });
        }
        throw error;
      }
    }
    ensureCurrent(target, actor, publishing);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beginOperation('save')) return;
    const target = cmsId.current;
    const actor = actorRef.current;
    let completed = false;
    try {
      if (!target) throw new LegacyEditorError('Missing CMS News ID. Reload before saving.');
      await saveRequiredChanges(target, actor);
      try {
        await refreshArticleQueries(queryClient);
      } catch {
        pauseForVerification({ kind: 'article', snapshot: snapshotRef.current, uncertain: false });
        throw new ArticleSaveProgressError('The update was saved, but the latest article list could not be loaded. Refresh it; do not repeat the save.', null);
      }
      ensureCurrent(target, actor);
      setMessage('');
      toast.success('✅ Article updated');
      completed = true;
    } catch (error: unknown) {
      reportFailure(error, 'Save failed');
    } finally {
      endOperation();
    }
    if (completed) navigate('/manage-news');
  };

  const uploadSelectedCover = async (file: File) => {
    if (!beginOperation('cover')) return;
    const target = cmsId.current;
    const actor = actorRef.current;
    setIsUploadingCover(true);
    try {
      if (!target) throw new LegacyEditorError('Missing article identity.');
      const res = await uploadCoverImage(file);
      ensureCurrent(target, actor);
      setCoverUrl(res.url);
      setCoverPublicId(res.publicId || '');
      toast.success('✅ Cover image uploaded');
    } catch (err: unknown) {
      reportFailure(err, 'Cover image upload failed');
    } finally {
      if (mounted.current) setIsUploadingCover(false);
      endOperation();
    }
  };

  const handleAISummary = async () => {
    if (!beginOperation('summary')) return;
    const target = cmsId.current;
    const actor = actorRef.current;
    try {
      if (!target) throw new LegacyEditorError('Missing article identity.');
      const response = await api.post('ai/summarize', { content: snapshotRef.current.form.content });
      ensureCurrent(target, actor);
      const data = response.data || {};
      const summary = data.summary || data.data?.summary;
      if (typeof summary !== 'string' || !summary.trim()) throw new LegacyEditorError('The AI summarizer returned no summary.');
      setForm(previous => ({ ...previous, summary }));
      toast.success('🧠 Summary updated!');
    } catch (err: unknown) {
      reportFailure(err, 'AI summarizer failed');
    } finally {
      endOperation();
    }
  };

  // Checklist handlers
  const toggleChecklist = (key: keyof WorkflowChecklist) => {
    if (!canChangeValues()) return;
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveChecklist = async () => {
    if (!id || !beginOperation('checklist')) return;
    const target = cmsId.current;
    const actor = actorRef.current;
    try {
      if (!target) throw new LegacyEditorError('Missing article identity.');
      const res = await api.post(`/news/${encodeURIComponent(id)}/checklist`, workflowRef.current.checklist);
      ensureCurrent(target, actor);
      const w = res.data?.data || res.data?.workflow || res.data;
      if (w) {
        setWorkflow(w);
        toast.success('✅ Checklist saved');
      } else {
        toast.success('✅ Checklist updated');
      }
    } catch (err: unknown) {
      reportFailure(err, 'Checklist save failed');
    } finally {
      endOperation();
    }
  };

  const doTransition = async (action: 'toReview' | 'toLegal' | 'approve' | 'schedule' | 'publish') => {
    if (!id || !beginOperation(action === 'publish' ? 'publish' : 'workflow')) return;
    const target = cmsId.current;
    const actor = actorRef.current;
    const current = workflowRef.current;
    const g = guardAction(action, flagRef.current, {
      checklistOk: Object.values(current.checklist).every(Boolean), stage: current.workflow?.stage,
      isFounder: accessRef.current.isFounder, canPublish: accessRef.current.canPublish,
    });
    if (!g.allowed) {
      debug('[EditNews] blocked transition', { id, action, publishEnabled });
      toast.error(g.reason || 'Publishing disabled');
      endOperation();
      return;
    }
    try {
      if (!target) throw new LegacyEditorError('Missing CMS News ID. Reload before continuing.');
      const payload: { action: typeof action; scheduledAt?: string } = { action };
      if (action === 'schedule') {
        if (!scheduleAt) {
          toast.error('Please select a schedule time');
          return;
        }
        payload.scheduledAt = scheduleAt;
      }
      if (action === 'publish') {
        await saveRequiredChanges(target, actor, true);
        ensureCurrent(target, actor, true);
        let result: ArticleMutationResponse;
        try {
          result = await publishArticle(target);
        } catch (error: unknown) {
          const verification = needsVerification(error);
          if (verification.required) pauseForVerification({ kind: 'publish', uncertain: verification.uncertain });
          throw error;
        }
        publicationCommitted.current = true;
        ensureCurrent(target, actor);
        const article = result.article || result.data?.article;
        if (article) {
          verifyIdentity(article, target, acknowledged.current?.form.language);
          if (article.status !== undefined && article.status !== 'published') {
            throw new ArticleSaveProgressError('Publication was acknowledged, but its returned state is not Published. Verify the original story; do not repeat publication.', null);
          }
          queryClient.setQueryData(['articles', 'one', target], article);
        }
        setWorkflow((current) => current ? { ...current, status: 'published' } : current);
        const warning = articleFollowUpWarning(result);
        if (warning) {
          keepWarning(`Publication committed. ${warning}`);
          pauseForVerification({ kind: 'publish', uncertain: false });
        }
        try {
          const response = await api.get(`/news/${encodeURIComponent(id)}/workflow`);
          ensureCurrent(target, actor);
          const latest = response.data?.data || response.data?.workflow || response.data;
          setWorkflow({ ...latest, status: 'published' });
        } catch {
          const text = 'Published, but the latest workflow could not be loaded. Refresh it; do not publish again.';
          keepWarning(text);
          pauseForVerification({ kind: 'publish', uncertain: false });
          if (mounted.current) setMessage(text);
          toast.error(text);
        }
      } else {
        ensureCurrent(target, actor);
        const res = await api.post(`/news/${encodeURIComponent(id)}/transition`, payload);
        ensureCurrent(target, actor);
        const w = res.data?.data || res.data?.workflow || res.data;
        if (w) setWorkflow(w);
        toast.success(`✅ ${action} complete`);
        return;
      }
      toast.success(`✅ ${action} complete`);
      try {
        await refreshArticleQueries(queryClient);
      } catch {
        const text = 'The action completed, but the latest article list could not be loaded. Refresh it; do not repeat the action.';
        keepWarning(text);
        pauseForVerification({ kind: 'publish', uncertain: false });
        toast.error(text);
      }
    } catch (error: unknown) {
      if (action === 'publish' && publicationCommitted.current) {
        pauseForVerification({ kind: 'publish', uncertain: false });
        keepWarning('Publication was acknowledged. Remaining checks did not complete; do not publish again.');
      }
      reportFailure(error, 'Transition failed');
    } finally {
      endOperation();
    }
  };

  const refreshSavedState = async () => {
    const pending = recoveryRef.current;
    if (!pending || !beginOperation('refresh')) return;
    const target = cmsId.current;
    const actor = actorRef.current;
    try {
      if (!target) throw new LegacyEditorError('Missing CMS News ID. Reopen the original story.');
      const latest = await readLegacyArticle(target);
      ensureCurrent(target, actor);
      verifyIdentity(latest, target, pending.kind === 'article' ? undefined : acknowledged.current?.form.language);
      if (pending.kind === 'article') {
        if (matchesSavedFields(latest, pending.snapshot)) {
          acknowledged.current = pending.snapshot;
          articleCommitted.current = true;
        } else if (pending.uncertain || !acknowledged.current || !matchesSavedFields(latest, acknowledged.current)) {
          throw new LegacyEditorError('The attempted article save is not confirmed by the latest content. Your values were kept. No revision or request-status contract is available to safely repeat this write; Founder review is required.');
        }
      } else if (acknowledged.current && !matchesSavedFields(latest, acknowledged.current)) {
        throw new LegacyEditorError('The saved article content changed. Your local values were kept; review the original story before continuing.');
      }
      if (pending.kind === 'topic') {
        const refreshed = await topicsRef.current.query.refetch();
        ensureCurrent(target, actor);
        if (refreshed.error) throw refreshed.error;
        const topic = refreshed.data?.items.find(item => item.id === pending.topicId);
        if (!topic || !topic.membershipConsistent || typeof topic.attached !== 'boolean') {
          throw new LegacyEditorError('The logical-story topic membership could not be verified. No membership request was repeated.');
        }
        if (pending.uncertain && topic.attached !== pending.selected) {
          throw new LegacyEditorError('The topic request outcome is still uncertain. A read cannot rule out a delayed write; no membership request was repeated.');
        }
      }
      if (pending.kind === 'publish') {
        if (latest.status === 'published') publicationCommitted.current = true;
        else if (pending.uncertain || publicationCommitted.current) {
          throw new LegacyEditorError('Publication outcome is still uncertain. A read cannot rule out a delayed publication; no publication request was repeated.');
        }
      }
      const response = await api.get(`/news/${encodeURIComponent(id!)}/workflow`);
      ensureCurrent(target, actor);
      const latestWorkflow = response.data?.data || response.data?.workflow || response.data;
      if (!latestWorkflow || typeof latestWorkflow.stage !== 'string' || typeof latestWorkflow.status !== 'string') {
        throw new LegacyEditorError('The latest editorial workflow could not be verified.');
      }
      setWorkflow(publicationCommitted.current ? { ...latestWorkflow, status: 'published' } : latestWorkflow);
      recoveryRef.current = null;
      flushSync(() => setRecovery(null));
      if (pending.kind === 'topic' && topicsRef.current.access.canEdit) {
        topicsRef.current.setSelected(pending.topicId, pending.selected);
      }
      setMessage('Latest saved state verified. Your local values and committed warnings were kept. Choose Save Changes or Publish Now explicitly to continue.');
    } catch (error: unknown) {
      reportFailure(error, 'Could not verify the latest saved state');
    } finally {
      endOperation();
    }
  };

  const allChecklistOk = useMemo(() =>
    checklist.ptiCompliance && checklist.rightsCleared && checklist.attributionPresent && checklist.defamationScanOk,
  [checklist]);

  if (loading) return <p className="p-4">Loading news...</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">✏️ Edit News</h1>

      {(message || committedWarnings.length > 0 || recovery) && (
        <div role="alert" className="mb-4 space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          {message && <p>{message}</p>}
          {committedWarnings.map(warning => <p key={warning}>{warning}</p>)}
          {recovery && <button type="button" disabled={operation !== null} onClick={refreshSavedState} className="rounded border px-3 py-2">
            Refresh latest state
          </button>}
        </div>
      )}
      {operation && <p role="status" className="mb-3 text-sm">
        {transitionPending ? 'Saving required changes and publishing...' : saving ? 'Saving changes...' : 'Operation in progress...'} Editing is temporarily locked.
      </p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={editingLocked} className="space-y-4">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="📰 News Title"
          required
          className="w-full border px-4 py-2 rounded"
        />

        <div className="rounded border border-slate-200 bg-white p-3">
          <CoverImageUpload
            url={coverUrl}
            file={coverFile}
            disabled={editingLocked}
            onChangeFile={(f) => {
              if (!canChangeValues()) return;
              setCoverFile(f);
              if (f) void uploadSelectedCover(f);
            }}
            onRemove={() => {
              if (!canChangeValues()) return;
              setCoverFile(null);
              setCoverUrl('');
              setCoverPublicId('');
            }}
          />
          {isUploadingCover && <div className="mt-1 text-[11px] text-slate-500">Uploading…</div>}
        </div>

        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          required
          className="w-full border px-4 py-2 rounded"
        >
          <option value="">Select Category</option>
          {form.category && !CATEGORY_OPTIONS.includes(form.category) && <option value={form.category}>{form.category}</option>}
          {CATEGORY_OPTIONS.map((cat, index) => (
            <option key={index} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          name="language"
          value={form.language}
          onChange={handleChange}
          required
          className="w-full border px-4 py-2 rounded"
        >
          <option value="">Select Language</option>
          {form.language && !LANGUAGE_OPTIONS.includes(form.language) && <option value={form.language}>{form.language}</option>}
          {LANGUAGE_OPTIONS.map((lang, index) => (
            <option key={index} value={lang}>{lang}</option>
          ))}
        </select>

        <TrendingTopicSelector topics={{ ...trendingTopics, setSelected: (topicId, selected) => {
          if (canChangeValues()) topicsRef.current.setSelected(topicId, selected);
        } }} disabled={editingLocked} />

        <button
          type="button"
          onClick={handleAISummary}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
        >
          🧠 Auto-Summarize
        </button>

        <textarea
          className="w-full border px-4 py-2 rounded"
          placeholder="📝 Summary will appear here..."
          rows={3}
          name="summary"
          value={form.summary || ''}
          onChange={handleChange}
        />

        <div ref={element => { if (element) element.inert = editingLocked; }}>
          <RichTextEditor
            value={form.content}
            onChange={(html) => {
              if (canChangeValues()) setForm(previous => ({ ...previous, content: html }));
            }}
            onPendingUploadChange={onPendingUploadChange}
            placeholder="Write article content…"
          />
        </div>

        <div className="text-right">
          <button
            type="submit"
            disabled={editingLocked || inlineUploadPending}
            className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-600"
          >
            💾 Save Changes
          </button>
        </div>
        </fieldset>
      </form>

      {/* Editorial Workflow Card */}
      <div className="mt-10 p-4 border rounded bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">🛠 Editorial Workflow</h2>
          {user?.role && (
            <span className="text-xs px-2 py-1 rounded bg-slate-200">Role: {user.role}</span>
          )}
        </div>

        {wfLoading ? (
          <p>Loading workflow…</p>
        ) : wfError ? (
          <p className="text-sm text-red-600">{wfError}</p>
        ) : workflow ? (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">Status: {workflow.status}</span>
              <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">Stage: {workflow.stage}</span>
              {workflow.scheduledAt ? (
                <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-800">Scheduled: {new Date(workflow.scheduledAt).toLocaleString()}</span>
              ) : null}
            </div>

            {workflow.approvals && workflow.approvals.length > 0 && (
              <div className="mb-4 border rounded bg-white overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-100 flex items-center justify-between">
                  <span>Approvals ({workflow.approvals.length})</span>
                </div>
                <div className="divide-y">
                  {workflow.approvals.map((a, idx) => (
                    <div key={idx} className="px-3 py-2 text-[11px] flex flex-wrap gap-3 items-center">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{a.role}</span>
                      {a.userName && <span className="text-slate-700">{a.userName}</span>}
                      <span className="text-slate-500">{new Date(a.at).toLocaleString()}</span>
                      {a.note && <span className="text-slate-600 italic max-w-[320px] truncate" title={a.note}>{a.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <fieldset disabled={editingLocked}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checklist.ptiCompliance} onChange={() => toggleChecklist('ptiCompliance')} />
                <span>PTI compliance</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checklist.rightsCleared} onChange={() => toggleChecklist('rightsCleared')} />
                <span>Rights cleared</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checklist.attributionPresent} onChange={() => toggleChecklist('attributionPresent')} />
                <span>Attribution present</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checklist.defamationScanOk} onChange={() => toggleChecklist('defamationScanOk')} />
                <span>Defamation scan OK</span>
              </label>
            </div>
            <div className="mt-3">
              <button onClick={saveChecklist} className="px-3 py-2 bg-slate-800 text-white rounded hover:bg-slate-700">💾 Save Checklist</button>
              {!allChecklistOk && (
                <span className="ml-3 text-xs text-amber-700">Complete all items to enable finalization</span>
              )}
            </div>

            <hr className="my-4" />
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => doTransition('toReview')}
                disabled={workflow.stage !== 'draft'}
                className={`px-3 py-2 rounded text-white ${workflow.stage !== 'draft' ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                📤 Send to Review
              </button>
              <button
                onClick={() => doTransition('toLegal')}
                disabled={workflow.stage !== 'review'}
                className={`px-3 py-2 rounded text-white ${workflow.stage !== 'review' ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}
              >
                ⚖️ Send to Legal
              </button>
              <button
                onClick={() => doTransition('approve')}
                disabled={workflow.stage !== 'legal' || !allChecklistOk}
                className={`px-3 py-2 rounded text-white ${(workflow.stage !== 'legal' || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}
              >
                ✅ Approve
              </button>
              {editorialAccess.canSchedule && <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => { if (canChangeValues()) setScheduleAt(e.target.value); }}
                  className="border px-2 py-1 rounded"
                />
                <button
                  onClick={() => doTransition('schedule')}
                  disabled={workflow.stage !== 'approved' || !allChecklistOk}
                  className={`px-3 py-2 rounded text-white ${(workflow.stage !== 'approved' || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500'}`}
                >
                  🗓 Schedule
                </button>
              </div>}
              <button
                type="button"
                onClick={() => doTransition('publish')}
                disabled={editingLocked || inlineUploadPending || publicationCommitted.current || workflow.status === 'published' || !editorialAccess.canPublish || !publishEnabled || (workflow.stage !== 'approved' && workflow.stage !== 'scheduled') || !allChecklistOk}
                className={`px-3 py-2 rounded text-white ${((workflow.stage !== 'approved' && workflow.stage !== 'scheduled') || !allChecklistOk) ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'}`}
              >
                🚀 Publish Now
              </button>
            </div>
            </fieldset>
          </>
        ) : (
          <p className="text-sm text-slate-600">No workflow data.</p>
        )}
      </div>
    </div>
  );
}
