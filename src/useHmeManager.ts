import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ICloudClient, {
  PremiumMailSettings,
  HmeEmail,
} from './iCloudClient';
import { getCachedHmeList, setCachedHmeList } from './hmeCache';
import { setBrowserStorageValue } from './storage';
import { parseTags, getAllTags } from './tags';
import Fuse from 'fuse.js';

export type SortField = 'date' | 'label';
export type SortDir = 'asc' | 'desc';
export type StatusFilter = 'all' | 'active' | 'inactive';

export function useHmeManager(client: ICloudClient) {
  const [allEmails, setAllEmails] = useState<HmeEmail[]>();
  const [error, setError] = useState<string>();
  const [isFetching, setIsFetching] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedAt, setCachedAt] = useState<number>();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const allRef = useRef(allEmails);
  allRef.current = allEmails;
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!initialLoadDone.current || !allEmails) return;
    const sync = async () => {
      const cache = await getCachedHmeList();
      if (cache) {
        cache.hmeEmails = allEmails;
        await setBrowserStorageValue('hmeCache', cache);
      }
    };
    sync().catch(console.error);
  }, [allEmails]);

  const loadFromCache = useCallback(async () => {
    const cache = await getCachedHmeList();
    if (cache) {
      setAllEmails(cache.hmeEmails);
      setCachedAt(cache.cachedAt);
      setIsFetching(false);
    }
  }, []);

  const fetchFresh = useCallback(async () => {
    setError(undefined);
    try {
      const pms = new PremiumMailSettings(client);
      const result = await pms.listHme();
      const sorted = result.hmeEmails.sort(
        (a, b) => b.createTimestamp - a.createTimestamp
      );
      setAllEmails(sorted);
      const cache = await setCachedHmeList({ ...result, hmeEmails: sorted });
      setCachedAt(cache.cachedAt);
    } catch (e) {
      if (!allRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setIsFetching(false);
      setIsRefreshing(false);
      initialLoadDone.current = true;
    }
  }, [client]);

  useEffect(() => {
    const init = async () => {
      await loadFromCache();
      setIsRefreshing(true);
      await fetchFresh();
    };
    init();
  }, [client, loadFromCache, fetchFresh]);

  const availableTags = useMemo(
    () => getAllTags(allEmails?.map((h) => h.note) || []),
    [allEmails]
  );

  const searchEngine = useMemo(() => {
    if (!allEmails) return null;
    return new Fuse(allEmails, {
      keys: ['label', 'hme', 'note'],
      threshold: 0.3,
    });
  }, [allEmails]);

  const filtered = useMemo(() => {
    if (!allEmails) return [];

    let result = allEmails;

    if (search && searchEngine) {
      result = searchEngine.search(search).map((r) => r.item);
    }

    if (statusFilter !== 'all') {
      result = result.filter((h) =>
        statusFilter === 'active' ? h.isActive : !h.isActive
      );
    }

    if (selectedTags.length > 0) {
      result = result.filter((h) => {
        const { tags } = parseTags(h.note);
        return selectedTags.every((t) => tags.includes(t));
      });
    }

    if (!search) {
      result = [...result].sort((a, b) => {
        const cmp =
          sortField === 'date'
            ? a.createTimestamp - b.createTimestamp
            : a.label.localeCompare(b.label);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [allEmails, search, searchEngine, statusFilter, selectedTags, sortField, sortDir]);

  const counts = useMemo(() => {
    if (!allEmails) return { total: 0, active: 0, inactive: 0 };
    const active = allEmails.filter((h) => h.isActive).length;
    return { total: allEmails.length, active, inactive: allEmails.length - active };
  }, [allEmails]);

  const updateHme = useCallback(
    (id: string, updater: (h: HmeEmail) => HmeEmail) => {
      setAllEmails((prev) =>
        prev?.map((item) => (item.anonymousId === id ? updater(item) : item))
      );
    },
    []
  );

  const addHme = useCallback((hme: HmeEmail) => {
    setAllEmails((prev) => (prev ? [hme, ...prev] : [hme]));
  }, []);

  const removeHme = useCallback((id: string) => {
    setAllEmails((prev) => prev?.filter((item) => item.anonymousId !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(filtered.map((h) => h.anonymousId)));
  }, [filtered]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'label' ? 'asc' : 'desc');
      return field;
    });
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const batchDeactivate = useCallback(async () => {
    setIsBatchProcessing(true);
    const pms = new PremiumMailSettings(client);
    const ids = Array.from(selected);
    const done: string[] = [];

    for (const id of ids) {
      try {
        const hme = allRef.current?.find((h) => h.anonymousId === id);
        if (hme?.isActive) {
          await pms.deactivateHme(id);
          done.push(id);
        }
      } catch (e) {
        console.error(`Failed to deactivate ${id}:`, e);
      }
    }

    setAllEmails((prev) =>
      prev?.map((h) =>
        done.includes(h.anonymousId) ? { ...h, isActive: false } : h
      )
    );
    setSelected(new Set());
    setIsBatchProcessing(false);
  }, [client, selected]);

  return {
    allEmails,
    filtered,
    counts,
    error,
    isFetching,
    isRefreshing,
    cachedAt,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortField,
    sortDir,
    toggleSort,
    selectedTags,
    toggleTag,
    availableTags,
    selected,
    toggleSelected,
    selectAll,
    selectNone,
    isBatchProcessing,
    batchDeactivate,
    updateHme,
    addHme,
    removeHme,
  };
}
