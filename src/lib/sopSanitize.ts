/**
 * Server-side validation/sanitization for the JSON columns on `sops`
 * (steps, revision_history, read_logs). Enforces shape, strips markup,
 * validates image URLs, and caps array sizes so a single request can't
 * bloat a row without bound.
 */
import { sanitize } from './security';

export const SOP_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

const MAX_STEPS = 50;
const MAX_REVISIONS = 200;
const MAX_READ_LOGS = 1000;
const MAX_URL_LEN = 500;

export interface SopStep { title: string; summary: string; body: string; imageUrl: string }
export interface SopRevision { version: string; date: string; updatedBy: string; userRole: string; notes: string }
export interface SopReadLog { userName: string; userRole: string; timestamp: string; versionRead: string }

export function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.length > MAX_URL_LEN) return false;
  if (url.startsWith('/')) return true; // same-origin path
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function sanitizeSteps(input: unknown): SopStep[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_STEPS).map(raw => {
    const s = asRecord(raw);
    const imageUrl = typeof s.imageUrl === 'string' ? s.imageUrl.trim() : '';
    return {
      title:    sanitize(String(s.title ?? ''), 'title'),
      summary:  sanitize(String(s.summary ?? ''), 'summary'),
      body:     sanitize(String(s.body ?? ''), 'body'),
      imageUrl: isSafeImageUrl(imageUrl) ? imageUrl : '',
    };
  });
}

export function sanitizeRevisions(input: unknown): SopRevision[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_REVISIONS).map(raw => {
    const r = asRecord(raw);
    return {
      version:   sanitize(String(r.version ?? ''), 'default').slice(0, 20),
      date:      sanitize(String(r.date ?? ''), 'default').slice(0, 40),
      updatedBy: sanitize(String(r.updatedBy ?? ''), 'name'),
      userRole:  sanitize(String(r.userRole ?? ''), 'name'),
      notes:     sanitize(String(r.notes ?? ''), 'notes'),
    };
  });
}

export function sanitizeReadLogs(input: unknown): SopReadLog[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_READ_LOGS).map(raw => {
    const l = asRecord(raw);
    return {
      userName:    sanitize(String(l.userName ?? ''), 'name'),
      userRole:    sanitize(String(l.userRole ?? ''), 'name'),
      timestamp:   sanitize(String(l.timestamp ?? ''), 'default').slice(0, 60),
      versionRead: sanitize(String(l.versionRead ?? ''), 'default').slice(0, 20),
    };
  });
}

export { MAX_READ_LOGS };
