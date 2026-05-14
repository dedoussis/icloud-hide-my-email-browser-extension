import React, { useState, useEffect } from 'react';
import ICloudClient, {
  PremiumMailSettings,
  HmeEmail,
} from '@/src/iCloudClient';
import { useBrowserStorageState } from '@/src/hooks';
import { Spinner, LoadingButton, ErrorMessage } from '@/src/commonComponents';
import { Store, setBrowserStorageValue } from '@/src/storage';
import { PopupState } from '@/src/popupState';
import { clearHmeCache, addCachedHmeEmail } from '@/src/hmeCache';
import { useHmeManager, StatusFilter } from '@/src/useHmeManager';
import { parseTags, serializeTags } from '@/src/tags';
import { exportToCsv, exportToJson, downloadFile } from '@/src/export';
import { CONTEXT_MENU_ITEM_ID, SIGNED_OUT_CTA_COPY } from '@/src/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faSignOut,
  faCopy,
  faCheck,
  faPen,
  faSave,
  faBan,
  faRefresh,
  faTrashAlt,
  faSearch,
  faSortUp,
  faSortDown,
  faFileExport,
  faTimes,
  faGear,
} from '@fortawesome/free-solid-svg-icons';

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className={`text-gray-300 hover:text-sky-500 transition-colors p-1 ${size === 'xs' ? 'text-xs' : 'text-sm'}`}
      title={copied ? 'Copied!' : 'Copy address'}
      type="button"
    >
      <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-emerald-500' : ''} />
    </button>
  );
}

function QuickGenerate({ client, onClose, onReserved }: {
  client: ICloudClient;
  onClose: () => void;
  onReserved: (hme: HmeEmail) => void;
}) {
  const [hme, setHme] = useState<string>();
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const pms = new PremiumMailSettings(client);
        setHme(await pms.generateHme());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setGenerating(false);
      }
    })();
  }, [client]);

  const reserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hme) return;
    setReserving(true);
    setError(undefined);
    try {
      const pms = new PremiumMailSettings(client);
      const result = await pms.reserveHme(hme, label || 'Untitled', note || undefined);
      await addCachedHmeEmail(result);
      setDone(true);
      setTimeout(() => onReserved(result), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReserving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:border-sky-400';

  return (
    <div className="fixed inset-0 bg-black/20 flex items-start justify-center pt-24 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">New Address</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg" type="button">&times;</button>
        </div>

        {generating && <div className="py-4"><Spinner /></div>}
        {error && <ErrorMessage>{error}</ErrorMessage>}

        {done ? (
          <div className="text-center py-4">
            <FontAwesomeIcon icon={faCheck} className="text-emerald-500 text-2xl mb-2" />
            <div className="font-mono text-sm text-gray-600">{hme}</div>
            <div className="text-xs text-gray-400 mt-1">Reserved</div>
          </div>
        ) : hme && !generating && (
          <form onSubmit={reserve} className="space-y-3">
            <div className="text-center py-2">
              <div className="font-mono text-sky-600">{hme}</div>
            </div>
            <input className={inputCls} placeholder="Label (e.g. site name)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className={inputCls} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <LoadingButton loading={reserving} className="w-full justify-center text-white bg-sky-500 hover:bg-sky-600 font-medium rounded-lg px-5 py-2.5 text-center inline-flex items-center">
              Reserve
            </LoadingButton>
          </form>
        )}
      </div>
    </div>
  );
}

function ExpandedTableRow({ hme, client, onUpdate, onRemove }: {
  hme: HmeEmail;
  client: ICloudClient;
  onUpdate: (id: string, updater: (h: HmeEmail) => HmeEmail) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editTags, setEditTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  const parsed = parseTags(hme.note);

  const startEdit = () => {
    setEditLabel(hme.label);
    setEditNote(parsed.note);
    setEditTags(parsed.tags.join(', '));
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean);
      const note = serializeTags(tags, editNote);
      const pms = new PremiumMailSettings(client);
      await pms.updateHmeMetadata(hme.anonymousId, editLabel, note || undefined);
      onUpdate(hme.anonymousId, (h) => ({ ...h, label: editLabel, note }));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    setToggling(true);
    setError(undefined);
    try {
      const pms = new PremiumMailSettings(client);
      if (hme.isActive) await pms.deactivateHme(hme.anonymousId);
      else await pms.reactivateHme(hme.anonymousId);
      onUpdate(hme.anonymousId, (h) => ({ ...h, isActive: !h.isActive }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setToggling(false);
    }
  };

  const deleteHme = async () => {
    setDeleting(true);
    try {
      const pms = new PremiumMailSettings(client);
      await pms.deleteHme(hme.anonymousId);
      onRemove(hme.anonymousId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

  const inputCls = 'px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-hidden focus:border-sky-400';
  const actionBtn = 'text-xs px-3 py-1.5 rounded-md font-medium inline-flex items-center transition-colors';

  return (
    <tr>
      <td colSpan={6} className="px-6 pb-4 pt-0">
        {editing ? (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 max-w-lg">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Label</label>
                <input className={`${inputCls} w-full`} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Tags</label>
                <input className={`${inputCls} w-full`} value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="comma separated" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Note</label>
              <input className={`${inputCls} w-full`} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </div>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <div className="flex gap-2">
              <LoadingButton className={`${actionBtn} bg-sky-500 hover:bg-sky-600 text-white`} onClick={saveEdit} loading={saving} type="button">
                <FontAwesomeIcon icon={faSave} className="mr-1.5" />Save
              </LoadingButton>
              <button className={`${actionBtn} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50`} onClick={() => setEditing(false)} type="button">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-6 text-xs text-gray-400">
              <span>Forward to <span className="text-gray-600">{hme.forwardToEmail}</span></span>
              <span>Created <span className="text-gray-600">{new Date(hme.createTimestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span></span>
              <span>Origin <span className="text-gray-600">{hme.origin === 'ON_DEMAND' ? 'Extension' : 'Safari'}</span></span>
            </div>
            {parsed.note && <div className="text-xs text-gray-500 italic">{parsed.note}</div>}
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <div className="flex gap-1.5 pt-1">
              <button onClick={startEdit} className={`${actionBtn} text-gray-500 hover:bg-gray-100`} type="button">
                <FontAwesomeIcon icon={faPen} className="mr-1.5" />Edit
              </button>
              <LoadingButton
                className={`${actionBtn} ${hme.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                onClick={toggleActive}
                loading={toggling}
                type="button"
              >
                <FontAwesomeIcon icon={hme.isActive ? faBan : faRefresh} className="mr-1.5" />
                {hme.isActive ? 'Deactivate' : 'Reactivate'}
              </LoadingButton>
              {!hme.isActive && (
                <LoadingButton className={`${actionBtn} text-red-500 hover:bg-red-50`} onClick={deleteHme} loading={deleting} type="button">
                  <FontAwesomeIcon icon={faTrashAlt} className="mr-1.5" />Delete
                </LoadingButton>
              )}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function ManagerView({ client, onSignOut }: { client: ICloudClient; onSignOut: () => void }) {
  const mgr = useHmeManager(client);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const hasSelection = mgr.selected.size > 0;
  const allFilteredSelected = mgr.filtered.length > 0 && mgr.filtered.every((h) => mgr.selected.has(h.anonymousId));

  const handleExport = (format: 'csv' | 'json') => {
    const items = hasSelection
      ? mgr.filtered.filter((h) => mgr.selected.has(h.anonymousId))
      : mgr.filtered;
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      downloadFile(exportToCsv(items), `hme-export-${date}.csv`, 'text/csv');
    } else {
      downloadFile(exportToJson(items), `hme-export-${date}.json`, 'application/json');
    }
    setShowExportMenu(false);
  };

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: mgr.counts.total },
    { key: 'active', label: 'Active', count: mgr.counts.active },
    { key: 'inactive', label: 'Inactive', count: mgr.counts.inactive },
  ];

  const sortIcon = mgr.sortDir === 'desc' ? faSortDown : faSortUp;

  if (mgr.isFetching && !mgr.allEmails) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }
  if (mgr.error && !mgr.allEmails) {
    return <div className="p-8"><ErrorMessage>{mgr.error}</ErrorMessage></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showGenerate && (
        <QuickGenerate
          client={client}
          onClose={() => setShowGenerate(false)}
          onReserved={(hme) => { setShowGenerate(false); mgr.addHme(hme); }}
        />
      )}

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hide My Email</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {mgr.counts.total} addresses
              {mgr.isRefreshing && <span className="ml-2 text-gray-300">syncing...</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowGenerate(true)} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center" type="button">
              <FontAwesomeIcon icon={faPlus} className="mr-1.5" />New Address
            </button>
            <button onClick={() => browser.runtime.openOptionsPage()} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Settings" type="button">
              <FontAwesomeIcon icon={faGear} />
            </button>
            <button onClick={onSignOut} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Sign out" type="button">
              <FontAwesomeIcon icon={faSignOut} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-4 space-y-3">
        <div className="relative">
          <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-hidden focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
            placeholder="Search labels, emails, notes..."
            value={mgr.search}
            onChange={(e) => mgr.setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => mgr.setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    mgr.statusFilter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  type="button"
                >
                  {tab.label} <span className="text-gray-400 ml-0.5">{tab.count}</span>
                </button>
              ))}
            </div>
            {mgr.availableTags.length > 0 && (
              <div className="flex items-center gap-1">
                {mgr.availableTags.slice(0, 6).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => mgr.toggleTag(tag)}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      mgr.selectedTags.includes(tag) ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'text-gray-500 border border-gray-200 hover:border-gray-300'
                    }`}
                    type="button"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => mgr.toggleSort(mgr.sortField)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 inline-flex items-center" type="button">
              <FontAwesomeIcon icon={sortIcon} className="mr-1" />
              {mgr.sortField === 'date' ? 'Date' : 'Name'}
            </button>
            <button onClick={() => mgr.toggleSort(mgr.sortField === 'date' ? 'label' : 'date')} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100" type="button">
              by {mgr.sortField === 'date' ? 'name' : 'date'}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 inline-flex items-center"
                type="button"
              >
                <FontAwesomeIcon icon={faFileExport} className="mr-1.5" />
                Export {hasSelection ? `${mgr.selected.size} selected` : mgr.filtered.length < mgr.counts.total ? `${mgr.filtered.length} filtered` : 'all'}
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 w-32">
                  <button onClick={() => handleExport('csv')} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50" type="button">CSV</button>
                  <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50" type="button">JSON</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected && mgr.filtered.length > 0}
                    ref={(el) => { if (el) el.indeterminate = hasSelection && !allFilteredSelected; }}
                    onChange={() => allFilteredSelected ? mgr.selectNone() : mgr.selectAll()}
                    className="rounded border-gray-300 text-sky-500 focus:ring-sky-400"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium">Label</th>
                <th className="px-3 py-3 text-left font-medium">Address</th>
                <th className="px-3 py-3 text-left font-medium">Tags</th>
                <th className="px-3 py-3 text-left font-medium">Created</th>
                <th className="w-12 px-3 py-3 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mgr.filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-400">{mgr.search ? `No results for "${mgr.search}"` : 'No addresses'}</td></tr>
              ) : mgr.filtered.map((hme) => {
                const isExpanded = expandedId === hme.anonymousId;
                const parsed = parseTags(hme.note);
                return (
                  <React.Fragment key={hme.anonymousId}>
                    <tr
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-sky-50/50' : 'hover:bg-gray-50'}`}
                      onClick={() => setExpandedId(isExpanded ? null : hme.anonymousId)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={mgr.selected.has(hme.anonymousId)} onChange={() => mgr.toggleSelected(hme.anonymousId)} className="rounded border-gray-300 text-sky-500 focus:ring-sky-400" />
                      </td>
                      <td className="px-3 py-3"><div className="text-sm font-medium text-gray-900 truncate max-w-48">{hme.label}</div></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-gray-500 truncate max-w-56">{hme.hme}</span>
                          <CopyButton text={hme.hme} size="xs" />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          {parsed.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">{tag}</span>
                          ))}
                          {parsed.tags.length > 2 && <span className="text-xs text-gray-400">+{parsed.tags.length - 2}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(hme.createTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${hme.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} title={hme.isActive ? 'Active' : 'Inactive'} />
                      </td>
                    </tr>
                    {isExpanded && <ExpandedTableRow hme={hme} client={client} onUpdate={mgr.updateHme} onRemove={mgr.removeHme} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{mgr.selected.size} selected</span>
          <div className="w-px h-5 bg-gray-700" />
          <LoadingButton className="text-sm px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg font-medium inline-flex items-center text-white" onClick={mgr.batchDeactivate} loading={mgr.isBatchProcessing} type="button">
            <FontAwesomeIcon icon={faBan} className="mr-1.5" />Deactivate
          </LoadingButton>
          <button onClick={() => handleExport('csv')} className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium inline-flex items-center" type="button">
            <FontAwesomeIcon icon={faFileExport} className="mr-1.5" />Export
          </button>
          <button onClick={mgr.selectNone} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700" type="button">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}
    </div>
  );
}

const constructClient = (clientState: Store['clientState']): ICloudClient => {
  if (!clientState) throw new Error('No client state');
  return new ICloudClient(clientState.setupUrl, clientState.webservices);
};

export default function ManagerPage() {
  const [clientState, , isLoading] = useBrowserStorageState('clientState', undefined);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    (async () => {
      if (clientState?.setupUrl) {
        const client = new ICloudClient(clientState.setupUrl);
        setAuthed(await client.isAuthenticated());
      }
      setChecking(false);
    })();
  }, [clientState?.setupUrl, isLoading]);

  if (isLoading || checking) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><Spinner /></div>;
  if (!authed || !clientState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-gray-600">Not signed in</p>
          <p className="text-sm text-gray-400">Sign in to iCloud via the extension popup.</p>
        </div>
      </div>
    );
  }

  return (
    <ManagerView
      client={constructClient(clientState)}
      onSignOut={async () => {
        const client = constructClient(clientState);
        await client.signOut();
        setBrowserStorageValue('clientState', undefined);
        setBrowserStorageValue('popupState', PopupState.SignedOut);
        await clearHmeCache();
        browser.contextMenus.update(CONTEXT_MENU_ITEM_ID, { title: SIGNED_OUT_CTA_COPY, enabled: false }).catch(console.debug);
        window.location.reload();
      }}
    />
  );
}
