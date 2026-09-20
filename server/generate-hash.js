import bcrypt from 'bcrypt';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('========================================');
console.log('  VideoFlow Pro 密码哈希生成工具');
console.log('========================================');
console.log('');

rl.question('请输入要加密的密码: ', async (password) => {
  if (!password || password.length < 6) {
    console.log('❌ 密码长度至少为6位');
    rl.close();
    return;
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    console.log('');
    console.log('✅ 密码哈希生成成功！');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('密码哈希:');
    console.log(hash);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 使用方法：');
    console.log('');
    console.log('1. 在数据库中执行：');
    console.log(`   INSERT INTO users (email, username, password_hash, display_name, role, status, balance_points)`);
    console.log(`   VALUES ('admin@example.com', 'admin', '${hash}', '管理员', 'admin', 'active', 0);`);
    console.log('');
    console.log('2. 或者更新现有用户：');
    console.log(`   UPDATE users SET password_hash = '${hash}', role = 'admin' WHERE email = 'your_email@example.com';`);
    console.log('');

  } catch (error) {
    console.error('❌ 生成哈希时出错:', error.message);
  }

  rl.close();
});

rl.on('close', () => {
  process.exit(0);
});
