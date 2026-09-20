import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'videoflow_pro',
  user: 'postgres',
  password: 'Mp112233@'
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 开始执行数据库迁移...\n');

    // 读取SQL文件
    const sqlFile = path.join(__dirname, 'create-user-points-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // 执行迁移
    await client.query(sql);

    console.log('✅ user_points 表创建成功！\n');

    // 验证数据
    const result = await client.query(`
      SELECT u.username, up.balance, up.total_recharged, up.total_consumed
      FROM users u
      JOIN user_points up ON u.id = up.user_id
      ORDER BY u.created_at DESC
    `);

    console.log('📊 用户积分数据：');
    console.table(result.rows);

    console.log('\n✅ 迁移完成！');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
