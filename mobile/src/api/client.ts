import { ApiError, OfflineError } from './errors';
import { getApiToken } from '@/auth/credentials';
import { logger } from '@/utils/logger';
import type { HcpErrorBody } from '@/types';

const DEFAULT_BASE_URL = 'https://api.housecallpro.com';
const DEFAULT_TIMEOUT_MS = 20_000;
/** Uploads carry image bytes over jobsite LTE — they need a lot more room. */
const UPLOAD_TIMEOUT_MS = 120_000;

export function apiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_HCP_API_BASE?.replace(/\/+$/, '') || DEFAULT_BASE_URL;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Query params. `undefined` and `null` values are dropped, arrays repeat the key. */
  query?: Record<string, string | number | boolean | undefined | null | string[]>;
  /** JSON body. Mutually exclusive with `form`. */
  json?: unknown;
  /** multipart/form-data body. The boundary is set by the runtime, not by us. */
  form?: FormData;
  timeoutMs?: number;
  /** Lets the sync worker cancel an in-flight upload when connectivity drops. */
  signal?: AbortSignal;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const url = `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const encodedKey = encodeURIComponent(key);
    if (Array.isArray(value)) {
      for (const item of value) parts.push(`${encodedKey}[]=${encodeURIComponent(item)}`);
    } else {
      parts.push(`${encodedKey}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `${url}?${parts.join('&')}` : url;
}

async function parseErrorBody(response: Response): Promise<HcpErrorBody | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    return JSON.parse(text) as HcpErrorBody;
  } catch {
    return undefined;
  }
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds;
  // The header may also be an HTTP-date.
  const asDate = Date.parse(header);
  if (Number.isNaN(asDate)) return undefined;
  return Math.max(0, Math.round((asDate - Date.now()) / 1000));
}

/**
 * Single entry point for every Housecall Pro call.
 *
 * It deliberately does *not* retry. Retries belong to the sync engine, which
 * owns the persisted backoff schedule and survives the app being killed —
 * an in-memory retry loop here would just duplicate that badly.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getApiToken();
  if (!token) {
    throw new ApiError('No Housecall Pro API key configured on this device', 401);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  let body: BodyInit | undefined;

  if (options.form) {
    body = options.form as unknown as BodyInit;
    // Content-Type is intentionally unset: the runtime must add the multipart
    // boundary, and setting it by hand produces a body the server cannot parse.
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  const timeoutMs = options.timeoutMs ?? (options.form ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort);

  const url = buildUrl(path, options.query);
  const method = options.method ?? 'GET';

  try {
    const response = await fetch(url, { method, headers, body, signal: controller.signal });

    if (!response.ok) {
      throw new ApiError(response.statusText || 'Request failed', response.status, {
        body: await parseErrorBody(response),
        retryAfterSeconds: parseRetryAfter(response),
      });
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      // Either our timeout or a caller cancel; both are worth another attempt.
      throw new OfflineError(`Request to ${path} timed out or was canceled`);
    }
    logger.warn('api.request.failed', { path, method, error: String(error) });
    throw new OfflineError(error instanceof Error ? error.message : 'Network request failed');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}
