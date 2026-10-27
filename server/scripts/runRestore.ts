import { initDatabase } from '../db/connection.js';
import { backupService } from '../services/backupService.js';

async function run() {
  await initDatabase();
  const filename = process.argv[2];
  if (!filename) {
    console.log('Доступные резервные копии:');
    const list = backupService.listBackups();
    if (list.length === 0) {
      console.log('  (Резервных копий пока нет)');
    } else {
      list.forEach(b => {
        console.log(`  - ${b.filename} (${b.leadsCount} лидов, ${(b.sizeBytes / 1024).toFixed(1)} КБ, ${new Date(b.createdAt).toLocaleString('ru-RU')})`);
      });
    }
    console.log('\nИспользование: npm run restore -- <имя_файла.json>');
    process.exit(1);
  }

  console.log(`[Restore] Восстановление из файла: ${filename}...`);
  const res = await backupService.restoreBackup(filename, 'cli_restore');
  console.log(`✅ Восстановление завершено! Восстановлено лидов: ${res.restoredLeads}, комментариев: ${res.restoredComments}`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Ошибка при восстановлении:', err);
  process.exit(1);
});
