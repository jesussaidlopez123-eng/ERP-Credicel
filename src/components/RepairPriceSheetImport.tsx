import React, { useState } from 'react';
import { ClipboardPaste, Download, Link2, Upload } from 'lucide-react';
import type { RepairPriceItem } from '../types';
import { downloadRepairPriceTemplate, repairPricesFromSpreadsheet } from '../lib/repairPriceCatalog';
import {
  DEFAULT_REPAIR_PRICE_SHEET_URL,
  repairPricesFromGoogleSheetUrl,
  repairPricesFromPastedText
} from '../lib/googleSheetsRepairPrices';

interface RepairPriceSheetImportProps {
  onImport: (items: RepairPriceItem[]) => void | Promise<void>;
  compact?: boolean;
}

export default function RepairPriceSheetImport({ onImport, compact = false }: RepairPriceSheetImportProps) {
  const [sheetUrl, setSheetUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [showSheetUrl, setShowSheetUrl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const runImport = async (work: () => Promise<RepairPriceItem[]>, okLabel: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const items = await work();
      await onImport(items);
      setMessage(`${okLabel}: ${items.length} precios. Cada pantalla/modelo ya tiene su tarifa.`);
      setPasteText('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo cargar la lista de precios.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-1.5 flex-wrap ${compact ? 'justify-end' : ''}`}>
        <button
          type="button"
          onClick={() => downloadRepairPriceTemplate()}
          className={
            compact
              ? 'inline-flex items-center gap-1 px-2 py-1 border border-amber-300 bg-white text-amber-900 rounded-lg text-[10px] font-bold cursor-pointer'
              : 'flex items-center gap-1.5 px-3 py-1.5 bg-amber-700/80 hover:bg-amber-800 text-white rounded-xl font-bold text-xs cursor-pointer'
          }
        >
          <Download className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          {compact ? 'Plantilla' : 'Plantilla Excel'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={
            compact
              ? 'inline-flex items-center gap-1 px-2 py-1 bg-amber-700 text-white rounded-lg text-[10px] font-bold cursor-pointer disabled:opacity-60'
              : 'flex items-center gap-1.5 px-3 py-1.5 bg-white text-amber-900 hover:bg-amber-50 rounded-xl font-bold text-xs cursor-pointer disabled:opacity-60'
          }
        >
          <Upload className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          {busy ? 'Leyendo…' : 'Importar Excel'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!showSheetUrl) {
              setShowSheetUrl(true);
              return;
            }
            void runImport(() => repairPricesFromGoogleSheetUrl(sheetUrl || DEFAULT_REPAIR_PRICE_SHEET_URL), 'Lista de Google Sheets');
          }}
          className={
            compact
              ? 'inline-flex items-center gap-1 px-2 py-1 bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer disabled:opacity-60'
              : 'flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs cursor-pointer disabled:opacity-60'
          }
        >
          <Link2 className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          {busy ? 'Leyendo…' : showSheetUrl ? 'Cargar hoja' : 'Google Sheets'}
        </button>
        <button
          type="button"
          onClick={() => setShowPaste((open) => !open)}
          className={
            compact
              ? 'inline-flex items-center gap-1 px-2 py-1 border border-amber-300 bg-white text-amber-900 rounded-lg text-[10px] font-bold cursor-pointer'
              : 'flex items-center gap-1.5 px-3 py-1.5 bg-amber-700/80 hover:bg-amber-800 text-white rounded-xl font-bold text-xs cursor-pointer'
          }
        >
          <ClipboardPaste className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          Pegar tabla
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void runImport(async () => {
              const bytes = new Uint8Array(await file.arrayBuffer());
              return repairPricesFromSpreadsheet(bytes, file.name);
            }, `Excel ${file.name}`);
          }}
        />
      </div>

      {showSheetUrl && (
        <label className="block">
          <span className="sr-only">Enlace de Google Sheets</span>
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Pega el enlace solo si vas a importar otra hoja"
            className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-[11px] font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </label>
      )}

      {showPaste && (
        <div className="space-y-1.5">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={compact ? 4 : 6}
            placeholder={'Pega aquí las celdas copiadas de Google Sheets.\nEjemplo:\nModelo\tPrecio\niPhone 11\t850'}
            className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-[11px] font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !pasteText.trim()}
            onClick={() => void runImport(() => Promise.resolve(repairPricesFromPastedText(pasteText)), 'Tabla pegada')}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold cursor-pointer disabled:opacity-60"
          >
            Cargar precios pegados
          </button>
        </div>
      )}

      {message && (
        <p className="text-[11px] font-semibold text-amber-950">{message}</p>
      )}
    </div>
  );
}
