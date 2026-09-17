import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  List,
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
import { Branch, CredicelDashAttachment, CredicelDashDoc, Operator } from '../types';
import { newUniqueId } from '../lib/ids';
import { safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import {
  dashDocSnippet,
  dataUrlToBlob,
  deleteDashFile,
  emptyDashDoc,
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
  sortDashDocs,
  toggleDashItem
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

function AttachmentVisual({
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
  if (kind === 'image' && url) {
    return (
      <div className="relative group overflow-hidden bg-slate-200">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(att);
          }}
          className="block w-full cursor-pointer"
        >
          <img
            src={url}
            alt={att.title || att.fileName}
            className={compact ? 'h-32 w-full object-cover' : 'max-h-64 w-full object-cover'}
          />
        </button>
        {!compact && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex items-center gap-2">
            <input
              value={att.title}
              onChange={(e) => onRename?.(att.id, e.target.value)}
              className="flex-1 min-w-0 bg-white/90 rounded px-2 py-1 text-[12px] font-medium text-slate-900 outline-none"
              placeholder="Título"
            />
            {onRemove && (
              <button type="button" onClick={() => onRemove(att.id)} className="p-1 rounded-full bg-white/90 text-rose-700 cursor-pointer" title="Quitar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center gap-3 ${compact ? 'px-3 py-2.5' : 'px-3 py-3'} bg-black/[0.04]`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(att);
        }}
        className="shrink-0 cursor-pointer"
      >
        <div className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-lg bg-white shadow-sm border border-black/5 flex items-center justify-center`}>
          <FileGlyph mime={att.mimeType} name={att.fileName} className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
        </div>
      </button>
      <div className="min-w-0 flex-1">
        {compact || !onRename ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(att);
            }}
            className="block w-full text-left cursor-pointer"
          >
            <p className="text-[13px] font-medium text-slate-900 truncate">{att.title || att.fileName}</p>
            <p className="text-[11px] text-slate-500 truncate">
              {kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Imagen' : 'Archivo'} · {formatDashFileSize(att.size)}
            </p>
          </button>
        ) : (
          <>
            <input
              value={att.title}
              onChange={(e) => onRename(att.id, e.target.value)}
              className="w-full bg-transparent text-[13px] font-medium text-slate-900 outline-none"
              placeholder="Título del archivo"
            />
            <p className="text-[11px] text-slate-500 truncate">
              {att.fileName} · {formatDashFileSize(att.size)}
            </p>
          </>
        )}
      </div>
      {onRemove && (
        <button type="button" onClick={() => onRemove(att.id)} className="p-1 text-slate-400 hover:text-rose-700 cursor-pointer" title="Quitar">
          <Trash2 className="w-4 h-4" />
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
      className="text-left rounded-lg border border-black/5 shadow-sm min-h-[148px] hover:shadow-md transition-shadow cursor-pointer flex flex-col overflow-hidden"
    >
      {doc.attachments.length > 0 && (
        <div className={doc.attachments.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-2'}>
          {doc.attachments.slice(0, 4).map((att) => (
            <AttachmentVisual
              key={att.id}
              att={att}
              url={previewMap[att.id]}
              compact
              onOpen={(file) => {
                onOpenFile(file);
              }}
            />
          ))}
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start gap-2">
          <p className="text-[15px] font-medium text-slate-900 truncate flex-1">
            {doc.title || 'Sin título'}
          </p>
          <button
            type="button"
            onClick={(e) => onPin(doc, e)}
            className={`p-1 rounded-full cursor-pointer shrink-0 ${
              doc.pinned ? 'text-slate-800 bg-black/5' : 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
            }`}
            title={doc.pinned ? 'No fijar' : 'Fijar'}
          >
            {doc.pinned ? <Pin className="w-4 h-4 fill-current" /> : <Pin className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[13px] text-slate-700/80 line-clamp-4 mt-1 whitespace-pre-wrap leading-relaxed">
          {dashDocSnippet(doc, 160)}
        </p>
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
    setColorPickerOpen(false);
    setEditorOpen(true);
  };

  const openDoc = (doc: CredicelDashDoc) => {
    setDraft({ ...doc, items: doc.items.map((item) => ({ ...item })), attachments: [...doc.attachments] });
    setColorPickerOpen(false);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!editorOpen) return;
    const html = draft.bodyHtml || '';
    const frame = window.requestAnimationFrame(() => {
      const node = bodyRef.current;
      if (node) node.innerHTML = html;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editorOpen, draft.id]);

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
      const bodyHtml = sanitizeDashHtml(bodyRef.current?.innerHTML || draft.bodyHtml);
      const next: CredicelDashDoc = {
        ...draft,
        title: draft.title.trim() || (draft.attachments[0]?.title || ''),
        bodyHtml,
        items: draft.items.filter((item) => item.id && item.text.trim())
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
    setDraft((prev) => ({ ...prev, attachments: [...prev.attachments, ...added] }));
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

  return (
    <>
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mi unidad</p>
              <h3 className="text-xl font-black text-slate-900">CREDICEL Dashboard</h3>
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
                  placeholder="Buscar documentos…"
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
                <p className="text-xs font-semibold">Cargando documentos…</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center px-4">
                <FolderOpen className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-black text-slate-800">
                  {searchQuery.trim() ? 'No hay coincidencias' : 'Aún no hay documentos'}
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
                <div className="hidden sm:grid grid-cols-[1fr_140px_120px_110px] gap-2 px-4 py-2 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <span>Nombre</span>
                  <span>Actualizado</span>
                  <span>Autor</span>
                  <span className="text-right">Adjuntos</span>
                </div>
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex sm:grid sm:grid-cols-[1fr_140px_120px_110px] gap-2 items-center px-4 py-3 border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => openDoc(doc)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {doc.attachments[0] && previewMap[doc.attachments[0].id] && fileKindOf(doc.attachments[0].mimeType, doc.attachments[0].fileName) === 'image' ? (
                        <img src={previewMap[doc.attachments[0].id]} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                      ) : doc.attachments[0] ? (
                        <FileGlyph mime={doc.attachments[0].mimeType} name={doc.attachments[0].fileName} className="w-4 h-4 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#0047AB] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-1">
                          {doc.pinned && <Pin className="w-3 h-3 fill-current" />}
                          {doc.title || 'Sin título'}
                        </p>
                        <p className="sm:hidden text-[11px] text-slate-500 truncate">{dashDocSnippet(doc, 60)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => togglePinned(doc, e)}
                        className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                        title={doc.pinned ? 'No fijar' : 'Fijar'}
                      >
                        {doc.pinned ? <Pin className="w-4 h-4 fill-current" /> : <Pin className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="hidden sm:block text-xs text-slate-600">
                      {safeFormatDate(doc.updatedAt)} {safeFormatTime(doc.updatedAt)}
                    </p>
                    <p className="hidden sm:block text-xs text-slate-600 truncate">{doc.authorName || '—'}</p>
                    <p className="text-xs font-semibold text-slate-500 text-right">{doc.attachments.length}</p>
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
            style={{ backgroundColor: draft.color || '#ffffff' }}
            className="w-full sm:max-w-[560px] sm:rounded-xl rounded-t-2xl shadow-2xl border border-black/5 max-h-[94vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-3 pt-2">
              <button
                type="button"
                onClick={() => togglePinned(draft)}
                className={`p-1.5 rounded-full cursor-pointer ${
                  draft.pinned ? 'text-slate-800 bg-black/5' : 'text-slate-500 hover:bg-black/5'
                }`}
                title={draft.pinned ? 'No fijar' : 'Fijar'}
              >
                {draft.pinned ? <Pin className="w-5 h-5 fill-current" /> : <Pin className="w-5 h-5" />}
              </button>
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
              {draft.attachments.length > 0 && (
                <div className={`-mx-5 mb-3 ${draft.attachments.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-2'}`}>
                  {draft.attachments.map((att) => (
                    <AttachmentVisual
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
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Título"
                className="w-full bg-transparent text-[17px] font-medium text-slate-900 placeholder:text-slate-400 outline-none py-1"
              />
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
                  className="min-h-[320px] sm:min-h-[380px] w-full text-[15px] leading-relaxed text-slate-800 outline-none py-1"
                />
              </div>

              {draft.items.length > 0 && (
                <div className="mt-1 mb-3 space-y-0.5">
                  {draft.items.map((item) => (
                    <label key={item.id} className="flex items-start gap-2 py-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() =>
                          setDraft((prev) => ({ ...prev, items: toggleDashItem(prev.items, item.id, 'checked') }))
                        }
                        className="mt-1"
                      />
                      <span className={`text-[14px] ${item.struck || item.checked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {item.text}
                      </span>
                    </label>
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
