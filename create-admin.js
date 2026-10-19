// Creates (or resets the password of) the OWNER account - the main person of the institute.
// The owner then adds teachers from the admin panel (Teachers > Add teacher).
// Usage: npm run create-admin -- <username> <password (8+ characters)> ["Full Name"]
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

(async () => {
  const [username, password, name] = process.argv.slice(2);
  if (!username || !password || password.length < 8) {
    console.log('Usage: npm run create-admin -- <username> <password (8+ characters)> ["Full Name"]');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO admins (username, password_hash, name, role) VALUES (?, ?, ?, 'owner') ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
      [username, hash, name || username]
    );
    console.log(`Admin "${username}" is ready. Log in at /admin/login`);
  } catch (err) {
    console.error('Could not create admin:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
