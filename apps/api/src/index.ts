import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { openDatabase } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();
const database = await openDatabase({
  url: env.DATABASE_URL,
  ssl: env.DATABASE_SSL,
  pgliteDir: env.PGLITE_DIR,
  migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
});
const app = await buildApp({ db: database.db, env, logger: true });

const stop = async () => {
  await app.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

await app.listen({ port: env.PORT, host: env.HOST });
if (!env.DATABASE_URL) app.log.info(`Đang dùng PGlite tại ${env.PGLITE_DIR} (đặt DATABASE_URL để dùng PostgreSQL).`);
