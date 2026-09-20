import bcrypt from 'bcrypt';

async function generateHash() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log('========================================');
  console.log('管理员账号信息');
  console.log('========================================');
  console.log('用户名: admin');
  console.log('密码: admin123');
  console.log('密码哈希:', hash);
  console.log('========================================');
  console.log('');
  console.log('SQL 语句：');
  console.log('');
  console.log(`INSERT INTO users (email, username, password_hash, display_name, role, status, balance_points)`);
  console.log(`VALUES ('admin@videoflow.pro', 'admin', '${hash}', '系统管理员', 'admin', 'active', 0);`);
  console.log('');
  console.log('或者更新现有用户为管理员：');
  console.log(`UPDATE users SET role = 'admin' WHERE email = 'your_email@example.com';`);
  console.log('');
}

generateHash();
