import readline from 'node:readline';
import { initDatabase } from '../db/connection.js';
import { usersRepository } from '../repositories/usersRepository.js';
import { authService } from '../services/authService.js';

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  await initDatabase();

  const args = process.argv.slice(2);
  let email = args[0];
  let password = args[1];

  console.log('=======================================================');
  console.log('👑 СОЗДАНИЕ УЧЕТНОЙ ЗАПИСИ АДМИНИСТРАТОРА МИНИ-CRM');
  console.log('=======================================================');

  if (!email) {
    email = await prompt('Введите Email администратора: ');
  }

  if (!email || !email.includes('@')) {
    console.error('❌ Ошибка: укажите корректный email адрес');
    process.exit(1);
  }

  const existing = await usersRepository.findByEmail(email);
  if (existing) {
    console.log(`⚠️ Пользователь с email "${email}" уже существует.`);
    const overwrite = await prompt('Сбросить пароль для этого пользователя? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Операция отменена.');
      process.exit(0);
    }
  }

  if (!password) {
    password = await prompt('Введите надежный пароль (минимум 8 символов): ');
  }

  if (!password || password.length < 8) {
    console.error('❌ Ошибка: пароль должен содержать не менее 8 символов');
    process.exit(1);
  }

  const hash = await authService.hashPassword(password);

  if (existing) {
    const { db } = await import('../db/connection.js');
    await db.execute('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, existing.id]);
    console.log(`✅ Пароль администратора ${email} успешно обновлен!`);
  } else {
    const user = await usersRepository.create(email, hash, 'admin');
    console.log(`✅ Администратор ${user.email} успешно создан! (ID: ${user.id})`);
  }

  console.log('\nТеперь вы можете войти в панель CRM под этой учетной записью.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Фатальная ошибка:', err);
  process.exit(1);
});
