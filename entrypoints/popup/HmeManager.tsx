import React, { useState } from 'react';
import ICloudClient, {
  PremiumMailSettings,
  HmeEmail,
} from '@/src/iCloudClient';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faPlus,
  faSignOut,
  faArrowUpRightFromSquare,
  faCopy,
  faCheck,
  faPen,
  faSave,
  faTimes,
  faBan,
  faRefresh,
  faTrashAlt,
  faChevronDown,
  faSort,
} from '@fortawesome/free-solid-svg-icons';
import { ErrorMessage, Spinner, LoadingButton } from '@/src/commonComponents';
import { useHmeManager, StatusFilter } from '@/src/useHmeManager';
import { parseTags, serializeTags } from '@/src/tags';
import { MessageType, sendMessageToTab } from '@/src/messages';

type Props = {
  onGenerate: () => void;
  onSignOut: () => void;
  client: ICloudClient;
};

function CopyButton({ text }: { text: string }) {
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
      className="text-gray-300 hover:text-sky-500 transition-colors p-1"
      title="Copy address"
      type="button"
    >
      <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? 'text-emerald-500' : ''} />
    </button>
  );
}

function ExpandedRow({
  hme,
  client,
  onUpdate,
  onRemove,
}: {
  hme: HmeEmail;
  client: ICloudClient;
  onUpdate: (id: string, updater: (h: HmeEmail) => HmeEmail) => void;
  onRemove: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
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
    setIsEditing(true);
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
      setIsEditing(false);
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

  const autofill = async () => {
    await sendMessageToTab(MessageType.Autofill, hme.hme);
  };

  const inputCls =
    'w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-hidden focus:border-sky-400';

  if (isEditing) {
    return (
      <div className="px-4 pb-3 space-y-2">
        <div>
          <label className="text-xs text-gray-400 font-medium">Label</label>
          <input className={inputCls} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 font-medium">Tags</label>
          <input className={inputCls} value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="comma separated" />
        </div>
        <div>
          <label className="text-xs text-gray-400 font-medium">Note</label>
          <input className={inputCls} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex gap-2">
          <LoadingButton
            className="flex-1 justify-center text-white bg-sky-500 hover:bg-sky-600 font-medium rounded px-3 py-1.5 text-xs inline-flex items-center"
            onClick={saveEdit}
            loading={saving}
            type="button"
          >
            <FontAwesomeIcon icon={faSave} className="mr-1" /> Save
          </LoadingButton>
          <button
            className="flex-1 justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded px-3 py-1.5 text-xs inline-flex items-center"
            onClick={() => setIsEditing(false)}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-gray-500 select-all flex-1 break-all">{hme.hme}</span>
        <CopyButton text={hme.hme} />
      </div>

      <div className="text-xs text-gray-400 space-y-0.5">
        <div>Forward to {hme.forwardToEmail}</div>
        <div>{new Date(hme.createTimestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
      </div>

      {parsed.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parsed.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-xs bg-sky-50 text-sky-600 rounded">#{tag}</span>
          ))}
        </div>
      )}

      {parsed.note && <div className="text-xs text-gray-400 italic">{parsed.note}</div>}

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <div className="flex gap-1.5 pt-1">
        <button onClick={startEdit} className="text-xs text-gray-400 hover:text-sky-500 px-2 py-1 rounded hover:bg-gray-50" type="button">
          <FontAwesomeIcon icon={faPen} className="mr-1" />Edit
        </button>
        <button onClick={autofill} className="text-xs text-gray-400 hover:text-sky-500 px-2 py-1 rounded hover:bg-gray-50" type="button">
          <FontAwesomeIcon icon={faCheck} className="mr-1" />Autofill
        </button>
        <LoadingButton
          className={`text-xs px-2 py-1 rounded inline-flex items-center ${
            hme.isActive
              ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'
          }`}
          onClick={toggleActive}
          loading={toggling}
          type="button"
        >
          <FontAwesomeIcon icon={hme.isActive ? faBan : faRefresh} className="mr-1" />
          {hme.isActive ? 'Deactivate' : 'Reactivate'}
        </LoadingButton>
        {!hme.isActive && (
          <LoadingButton
            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 inline-flex items-center"
            onClick={deleteHme}
            loading={deleting}
            type="button"
          >
            <FontAwesomeIcon icon={faTrashAlt} className="mr-1" />Delete
          </LoadingButton>
        )}
      </div>
    </div>
  );
}

export function HmeManager({ onGenerate, onSignOut, client }: Props) {
  const mgr = useHmeManager(client);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (mgr.isFetching && !mgr.allEmails) {
    return (
      <div className="p-8">
        <Spinner />
      </div>
    );
  }

  if (mgr.error && !mgr.allEmails) {
    return (
      <div className="p-4">
        <ErrorMessage>{mgr.error}</ErrorMessage>
      </div>
    );
  }

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: mgr.counts.total },
    { key: 'active', label: 'Active', count: mgr.counts.active },
    { key: 'inactive', label: 'Inactive', count: mgr.counts.inactive },
  ];

  return (
    <div className="flex flex-col" style={{ height: '520px' }}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold text-gray-900">Hide My Email</h1>
          <span className="text-xs text-gray-300">
            {mgr.isRefreshing ? 'syncing...' : mgr.counts.total > 0 ? `${mgr.counts.total} addresses` : ''}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm" />
          <input
            type="search"
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-hidden focus:border-sky-400 focus:bg-white transition-colors"
            placeholder="Search addresses..."
            value={mgr.search}
            onChange={(e) => mgr.setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Status tabs + sort */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => mgr.setStatusFilter(tab.key)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                mgr.statusFilter === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              type="button"
            >
              {tab.label}
              <span className={`ml-1 ${mgr.statusFilter === tab.key ? 'text-gray-400' : 'text-gray-300'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => mgr.toggleSort(mgr.sortField === 'date' ? 'label' : 'date')}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          title={`Sort by ${mgr.sortField === 'date' ? 'name' : 'date'}`}
          type="button"
        >
          <FontAwesomeIcon icon={faSort} className="mr-1" />
          {mgr.sortField === 'date' ? 'Date' : 'A-Z'}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto border-t border-gray-100">
        {mgr.filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {mgr.search ? `No results for "${mgr.search}"` : 'No addresses'}
          </div>
        ) : (
          mgr.filtered.map((hme) => {
            const isExpanded = expandedId === hme.anonymousId;
            return (
              <div key={hme.anonymousId} className={`border-b border-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : hme.anonymousId)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  type="button"
                >
                  {/* Status dot */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${hme.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`}
                    title={hme.isActive ? 'Active' : 'Inactive'}
                  />

                  {/* Label + email */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{hme.label}</div>
                    <div className="text-xs text-gray-400 font-mono truncate">{hme.hme}</div>
                  </div>

                  {/* Copy + expand */}
                  <CopyButton text={hme.hme} />
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`text-gray-300 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <ExpandedRow
                    hme={hme}
                    client={client}
                    onUpdate={mgr.updateHme}
                    onRemove={mgr.removeHme}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-200 flex items-center justify-between bg-white">
        <div className="flex gap-4">
          <button onClick={onGenerate} className="text-xs font-medium text-sky-500 hover:text-sky-600" type="button">
            <FontAwesomeIcon icon={faPlus} className="mr-1" />New
          </button>
          <button
            onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/manager.html') })}
            className="text-xs font-medium text-sky-500 hover:text-sky-600"
            type="button"
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="mr-1" />Manager
          </button>
        </div>
        <button onClick={onSignOut} className="text-xs text-gray-400 hover:text-gray-600" type="button">
          <FontAwesomeIcon icon={faSignOut} className="mr-1" />Sign out
        </button>
      </div>
    </div>
  );
}
