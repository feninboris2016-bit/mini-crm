import { initDatabase } from './connection.js';

async function run() {
  try {
    console.log('[Migration] Starting database schema migration...');
    await initDatabase();
    console.log('[Migration] Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    process.exit(1);
  }
}

run();
