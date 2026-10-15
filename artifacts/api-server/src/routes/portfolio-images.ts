import express, { Router, type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../middlewares/requireAdmin';

const router = Router();
const directory = path.resolve(process.env.PORTFOLIO_UPLOAD_DIR || '.local/portfolio-uploads');
export function imageExtension(data: Buffer, type: string): string | null {
  if (type === 'image/png' && data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.toString('ascii', 12, 16) === 'IHDR') return 'png';
  if (type === 'image/jpeg' && data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'jpg';
  if (type === 'image/webp' && data.length >= 16 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
router.post('/admin/portfolio-image', requireAdmin, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), async (req, res) => {
  const data = req.body;
  const extension = Buffer.isBuffer(data) ? imageExtension(data, req.get('Content-Type')?.split(';')[0] || '') : null;
  if (!extension) { res.status(400).json({ error: 'Bitte wählen Sie ein gültiges JPG-, PNG- oder WebP-Bild.' }); return; }
  try {
    await mkdir(directory, { recursive: true });
    const name = `${randomUUID()}.${extension}`;
    await writeFile(path.join(directory, name), data, { flag: 'wx' });
    res.status(201).json({ imageUrl: `/api/portfolio-images/${name}` });
  } catch { res.status(500).json({ error: 'Das Bild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.' }); }
});
const uploadError: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'Das Bild darf höchstens 8 MB groß sein.' }); return; }
  next(error);
};
router.use('/admin/portfolio-image', uploadError);
router.use('/portfolio-images', (_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); }, express.static(directory, { index: false, dotfiles: 'deny', maxAge: '1y', immutable: true }));
export default router;
