import { initDatabase } from '../db/connection.js';
import { backupService } from '../services/backupService.js';

async function run() {
  await initDatabase();
  console.log('[Backup] Создание резервной копии базы данных...');
  const meta = await backupService.createBackup('cli_script');
  console.log(`✅ Резервная копия успешно создана!`);
  console.log(`📁 Файл: ${meta.filename}`);
  console.log(`📊 Количество лидов: ${meta.leadsCount}`);
  console.log(`💾 Размер: ${(meta.sizeBytes / 1024).toFixed(1)} КБ`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Ошибка при создании бэкапа:', err);
  process.exit(1);
});
