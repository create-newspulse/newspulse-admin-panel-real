import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTrendingTopicsAccess } from '@/hooks/useTrendingTopicsAccess';
import {
  attachTopicStories, detachTopicStories, loadAvailableTopics,
  refreshTopicMembershipQueries, topicStoryErrorMessage,
  type TopicLanguage,
} from '@/lib/api/trendingTopics';
import { articleFollowUpWarning } from '@/lib/articleLifecycle';

export type TopicSelectionChanges = Record<string, boolean>;

export class TopicMembershipSaveError extends Error {
  constructor(message: string, readonly cause: unknown) {
    super(message);
    this.name = 'TopicMembershipSaveError';
  }
}

export function useArticleTrendingTopics({ storyId, lang, resetKey }: {
  storyId: string | null;
  lang: TopicLanguage;
  resetKey: string | null;
}) {
  const access = useTrendingTopicsAccess();
  const client = useQueryClient();
  const [changes, setChanges] = useState<TopicSelectionChanges>({});
  const changesRef = useRef(changes);
  const [saveError, setSaveError] = useState('');
  const [warning, setWarning] = useState('');
  const query = useQuery({
    queryKey: ['trending-topics', 'available', storyId, lang],
    queryFn: () => loadAvailableTopics({ lang, ...(storyId ? { storyId } : {}) }),
    enabled: access.canRead,
    staleTime: 0,
    retry: false,
  });

  function replaceChanges(next: TopicSelectionChanges) {
    changesRef.current = next;
    setChanges(next);
  }

  function reset() {
    replaceChanges({});
    setSaveError('');
    setWarning('');
  }

  useEffect(() => { reset(); }, [resetKey]);

  function setSelected(id: string, selected: boolean) {
    if (!access.canEdit) {
      setSaveError('Access denied. The Edit news special right is required to change Trending Topics.');
      return;
    }
    const topic = query.data?.items.find((item) => item.id === id);
    if (!topic) {
      setSaveError('The topic is no longer available. Reload the topics before selecting it.');
      return;
    }
    const next = { ...changesRef.current };
    if (selected === (topic.attached === true)) delete next[id];
    else next[id] = selected;
    replaceChanges(next);
    setSaveError('');
    setWarning('');
  }

  async function saveChanges(id: string, submitted: TopicSelectionChanges): Promise<string | null> {
    if (!Object.keys(submitted).length) return null;
    if (!access.canEdit) {
      const message = 'Access denied. Manage News access and the Edit news special right are required to save Trending Topics.';
      setSaveError(message);
      throw new TopicMembershipSaveError(message, null);
    }
    setSaveError('');
    setWarning('');
    let failure: unknown;
    let failed = false;
    let committed = 0;
    const warnings = new Set<string>();
    try {
      for (const [topicId, attached] of Object.entries(submitted)) {
        const result = await (attached ? attachTopicStories : detachTopicStories)(topicId, [id]);
        committed += 1;
        const next = { ...changesRef.current };
        if (next[topicId] === attached) delete next[topicId];
        replaceChanges(next);
        const followUp = articleFollowUpWarning(result);
        if (followUp) warnings.add(followUp);
      }
    } catch (error: unknown) {
      failed = true;
      failure = error;
    }
    if (committed) {
      try {
        await refreshTopicMembershipQueries(client);
      } catch {
        warnings.add('Membership was saved, but the latest saved state could not be loaded. Reload before making further changes; do not repeat confirmed changes.');
      }
    }
    const warningMessage = [...warnings].join(' ');
    setWarning(warningMessage);
    if (failed) {
      const message = `${committed ? 'Some topic changes were saved; remaining changes were not confirmed. ' : ''}${topicStoryErrorMessage(failure)}`;
      setSaveError(message);
      throw new TopicMembershipSaveError(message, failure);
    }
    return warningMessage || null;
  }

  const items = query.data?.items ?? [];
  const isSelected = (id: string) => changes[id] ?? (items.find((item) => item.id === id)?.attached === true);
  const isProtectedTag = (tag: string) => tag.startsWith('topic:') || items.some((topic) => topic.articleTags.includes(tag));

  return {
    access, query, items, changes, saveError, warning, isSelected, isProtectedTag,
    isDirty: Object.keys(changes).length > 0,
    hasPendingChanges: () => Object.keys(changesRef.current).length > 0,
    snapshotChanges: (): TopicSelectionChanges => ({ ...changesRef.current }),
    setSelected, saveChanges, reset,
  };
}

export type ArticleTrendingTopicsState = ReturnType<typeof useArticleTrendingTopics>;
