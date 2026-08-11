import { getDatabase, parseJsonColumn, withTransaction } from '../database';
import type { Customer, PostalAddress } from '@/types';

interface CustomerRow {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address_json: string | null;
  tags_json: string;
  notes: string | null;
  updated_at: string | null;
  cached_at: string;
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    displayName: row.display_name,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    company: row.company ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: parseJsonColumn<PostalAddress | undefined>(row.address_json, undefined),
    tags: parseJsonColumn<string[]>(row.tags_json, []),
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function buildSearchBlob(customer: Customer): string {
  return [
    customer.displayName,
    customer.company,
    customer.email,
    // Digits only, so searching "5551234" finds "(555) 123-4..." too.
    customer.phone?.replace(/\D/g, ''),
    customer.phone,
    customer.address?.formatted,
    ...customer.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export async function replaceCustomers(customers: Customer[]): Promise<void> {
  const cachedAt = new Date().toISOString();

  await withTransaction(async (db) => {
    for (const customer of customers) {
      await db.runAsync(
        `INSERT INTO customers (
           id, display_name, first_name, last_name, company, email, phone,
           address_json, tags_json, notes, updated_at, search_blob, cached_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           display_name = excluded.display_name,
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           company = excluded.company,
           email = excluded.email,
           phone = excluded.phone,
           address_json = excluded.address_json,
           tags_json = excluded.tags_json,
           notes = excluded.notes,
           updated_at = excluded.updated_at,
           search_blob = excluded.search_blob,
           cached_at = excluded.cached_at`,
        [
          customer.id,
          customer.displayName,
          customer.firstName ?? null,
          customer.lastName ?? null,
          customer.company ?? null,
          customer.email ?? null,
          customer.phone ?? null,
          customer.address ? JSON.stringify(customer.address) : null,
          JSON.stringify(customer.tags),
          customer.notes ?? null,
          customer.updatedAt ?? null,
          buildSearchBlob(customer),
          cachedAt,
        ],
      );
    }

    await db.runAsync('DELETE FROM customers WHERE cached_at < ?', [cachedAt]);
  });
}

export async function queryCustomers(search?: string, limit = 200): Promise<Customer[]> {
  const db = await getDatabase();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  const trimmed = search?.trim().toLowerCase();
  if (trimmed) {
    for (const term of trimmed.split(/\s+/)) {
      clauses.push('search_blob LIKE ?');
      params.push(`%${term}%`);
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(limit);

  const rows = await db.getAllAsync<CustomerRow>(
    `SELECT * FROM customers ${where} ORDER BY display_name COLLATE NOCASE ASC LIMIT ?`,
    params,
  );

  return rows.map(toCustomer);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id = ?', [id]);
  return row ? toCustomer(row) : null;
}
