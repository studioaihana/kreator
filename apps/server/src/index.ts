import path from 'node:path';
import { promises as fs } from 'node:fs';
import express from 'express';
import cors from 'cors';
import { createRouter } from './api/routes.js';
import { store } from './store.js';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  await store.init();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', createRouter());

  // Serve the built web app when it exists (single origin in production).
  const webDist = path.resolve(process.cwd(), 'apps/web/dist');
  try {
    await fs.access(path.join(webDist, 'index.html'));
    app.use(express.static(webDist, { index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } catch {
    app.get('/', (_req, res) => {
      res.type('text/plain').send('Kreator API aktif. Jalankan `npm run dev:web` untuk antarmuka pengembangan.');
    });
  }

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[kreator] request failed:', error.message);
    res.status(500).json({ error: error.message });
  });

  app.listen(PORT, HOST, () => {
    console.log(`[kreator] API listening on http://${HOST}:${PORT}`);
  });
}

main().catch((error) => {
  console.error('[kreator] failed to start server:', error);
  process.exit(1);
});
