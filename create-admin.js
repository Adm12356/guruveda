// Usage: npm run create-admin -- <username> <password>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

(async () => {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 8) {
    console.log('Usage: npm run create-admin -- <username> <password (8+ characters)>');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO admins (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
      [username, hash]
    );
    console.log(`Admin "${username}" is ready. Log in at /admin/login`);
  } catch (err) {
    console.error('Could not create admin:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
