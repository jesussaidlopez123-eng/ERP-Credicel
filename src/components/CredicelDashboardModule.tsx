import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Square,
  Strikethrough,
  Trash2,
  X
} from 'lucide-react';
import { Branch, CredicelDashAttachment, CredicelDashCheckItem, CredicelDashDoc, Operator } from '../types';
import { newUniqueId } from '../lib/ids';
import { safeFormatDate, safeFormatTime } from '../lib/dateUtils';
import {
  applyDashSelection,
  dashDocSnippet,
  dataUrlToBlob,
  deleteDashFile,
  emptyDashDoc,
  formatDashFileSize,
  getDashFile,
  isDashDocEmpty,
  loadCachedDashDocs,
  loadDashView,
  MAX_DASH_FILE_BYTES,
  putDashFile,
  saveCachedDashDocs,
  saveDashView,
  sanitizeDashHtml,
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

function fileKind(mime: string, name: string): 'image' | 'pdf' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'file';
}

function FileGlyph({ mime, name, className = 'w-5 h-5' }: { mime: string; name: string; className?: string }) {
  const kind = fileKind(mime, name);
  if (kind === 'image') return <ImageIcon className={`${className} text-emerald-600`} />;
  if (kind === 'pdf') return <FileText className={`${className} text-rose-600`} />;
  return <Paperclip className={`${className} text-blue-700`} />;
}

export default function CredicelDashboardModule({
  currentOperator,
  currentBranch
}: CredicelDashboardModuleProps) {
  const [docs, setDocs] = useState<CredicelDashDoc[]>(() => loadCachedDashDocs());
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<DashView>(() => loadDashView());
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<CredicelDashDoc>(() => emptyDashDoc());
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          const merged = [...cloudDocs, ...pending].sort((a, b) =>
            (b.updatedAt || '').localeCompare(a.updatedAt || '')
          );
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

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => {
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
  }, [docs, searchQuery]);

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
    setSelectedItemIds([]);
    setAttachmentTitle('');
    setEditorOpen(true);
  };

  const openDoc = (doc: CredicelDashDoc) => {
    setDraft({ ...doc, items: doc.items.map((item) => ({ ...item })), attachments: [...doc.attachments] });
    setSelectedItemIds([]);
    setAttachmentTitle('');
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
      const merged = [stamped, ...others].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
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

  const handleSaveEditor = () => {
    const bodyHtml = sanitizeDashHtml(bodyRef.current?.innerHTML || draft.bodyHtml);
    const next: CredicelDashDoc = {
      ...draft,
      title: draft.title.trim() || (draft.attachments[0]?.title || 'Sin título'),
      bodyHtml,
      items: draft.items.filter((item) => item.id && item.text.trim())
    };
    if (isDashDocEmpty(next)) {
      alert('Escribe un título, una nota, un recuadro o adjunta un archivo.');
      return;
    }
    setSaving(true);
    persistDoc(next);
    setSaving(false);
    setEditorOpen(false);
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

  const addCheckItem = () => {
    const item: CredicelDashCheckItem = {
      id: newUniqueId('IT'),
      text: '',
      checked: false,
      struck: false
    };
    setDraft((prev) => ({ ...prev, items: [...prev.items, item] }));
  };

  const updateItemText = (id: string, text: string) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, text } : item))
    }));
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const applySelection = (action: 'check' | 'uncheck' | 'strike' | 'unstrike' | 'remove') => {
    setDraft((prev) => ({ ...prev, items: applyDashSelection(prev.items, selectedItemIds, action) }));
    if (action === 'remove') setSelectedItemIds([]);
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
      const att: CredicelDashAttachment = {
        id: newUniqueId('FILE'),
        title: attachmentTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        hasLocal: true
      };
      try {
        const stored = await persistDashAttachmentFile(att, file);
        added.push(stored);
      } catch (err) {
        console.error(err);
        await putDashFile(att.id, file);
        added.push(att);
      }
    }
    if (!added.length) return;
    setDraft((prev) => ({ ...prev, attachments: [...prev.attachments, ...added] }));
    setAttachmentTitle('');
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
    let url = att.downloadUrl || null;
    if (!url) {
      const local = await getDashFile(att.id);
      if (local) url = URL.createObjectURL(local);
    }
    if (!url && att.hasCloudBlob) {
      const dataUrl = await fetchDashBlobDataUrl(att.id);
      if (dataUrl) {
        const blob = dataUrlToBlob(dataUrl);
        if (blob) {
          await putDashFile(att.id, blob);
          url = URL.createObjectURL(blob);
        } else {
          url = dataUrl;
        }
      }
    }
    if (!url) {
      alert('Este archivo está en otro equipo o aún no sube a la nube.');
      return;
    }
    if (fileKind(att.mimeType, att.fileName) === 'image') {
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
                    : 'Pulsa + para escribir una nota, marcar recuadros o adjuntar archivos. También puedes soltar archivos aquí.'}
                </p>
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => openDoc(doc)}
                    className="text-left bg-white border border-slate-200 rounded-2xl p-3 hover:border-[#0047AB]/40 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        {doc.attachments[0] ? (
                          <FileGlyph mime={doc.attachments[0].mimeType} name={doc.attachments[0].fileName} />
                        ) : (
                          <FileText className="w-5 h-5 text-[#0047AB]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 truncate">{doc.title || 'Sin título'}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{dashDocSnippet(doc)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-slate-400">
                      <span>{safeFormatDate(doc.updatedAt)}</span>
                      <span>
                        {doc.items.length ? `${doc.items.length} recuadro(s)` : ''}
                        {doc.attachments.length ? ` · ${doc.attachments.length} archivo(s)` : ''}
                      </span>
                    </div>
                  </button>
                ))}
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
                      <FileText className="w-4 h-4 text-[#0047AB] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{doc.title || 'Sin título'}</p>
                        <p className="sm:hidden text-[11px] text-slate-500 truncate">{dashDocSnippet(doc, 60)}</p>
                      </div>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 max-h-[96vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0b3a6e] text-white sticky top-0 z-10">
              <div>
                <p className="text-[11px] text-blue-100 font-semibold">CREDICEL Dashboard</p>
                <h3 className="font-extrabold text-base">{draft.createdAt === draft.updatedAt ? 'Nuevo documento' : 'Editar documento'}</h3>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} className="text-blue-100 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Título</label>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej. Contratos Huatabampo, lista de pendientes…"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-extrabold text-slate-700">Notas</label>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      strikeSelectionInBody();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Strikethrough className="w-3.5 h-3.5" />
                    Tachar selección
                  </button>
                </div>
                <div className="relative">
                  {!draft.bodyHtml && (
                    <span className="absolute left-3 top-2.5 text-sm text-slate-400 pointer-events-none">
                      Escribe aquí. Selecciona texto y pulsa Tachar.
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
                    className="min-h-[110px] w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-slate-800">Recuadros para marcar o tachar</p>
                  <button
                    type="button"
                    onClick={addCheckItem}
                    className="text-[11px] font-extrabold text-[#0047AB] cursor-pointer"
                  >
                    + Agregar renglón
                  </button>
                </div>
                {selectedItemIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => applySelection('check')} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-extrabold cursor-pointer">Marcar</button>
                    <button type="button" onClick={() => applySelection('uncheck')} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-extrabold cursor-pointer">Quitar marca</button>
                    <button type="button" onClick={() => applySelection('strike')} className="px-2 py-1 rounded-lg bg-amber-50 text-amber-900 text-[11px] font-extrabold cursor-pointer">Tachar</button>
                    <button type="button" onClick={() => applySelection('unstrike')} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-extrabold cursor-pointer">Quitar tachado</button>
                    <button type="button" onClick={() => applySelection('remove')} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-800 text-[11px] font-extrabold cursor-pointer">Eliminar</button>
                  </div>
                )}
                {draft.items.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Agrega renglones. El recuadro marca lo hecho; al seleccionar puedes tacharlos.</p>
                ) : (
                  <div className="space-y-1.5">
                    {draft.items.map((item) => {
                      const selected = selectedItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                            selected ? 'border-[#0047AB] bg-blue-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSelectItem(item.id)}
                            className="text-slate-500 cursor-pointer"
                            title="Seleccionar renglón"
                          >
                            {selected ? <CheckSquare className="w-4 h-4 text-[#0047AB]" /> : <Square className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, items: toggleDashItem(prev.items, item.id, 'checked') }))
                            }
                            className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer ${
                              item.checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-400 bg-white'
                            }`}
                            title="Marcar"
                          >
                            {item.checked ? <Check className="w-3.5 h-3.5" /> : null}
                          </button>
                          <input
                            value={item.text}
                            onChange={(e) => updateItemText(item.id, e.target.value)}
                            placeholder="Escribe el pendiente…"
                            className={`flex-1 bg-transparent text-sm font-medium outline-none ${
                              item.struck ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, items: toggleDashItem(prev.items, item.id, 'struck') }))
                            }
                            className="p-1 text-slate-500 hover:text-amber-700 cursor-pointer"
                            title="Tachar"
                          >
                            <Strikethrough className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
                <p className="text-xs font-extrabold text-slate-800">Documentos adjuntos</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input
                    value={attachmentTitle}
                    onChange={(e) => setAttachmentTitle(e.target.value)}
                    placeholder="Título del archivo (opcional)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold cursor-pointer"
                  >
                    Adjuntar archivo
                  </button>
                </div>
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
                {draft.attachments.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Puedes ponerle título a cada archivo antes o después de subirlo.</p>
                ) : (
                  <div className="space-y-2">
                    {draft.attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-2">
                        <button type="button" onClick={() => void openAttachment(att)} className="shrink-0 cursor-pointer">
                          <FileGlyph mime={att.mimeType} name={att.fileName} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <input
                            value={att.title}
                            onChange={(e) => renameAttachment(att.id, e.target.value)}
                            className="w-full text-sm font-bold text-slate-900 bg-transparent outline-none"
                          />
                          <p className="text-[10px] text-slate-500 truncate">
                            {att.fileName} · {formatDashFileSize(att.size)}
                            {att.downloadUrl || att.hasCloudBlob ? ' · en la nube' : ' · en este equipo'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeAttachment(att.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-700 cursor-pointer"
                          title="Quitar archivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 sticky bottom-0">
              {docs.some((row) => row.id === draft.id) ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteDoc(draft)}
                  className="text-xs font-extrabold text-rose-700 cursor-pointer"
                >
                  Borrar
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditor()}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#0047AB] text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
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
