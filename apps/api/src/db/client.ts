import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzleLite } from 'drizzle-orm/pglite';
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export interface Database { db: Db; close(): Promise<void> }

export interface DatabaseOptions {
  /** Chuỗi kết nối PostgreSQL. Bỏ trống để dùng PGlite (PostgreSQL nhúng). */
  url?: string;
  ssl?: boolean;
  /** Thư mục dữ liệu PGlite; bỏ trống để chạy trong bộ nhớ (dùng cho test). */
  pgliteDir?: string;
  migrationsFolder: string;
}

/** Mở kết nối và chạy migration còn thiếu. */
export async function openDatabase(o: DatabaseOptions): Promise<Database> {
  if (o.url) {
    const pool = new pg.Pool({ connectionString: o.url, ssl: o.ssl ? { rejectUnauthorized: false } : undefined });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder: o.migrationsFolder });
    return { db, close: () => pool.end() };
  }
  if (o.pgliteDir) mkdirSync(o.pgliteDir, { recursive: true });
  const client = new PGlite(o.pgliteDir);
  const db = drizzleLite(client, { schema });
  await migrateLite(db, { migrationsFolder: o.migrationsFolder });
  // Hai driver có cùng API truy vấn của drizzle cho PostgreSQL.
  return { db: db as unknown as Db, close: () => client.close() };
}
