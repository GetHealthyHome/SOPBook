import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { IncomingForm, File as FormidableFile } from 'formidable';
import fs from 'fs/promises';
import { logError } from '@/lib/log';

export const config = { api: { bodyParser: false } };

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

// Determine the real image type from file content. Never trust the
// client-supplied MIME type or filename extension — a renamed HTML/SVG
// file served from public storage would be an XSS payload.
function detectImageType(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return { ext: '.png', mime: 'image/png' };
  }
  if (buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: '.webp', mime: 'image/webp' };
  }
  if (buf.length >= 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) {
    return { ext: '.gif', mime: 'image/gif' };
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp' &&
      HEIC_BRANDS.includes(buf.subarray(8, 12).toString('ascii'))) {
    return { ext: '.heic', mime: 'image/heic' };
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const form = new IncomingForm({ maxFileSize: 10 * 1024 * 1024 });

  let file: FormidableFile;
  try {
    file = await new Promise<FormidableFile>((resolve, reject) => {
      form.parse(req, (err, _fields, files) => {
        if (err) return reject(err);
        const uploaded = Array.isArray(files.file) ? files.file[0] : files.file;
        if (!uploaded) return reject(new Error('No file uploaded.'));
        resolve(uploaded);
      });
    });
  } catch (err) {
    logError('upload parse', err);
    return res.status(400).json({ error: 'Invalid upload.' });
  }

  try {
    const fileBuffer = await fs.readFile(file.filepath);
    const detected = detectImageType(fileBuffer);
    if (!detected) {
      return res.status(400).json({ error: 'Only image files are allowed.' });
    }

    const fileName = `${crypto.randomUUID()}${detected.ext}`;
    const db = getSupabase();
    const { error } = await db.storage
      .from('sop-images')
      .upload(fileName, fileBuffer, { contentType: detected.mime, upsert: false });

    if (error) {
      logError('upload storage', error);
      return res.status(500).json({ error: 'Failed to upload image.' });
    }

    const { data: urlData } = db.storage.from('sop-images').getPublicUrl(fileName);
    return res.status(200).json({ url: urlData.publicUrl });
  } finally {
    fs.unlink(file.filepath).catch(() => {});
  }
}
