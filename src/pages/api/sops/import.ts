import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession, checkIpRateLimit } from '@/lib/serverAuth';
import { parseSopText } from '@/lib/sopImport';
import { IncomingForm, File as FormidableFile } from 'formidable';
import fs from 'fs/promises';
import { logError } from '@/lib/log';

export const config = { api: { bodyParser: false } };

const MAX_TEXT_CHARS = 200_000;

// Extract plain text from an uploaded SOP document. Type is decided by
// file content (magic bytes) where possible, never by the client's
// MIME header.
async function extractText(buf: Buffer, filename: string): Promise<string | null> {
  // PDF: %PDF-
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buf });
    try {
      const { text } = await parser.getText();
      return text;
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  // DOCX: a zip container (PK..) with a .docx name
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04 &&
      filename.toLowerCase().endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  // Plain text / Markdown
  if (/\.(txt|md|markdown)$/i.test(filename)) {
    return buf.toString('utf8');
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
    logError('sops/import parse', err);
    return res.status(400).json({ error: 'Invalid upload.' });
  }

  try {
    const buf = await fs.readFile(file.filepath);
    const name = file.originalFilename ?? file.newFilename ?? '';

    let text: string | null;
    try {
      text = await extractText(buf, name);
    } catch (err) {
      logError('sops/import extract', err);
      return res.status(400).json({ error: 'Could not read that document. Is the file valid?' });
    }
    if (text === null) {
      return res.status(400).json({ error: 'Unsupported file type. Upload a .docx, .pdf, .txt, or .md file.' });
    }
    if (!text.trim()) {
      return res.status(400).json({ error: 'No readable text found in that document (is it a scanned image?).' });
    }

    const draft = parseSopText(text.slice(0, MAX_TEXT_CHARS));
    if (!draft.title && draft.steps.length === 0) {
      return res.status(400).json({ error: 'Could not find any SOP content in that document.' });
    }
    return res.status(200).json({ draft });
  } finally {
    fs.unlink(file.filepath).catch(() => {});
  }
}
