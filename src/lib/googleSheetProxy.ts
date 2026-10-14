import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { googleSheetCsvExportUrl, looksLikeGoogleLoginHtml } from './googleSheetsUrls';

const PREFIX = '/api/google-sheet-csv';

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  const rawUrl = req.url || '';
  if (!rawUrl.startsWith(PREFIX)) {
    next();
    return;
  }
  const parsed = new URL(rawUrl, 'http://127.0.0.1');
  const id = String(parsed.searchParams.get('id') || '').trim();
  const gid = String(parsed.searchParams.get('gid') || '0').trim() || '0';
  if (!/^[a-zA-Z0-9-_]+$/.test(id) || !/^[0-9]+$/.test(gid)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Enlace de Google Sheets inválido.');
    return;
  }
  try {
    const upstream = await fetch(googleSheetCsvExportUrl({ id, gid }), { redirect: 'follow' });
    const text = await upstream.text();
    if (
      !upstream.ok ||
      looksLikeGoogleLoginHtml(text) ||
      /accounts\.google\.com/i.test(upstream.url)
    ) {
      res.statusCode = upstream.status === 403 ? 403 : 401;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('private');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(text);
  } catch {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('No se pudo leer Google Sheets.');
  }
}

export function googleSheetProxyPlugin(): Plugin {
  return {
    name: 'google-sheet-csv-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next);
      });
    }
  };
}
