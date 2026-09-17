import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  List,
  ListChecks,
  Loader2,
  Palette,
  Paperclip,
  Pin,
  Plus,
  Search,
  Strikethrough,
  Trash2,
  X
} from 'lucide-react';
import { Branch, CredicelDashAttachment, CredicelDashCheckItem, CredicelDashDoc, Operator } from '../types';
import { newUniqueId } from '../lib/ids';
import { safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import {
  dashDocSnippet,
  dataUrlToBlob,
  deleteDashFile,
  emptyCheckItem,
  emptyDashDoc,
  fileExtOf,
  fileKindOf,
  formatDashFileSize,
  getDashFile,
  isDashDocEmpty,
  KEEP_NOTE_COLORS,
  loadCachedDashDocs,
  loadDashView,
  MAX_DASH_FILE_BYTES,
  putDashFile,
  saveCachedDashDocs,
  saveDashView,
  sanitizeDashHtml,
  sortCheckedItemsLast,
  sortDashDocs,
  bodyHtmlToCheckItems,
  checkItemsToBodyHtml
} from '../lib/credicelDashboard';
import {
  deleteCredicelDashDocFromCloud,
  fetchDashBlobDataUrl,
  persistDashAttachmentFile,
  saveCredicelDashDocToCloud,
  subscribeToCredicelDashDocs
} from '../lib/credicelDashboardCloud';

interface CredicelDashboardModuleProps {
  currentOperator: Operator;
  currentBranch: Branch;
}

type DashView = 'grid' | 'list';

function FileGlyph({ mime, name, className = 'w-5 h-5' }: { mime: string; name: string; className?: string }) {
  const kind = fileKindOf(mime, name);
  if (kind === 'image') return <ImageIcon className={`${className} text-emerald-600`} />;
  if (kind === 'pdf') return <FileText className={`${className} text-rose-600`} />;
  return <Paperclip className={`${className} text-blue-700`} />;
}

async function resolveAttachmentUrl(att: CredicelDashAttachment): Promise<string | null> {
  if (att.downloadUrl) return att.downloadUrl;
  const local = await getDashFile(att.id);
  if (local) return URL.createObjectURL(local);
  if (att.hasCloudBlob) {
    const dataUrl = await fetchDashBlobDataUrl(att.id);
    if (!dataUrl) return null;
    const blob = dataUrlToBlob(dataUrl);
    if (blob) {
      await putDashFile(att.id, blob);
      return URL.createObjectURL(blob);
    }
    return dataUrl;
  }
  return null;
}

function PinToggle({
  pinned,
  onClick,
  withLabel = false,
  size = 'md'
}: {
  pinned: boolean;
  onClick: (event: React.MouseEvent) => void;
  withLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full cursor-pointer shrink-0 ${
        withLabel ? 'px-2 py-1' : 'p-1'
      } ${
        pinned
          ? 'text-slate-900 bg-black/10'
          : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
      }`}
      title={pinned ? 'No fijar' : 'Fijar'}
      aria-pressed={pinned}
      aria-label={pinned ? 'No fijar' : 'Fijar'}
    >
      <Pin className={`${iconClass} ${pinned ? 'fill-current' : ''}`} />
      {withLabel && (
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {pinned ? 'No fijar' : 'Fijar'}
        </span>
      )}
    </button>
  );
}

function AttachmentThumb({
  att,
  url,
  className = 'w-7 h-7'
}: {
  att: CredicelDashAttachment;
  url?: string;
  className?: string;
}) {
  const kind = fileKindOf(att.mimeType, att.fileName);
  return (
    <span className={`relative ${className} rounded overflow-hidden border border-black/10 bg-slate-100 shrink-0 flex items-center justify-center`}>
      {kind === 'image' && url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <FileGlyph mime={att.mimeType} name={att.fileName} className="w-3.5 h-3.5" />
      )}
    </span>
  );
}

function AttachmentListRow({
  att,
  url,
  compact = false,
  onOpen,
  onRemove,
  onRename
}: {
  att: CredicelDashAttachment;
  url?: string;
  compact?: boolean;
  onOpen: (att: CredicelDashAttachment) => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
}) {
  const kind = fileKindOf(att.mimeType, att.fileName);
  const ext = fileExtOf(att.fileName);
  const label = att.title || att.fileName;
  const kindLabel = kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Imagen' : ext;

  return (
    <div
      className="flex items-center gap-2 min-w-0 py-1"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onOpen(att)}
        className="cursor-pointer shrink-0"
        title={label}
      >
        <AttachmentThumb att={att} url={url} className={compact ? 'w-6 h-6' : 'w-7 h-7'} />
      </button>
      {onRename && !compact ? (
        <div className="min-w-0 flex-1">
          <input
            value={att.title}
            onChange={(e) => onRename(att.id, e.target.value)}
            className="w-full bg-transparent text-[13px] font-medium text-slate-900 outline-none"
            placeholder="Título del archivo"
          />
          <p className="text-[11px] text-slate-500 truncate">
            {kindLabel} · {formatDashFileSize(att.size)}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(att)}
          className="min-w-0 flex-1 text-left cursor-pointer"
          title={label}
        >
          <p className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-medium text-slate-800 truncate`}>
            {label}
          </p>
          {!compact && (
            <p className="text-[11px] text-slate-500 truncate">
              {kindLabel} · {formatDashFileSize(att.size)}
            </p>
          )}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(att.id)}
          className="p-1 text-slate-400 hover:text-rose-700 cursor-pointer shrink-0"
          title="Quitar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function NoteCard({
  doc,
  previewMap,
  onOpen,
  onPin,
  onOpenFile
}: {
  doc: CredicelDashDoc;
  previewMap: Record<string, string>;
  onOpen: (doc: CredicelDashDoc) => void;
  onPin: (doc: CredicelDashDoc, event?: React.MouseEvent) => void;
  onOpenFile: (att: CredicelDashAttachment) => void;
}) {
  const snippet = dashDocSnippet(doc, 160);
  const listedAtts = doc.attachments.slice(0, 3);
  const extraAtts = Math.max(0, doc.attachments.length - listedAtts.length);
  const listItems =
    doc.checklist || doc.items.length > 0
      ? sortCheckedItemsLast(doc.items)
          .filter((item) => item.text.trim())
          .slice(0, 6)
      : [];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(doc)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(doc);
        }
      }}
      style={{ backgroundColor: doc.color || '#ffffff' }}
      className="text-left rounded-lg border border-black/5 shadow-sm min-h-[120px] hover:shadow-md transition-shadow cursor-pointer flex flex-col overflow-hidden"
    >
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start gap-2">
          <p className="text-[15px] font-medium text-slate-900 truncate flex-1">
            {doc.title || (doc.attachments[0]?.title || 'Sin título')}
          </p>
          <PinToggle pinned={Boolean(doc.pinned)} onClick={(e) => onPin(doc, e)} />
        </div>
        {listItems.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {listItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-[13px] leading-snug">
                <span
                  className={`mt-0.5 w-3.5 h-3.5 rounded-sm border shrink-0 ${
                    item.checked ? 'bg-slate-400 border-slate-400' : 'border-slate-400'
                  }`}
                />
                <span className={item.checked ? 'line-through text-slate-400' : 'text-slate-700'}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        ) : snippet ? (
          <p className="text-[13px] text-slate-700/80 line-clamp-4 mt-1 whitespace-pre-wrap leading-relaxed">
            {snippet}
          </p>
        ) : null}
        {listedAtts.length > 0 && (
          <div className="mt-auto pt-2 border-t border-black/5">
            {listedAtts.map((att) => (
              <AttachmentListRow
                key={att.id}
                att={att}
                url={previewMap[att.id]}
                compact
                onOpen={onOpenFile}
              />
            ))}
            {extraAtts > 0 && (
              <p className="text-[11px] text-slate-500 pl-8">+{extraAtts} más</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CredicelDashboardModule({
  currentOperator,
  currentBranch
}: CredicelDashboardModuleProps) {
  const [docs, setDocs] = useState<CredicelDashDoc[]>(() => loadCachedDashDocs());
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<DashView>(() => loadDashView());
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<CredicelDashDoc>(() => emptyDashDoc());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedPreviewIds = useRef(new Set<string>());
  const itemInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const composerIdRef = useRef(newUniqueId('CHK'));

  useEffect(() => {
    const unsub = subscribeToCredicelDashDocs(
      (cloudDocs) => {
        setDocs((prev) => {
          const cloudIds = new Set(cloudDocs.map((d) => d.id));
          const pending = prev.filter((local) => {
            if (cloudIds.has(local.id)) return false;
            const ts = Date.parse(local.updatedAt || local.createdAt || '');
            return Number.isFinite(ts) && Date.now() - ts < 5 * 60 * 1000;
          });
          const merged = sortDashDocs([...cloudDocs, ...pending]);
          saveCachedDashDocs(merged);
          return merged;
        });
        setCloudError(null);
        setLoading(false);
      },
      () => {
        setCloudError('La nube no respondió. Los documentos de este equipo siguen disponibles.');
        setLoading(false);
      }
    );
    const fallback = window.setTimeout(() => setLoading(false), 4000);
    return () => {
      unsub();
      window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const atts = [...docs.flatMap((d) => d.attachments), ...draft.attachments];
    atts.forEach((att) => {
      if (loadedPreviewIds.current.has(att.id)) return;
      loadedPreviewIds.current.add(att.id);
      void resolveAttachmentUrl(att).then((url) => {
        if (!url) {
          loadedPreviewIds.current.delete(att.id);
          return;
        }
        setPreviewMap((prev) => (prev[att.id] ? prev : { ...prev, [att.id]: url }));
      });
    });
  }, [docs, draft.attachments]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = !q
      ? docs
      : docs.filter((doc) => {
          const hay = [
            doc.title,
            dashDocSnippet(doc, 200),
            doc.authorName,
            ...doc.attachments.map((att) => `${att.title} ${att.fileName}`),
            ...doc.items.map((item) => item.text)
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        });
    return sortDashDocs(list);
  }, [docs, searchQuery]);

  const pinnedDocs = useMemo(() => filteredDocs.filter((d) => d.pinned), [filteredDocs]);
  const otherDocs = useMemo(() => filteredDocs.filter((d) => !d.pinned), [filteredDocs]);

  const changeView = (next: DashView) => {
    setView(next);
    saveDashView(next);
  };

  const openNew = () => {
    const next = emptyDashDoc({
      id: newUniqueId('DASH'),
      authorName: currentOperator.name,
      authorId: currentOperator.id
    });
    setDraft(next);
    composerIdRef.current = newUniqueId('CHK');
    setColorPickerOpen(false);
    setEditorOpen(true);
  };

  const openDoc = (doc: CredicelDashDoc) => {
    const checklist = Boolean(doc.checklist) || doc.items.length > 0;
    setDraft({
      ...doc,
      checklist,
      items: sortCheckedItemsLast(doc.items.map((item) => ({ ...item }))),
      attachments: [...doc.attachments]
    });
    composerIdRef.current = newUniqueId('CHK');
    setColorPickerOpen(false);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!editorOpen) return;
    if (draft.checklist) return;
    const html = draft.bodyHtml || '';
    const frame = window.requestAnimationFrame(() => {
      const node = bodyRef.current;
      if (node) node.innerHTML = html;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editorOpen, draft.id, draft.checklist]);

  const persistDoc = (next: CredicelDashDoc) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setDocs((prev) => {
      const others = prev.filter((row) => row.id !== stamped.id);
      const merged = sortDashDocs([stamped, ...others]);
      saveCachedDashDocs(merged);
      return merged;
    });
    saveCredicelDashDocToCloud(stamped)
      .then(() => setCloudError(null))
      .catch((err) => {
        console.error(err);
        setCloudError('Se guardó en este equipo. Al volver la nube se intentará subir.');
      });
  };

  const closeEditor = (discard = false) => {
    if (!discard) {
      const usingList = Boolean(draft.checklist);
      const items = usingList
        ? sortCheckedItemsLast(draft.items.filter((item) => item.id && item.text.trim()))
        : [];
      const bodyHtml = usingList ? '' : sanitizeDashHtml(bodyRef.current?.innerHTML || draft.bodyHtml);
      const next: CredicelDashDoc = {
        ...draft,
        title: draft.title.trim() || (draft.attachments[0]?.title || ''),
        bodyHtml,
        items,
        checklist: usingList
      };
      if (!isDashDocEmpty(next) || docs.some((row) => row.id === draft.id)) {
        if (!isDashDocEmpty(next)) persistDoc({ ...next, title: next.title || 'Sin título' });
      }
    }
    setColorPickerOpen(false);
    setEditorOpen(false);
  };

  const togglePinned = (doc: CredicelDashDoc, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (editorOpen && draft.id === doc.id) {
      const bodyHtml = sanitizeDashHtml(bodyRef.current?.innerHTML || draft.bodyHtml);
      const next = { ...draft, bodyHtml, pinned: !draft.pinned };
      setDraft(next);
      if (!isDashDocEmpty(next) || docs.some((row) => row.id === next.id)) {
        persistDoc({ ...next, title: next.title.trim() || 'Sin título' });
      }
      return;
    }
    persistDoc({ ...doc, pinned: !doc.pinned });
  };

  const handleDeleteDoc = async (doc: CredicelDashDoc) => {
    if (!window.confirm(`¿Borrar “${doc.title || 'Sin título'}”? Esta acción no se puede deshacer.`)) return;
    setDocs((prev) => {
      const next = prev.filter((row) => row.id !== doc.id);
      saveCachedDashDocs(next);
      return next;
    });
    if (editorOpen && draft.id === doc.id) setEditorOpen(false);
    try {
      await deleteCredicelDashDocFromCloud(doc.id, doc.attachments);
    } catch (err) {
      console.error(err);
      setCloudError('No se pudo borrar en la nube. En este equipo ya no aparece.');
    }
  };

  const strikeSelectionInBody = () => {
    bodyRef.current?.focus();
    document.execCommand('strikeThrough', false);
    const html = bodyRef.current?.innerHTML;
    if (html != null) setDraft((prev) => ({ ...prev, bodyHtml: html }));
  };

  const toggleChecklist = () => {
    if (draft.checklist) {
      const html = checkItemsToBodyHtml(draft.items);
      setDraft((prev) => ({ ...prev, checklist: false, bodyHtml: html, items: [] }));
      window.requestAnimationFrame(() => {
        if (bodyRef.current) bodyRef.current.innerHTML = html;
      });
      return;
    }
    const html = sanitizeDashHtml(bodyRef.current?.innerHTML || draft.bodyHtml);
    const fromBody = bodyHtmlToCheckItems(html, () => newUniqueId('CHK')).filter((item) => item.text.trim());
    const existing = draft.items.filter((item) => item.text.trim());
    const merged = fromBody.length ? fromBody : existing;
    composerIdRef.current = newUniqueId('CHK');
    setDraft((prev) => ({
      ...prev,
      checklist: true,
      bodyHtml: '',
      items: sortCheckedItemsLast(merged.length ? merged : [emptyCheckItem(newUniqueId('CHK'))])
    }));
  };

  const updateChecklistItem = (id: string, patch: Partial<CredicelDashCheckItem>) => {
    setDraft((prev) => {
      const exists = prev.items.some((item) => item.id === id);
      const items = exists
        ? prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item))
        : [...prev.items, { ...emptyCheckItem(id), ...patch }];
      if (id === composerIdRef.current && (patch.text || '').trim()) {
        composerIdRef.current = newUniqueId('CHK');
      }
      return { ...prev, items: sortCheckedItemsLast(items) };
    });
  };

  const removeChecklistItem = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id)
    }));
  };

  const handleChecklistKey = (item: CredicelDashCheckItem, index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const newId = newUniqueId('CHK');
      setDraft((prev) => {
        const current = prev.items.some((row) => row.id === item.id)
          ? prev.items
          : [...prev.items, { ...item }];
        const idx = current.findIndex((row) => row.id === item.id);
        const next = [...current];
        next.splice(idx + 1, 0, emptyCheckItem(newId));
        return { ...prev, items: sortCheckedItemsLast(next) };
      });
      window.requestAnimationFrame(() => itemInputRefs.current[newId]?.focus());
      return;
    }
    if (event.key === 'Backspace' && !item.text) {
      const rows = draft.items.filter((row) => row.text.trim() || row.id === item.id);
      if (rows.length <= 1) return;
      event.preventDefault();
      const prevId = draft.items[Math.max(0, index - 1)]?.id;
      removeChecklistItem(item.id);
      window.requestAnimationFrame(() => {
        const target = prevId ? itemInputRefs.current[prevId] : null;
        target?.focus();
      });
    }
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const added: CredicelDashAttachment[] = [];
    for (const file of files) {
      if (file.size > MAX_DASH_FILE_BYTES) {
        alert(`“${file.name}” pesa más de 12 MB. Elige un archivo más ligero.`);
        continue;
      }
      const lower = file.name.toLowerCase();
      const mime =
        file.type ||
        (lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
            ? 'image/jpeg'
            : lower.endsWith('.pdf')
              ? 'application/pdf'
              : 'application/octet-stream');
      const att: CredicelDashAttachment = {
        id: newUniqueId('FILE'),
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        mimeType: mime,
        size: file.size,
        hasLocal: true
      };
      await putDashFile(att.id, file);
      const preview = URL.createObjectURL(file);
      loadedPreviewIds.current.add(att.id);
      setPreviewMap((prev) => ({ ...prev, [att.id]: preview }));
      added.push(att);
      persistDashAttachmentFile(att, file)
        .then((stored) => {
          setDraft((prev) => ({
            ...prev,
            attachments: prev.attachments.map((row) => (row.id === stored.id ? stored : row))
          }));
        })
        .catch((err) => console.error(err));
    }
    if (!added.length) return;
    setDraft((prev) => {
      const next = { ...prev, attachments: [...prev.attachments, ...added] };
      const bodyHtml = sanitizeDashHtml(bodyRef.current?.innerHTML || next.bodyHtml);
      const stamped = {
        ...next,
        bodyHtml,
        title: next.title.trim() || added[0].title || 'Sin título'
      };
      persistDoc(stamped);
      return stamped;
    });
  };

  const renameAttachment = (id: string, title: string) => {
    setDraft((prev) => ({
      ...prev,
      attachments: prev.attachments.map((att) => (att.id === id ? { ...att, title } : att))
    }));
  };

  const removeAttachment = async (id: string) => {
    const att = draft.attachments.find((row) => row.id === id);
    setDraft((prev) => ({ ...prev, attachments: prev.attachments.filter((row) => row.id !== id) }));
    await deleteDashFile(id);
    if (att?.storagePath || att?.hasCloudBlob) {
      // cloud cleanup happens when the document is saved/deleted
    }
  };

  const openAttachment = async (att: CredicelDashAttachment) => {
    let url = previewMap[att.id] || att.downloadUrl || null;
    if (!url) url = await resolveAttachmentUrl(att);
    if (!url) {
      alert('Este archivo está en otro equipo o aún no sube a la nube.');
      return;
    }
    if (fileKindOf(att.mimeType, att.fileName) === 'image') {
      setPreviewUrl(url);
      setPreviewName(att.title || att.fileName);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleBoardDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDropActive(false);
    const files = event.dataTransfer.files;
    if (!files?.length) return;
    openNew();
    await addFiles(files);
  };

  const openItems = sortCheckedItemsLast(draft.items).filter((item) => !item.checked);
  const doneItems = sortCheckedItemsLast(draft.items).filter((item) => item.checked);
  const openWithComposer =
    draft.checklist && !openItems.some((item) => !item.text.trim())
      ? [...openItems, emptyCheckItem(composerIdRef.current)]
      : openItems;

  return (
    <>
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900">Notas</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Notas, listas para marcar y archivos de {currentBranch.name}.
              </p>
            </div>
            <div className="sm:ml-auto flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar notas…"
                  className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white"
                />
              </div>
              <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => changeView('grid')}
                  className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${
                    view === 'grid' ? 'bg-[#0047AB] text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Ver recuadros"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => changeView('list')}
                  className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${
                    view === 'list' ? 'bg-[#0047AB] text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Ver lista"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0047AB] hover:bg-[#003d93] text-white text-sm font-extrabold cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={openNew}
            className="w-full max-w-xl mx-auto flex items-center gap-3 rounded-lg bg-white shadow-md border border-black/5 px-4 py-3 text-left cursor-pointer hover:shadow-lg"
          >
            <span className="flex-1 text-[15px] text-slate-500">Añade una nota…</span>
            <Plus className="w-5 h-5 text-slate-400" />
          </button>

          {cloudError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              {cloudError}
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={handleBoardDrop}
            className={`min-h-[420px] rounded-2xl border-2 border-dashed p-3 sm:p-4 transition-colors ${
              dropActive ? 'border-[#0047AB] bg-blue-50' : 'border-transparent'
            }`}
          >
            {loading && docs.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-xs font-semibold">Cargando notas…</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center px-4">
                <FolderOpen className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-black text-slate-800">
                  {searchQuery.trim() ? 'No hay coincidencias' : 'Aún no hay notas'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {searchQuery.trim()
                    ? 'Prueba con otro título o nombre de archivo.'
                    : 'Pulsa + para escribir una nota o adjuntar archivos. También puedes soltar archivos aquí.'}
                </p>
              </div>
            ) : view === 'grid' ? (
              <div className="space-y-6">
                {pinnedDocs.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 px-0.5">Fijadas</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {pinnedDocs.map((doc) => (
                        <NoteCard
                          key={doc.id}
                          doc={doc}
                          previewMap={previewMap}
                          onOpen={openDoc}
                          onPin={togglePinned}
                          onOpenFile={(att) => void openAttachment(att)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {otherDocs.length > 0 && (
                  <div>
                    {pinnedDocs.length > 0 && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 px-0.5">Otras</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {otherDocs.map((doc) => (
                        <NoteCard
                          key={doc.id}
                          doc={doc}
                          previewMap={previewMap}
                          onOpen={openDoc}
                          onPin={togglePinned}
                          onOpenFile={(att) => void openAttachment(att)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="hidden sm:grid grid-cols-[1fr_140px_120px_160px] gap-2 px-4 py-2 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <span>Nombre</span>
                  <span>Actualizado</span>
                  <span>Autor</span>
                  <span className="text-right">Archivos</span>
                </div>
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex sm:grid sm:grid-cols-[1fr_140px_120px_160px] gap-2 items-center px-4 py-3 border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => openDoc(doc)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-1">
                          {doc.pinned && <Pin className="w-3 h-3 fill-current" />}
                          {doc.title || (doc.attachments[0]?.title || 'Sin título')}
                        </p>
                        <p className="sm:hidden text-[11px] text-slate-500 truncate">{dashDocSnippet(doc, 60)}</p>
                      </div>
                      <PinToggle pinned={Boolean(doc.pinned)} withLabel onClick={(e) => togglePinned(doc, e)} size="sm" />
                    </div>
                    <p className="hidden sm:block text-xs text-slate-600">
                      {safeFormatDate(doc.updatedAt)} {safeFormatTime(doc.updatedAt)}
                    </p>
                    <p className="hidden sm:block text-xs text-slate-600 truncate">{doc.authorName || '—'}</p>
                    <div className="min-w-0 text-right">
                      {doc.attachments.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {doc.attachments.slice(0, 2).map((att) => (
                            <button
                              key={att.id}
                              type="button"
                              title={att.title || att.fileName}
                              onClick={(e) => {
                                e.stopPropagation();
                                void openAttachment(att);
                              }}
                              className="w-full flex items-center justify-end gap-1.5 min-w-0 cursor-pointer"
                            >
                              <span className="text-[11px] font-medium text-slate-700 truncate max-w-[90px]">
                                {att.title || att.fileName}
                              </span>
                              <AttachmentThumb att={att} url={previewMap[att.id]} className="w-6 h-6" />
                            </button>
                          ))}
                          {doc.attachments.length > 2 && (
                            <p className="text-[10px] text-slate-500">+{doc.attachments.length - 2} más</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-6"
          onClick={() => closeEditor(false)}
        >
          <div
            role="dialog"
            aria-label="Nota"
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
            }}
            style={{ backgroundColor: draft.color || '#ffffff' }}
            className="w-full sm:max-w-[560px] sm:rounded-xl rounded-t-2xl shadow-2xl border border-black/5 max-h-[94vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-3 pt-2">
              <PinToggle pinned={Boolean(draft.pinned)} withLabel onClick={() => togglePinned(draft)} size="md" />
              <button
                type="button"
                onClick={() => closeEditor(false)}
                className="p-1.5 rounded-full text-slate-500 hover:bg-black/5 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pb-2 flex-1 overflow-y-auto min-h-0">
              <input
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Título"
                className="w-full bg-transparent text-[17px] font-medium text-slate-900 placeholder:text-slate-400 outline-none py-1"
              />
              {draft.checklist ? (
                <div className="mt-1 min-h-[280px] sm:min-h-[320px]">
                  {openWithComposer.map((item, index) => (
                    <div key={item.id} className="flex items-start gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => {
                          if (!item.text.trim() && item.id === composerIdRef.current) return;
                          updateChecklistItem(item.id, { checked: true });
                        }}
                        className="mt-2 cursor-pointer"
                      />
                      <input
                        ref={(node) => {
                          itemInputRefs.current[item.id] = node;
                        }}
                        value={item.text}
                        onChange={(e) => updateChecklistItem(item.id, { text: e.target.value })}
                        onKeyDown={(e) => handleChecklistKey(item, index, e)}
                        placeholder="Elemento de la lista"
                        className="flex-1 bg-transparent text-[15px] text-slate-800 outline-none py-0.5"
                      />
                    </div>
                  ))}
                  {doneItems.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-black/10">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                        Marcado
                      </p>
                      {doneItems.map((item, index) => (
                        <div key={item.id} className="flex items-start gap-2 py-1">
                          <input
                            type="checkbox"
                            checked
                            onChange={() => updateChecklistItem(item.id, { checked: false })}
                            className="mt-2 cursor-pointer"
                          />
                          <input
                            ref={(node) => {
                              itemInputRefs.current[item.id] = node;
                            }}
                            value={item.text}
                            onChange={(e) => updateChecklistItem(item.id, { text: e.target.value })}
                            onKeyDown={(e) => handleChecklistKey(item, openWithComposer.length + index, e)}
                            className="flex-1 bg-transparent text-[15px] text-slate-400 line-through outline-none py-0.5"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative mt-1">
                  {!draft.bodyHtml && (
                    <span className="absolute left-0 top-1 text-[15px] text-slate-400 pointer-events-none">
                      Añade una nota…
                    </span>
                  )}
                  <div
                    key={draft.id}
                    ref={bodyRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const html = e.currentTarget.innerHTML;
                      setDraft((prev) => ({ ...prev, bodyHtml: html }));
                    }}
                    className="min-h-[280px] sm:min-h-[320px] w-full text-[15px] leading-relaxed text-slate-800 outline-none py-1"
                  />
                </div>
              )}

              {draft.attachments.length > 0 && (
                <div className="mt-3 pt-2 border-t border-black/10">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Archivos</p>
                  {draft.attachments.map((att) => (
                    <AttachmentListRow
                      key={att.id}
                      att={att}
                      url={previewMap[att.id]}
                      onOpen={(file) => void openAttachment(file)}
                      onRemove={(id) => void removeAttachment(id)}
                      onRename={renameAttachment}
                    />
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="relative flex items-center gap-1 px-2 py-1.5 border-t border-black/5">
              {!draft.checklist && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    strikeSelectionInBody();
                  }}
                  className="p-2 rounded-full text-slate-600 hover:bg-black/5 cursor-pointer"
                  title="Tachar"
                >
                  <Strikethrough className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={toggleChecklist}
                className={`p-2 rounded-full cursor-pointer ${
                  draft.checklist ? 'text-slate-900 bg-black/10' : 'text-slate-600 hover:bg-black/5'
                }`}
                title={draft.checklist ? 'Convertir a texto' : 'Convertir en lista de tareas'}
                aria-pressed={Boolean(draft.checklist)}
              >
                <ListChecks className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full text-slate-600 hover:bg-black/5 cursor-pointer"
                title="Adjuntar archivo"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setColorPickerOpen((open) => !open)}
                className="p-2 rounded-full text-slate-600 hover:bg-black/5 cursor-pointer"
                title="Color de la nota"
              >
                <Palette className="w-4 h-4" />
              </button>
              {docs.some((row) => row.id === draft.id) && (
                <button
                  type="button"
                  onClick={() => void handleDeleteDoc(draft)}
                  className="p-2 rounded-full text-slate-600 hover:bg-black/5 hover:text-rose-700 cursor-pointer"
                  title="Borrar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {colorPickerOpen && (
                <div className="absolute bottom-12 left-2 flex flex-wrap gap-1.5 rounded-xl bg-white shadow-lg border border-slate-200 p-2 w-52">
                  {KEEP_NOTE_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, color: hex }));
                        setColorPickerOpen(false);
                      }}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-full border cursor-pointer ${
                        (draft.color || '#ffffff') === hex ? 'border-slate-800 ring-2 ring-slate-400' : 'border-slate-300'
                      }`}
                      title={hex}
                    />
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => closeEditor(false)}
                className="ml-auto px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-black/5 rounded-md cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white mb-2">
              <p className="text-sm font-bold truncate">{previewName}</p>
              <button type="button" onClick={() => setPreviewUrl(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={previewUrl} alt={previewName} className="w-full max-h-[80vh] object-contain rounded-xl bg-white" />
          </div>
        </div>
      )}
    </>
  );
}
