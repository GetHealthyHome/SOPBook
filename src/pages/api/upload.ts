import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { getSupabase } from '@/lib/supabaseServer';
import { IncomingForm, File as FormidableFile } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkIpRateLimit(req)) return res.status(429).json({ error: 'Too many requests.' });
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });
  if (session.userType !== 'admin') return res.status(403).json({ error: 'Admin only.' });

  const form = new IncomingForm({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });

  const { file } = await new Promise<{ file: FormidableFile }>((resolve, reject) => {
    form.parse(req, (err, _fields, files) => {
      if (err) return reject(err);
      const uploaded = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!uploaded) return reject(new Error('No file uploaded.'));
      resolve({ file: uploaded });
    });
  }).catch(err => { throw err; });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
  if (!allowed.includes(file.mimetype ?? '')) {
    return res.status(400).json({ error: 'Only image files are allowed.' });
  }

  const ext = path.extname(file.originalFilename ?? file.newFilename ?? '.jpg') || '.jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const fileBuffer = fs.readFileSync(file.filepath);

  const db = getSupabase();
  const { error } = await db.storage
    .from('sop-images')
    .upload(fileName, fileBuffer, { contentType: file.mimetype ?? 'image/jpeg', upsert: false });

  fs.unlinkSync(file.filepath);

  if (error) return res.status(500).json({ error: 'Failed to upload image.' });

  const { data: urlData } = db.storage.from('sop-images').getPublicUrl(fileName);
  return res.status(200).json({ url: urlData.publicUrl });
}
