import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Client } = pg;

async function migrate() {
  console.log('Starting database migration...');

  // 步骤1: 连接到 postgres 数据库，创建 videoflow_pro 数据库
  const defaultClient = new Client({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: 'postgres',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    await defaultClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // 创建数据库
    console.log('📝 Creating database...');
    await defaultClient.query('DROP DATABASE IF EXISTS videoflow_pro');
    await defaultClient.query("CREATE DATABASE videoflow_pro WITH ENCODING 'UTF8'");
    console.log('✅ Database created');

    await defaultClient.end();

    // 步骤2: 连接到新创建的数据库，执行表创建
    const dbClient = new Client({
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      database: 'videoflow_pro',
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
    });

    await dbClient.connect();
    console.log('✅ Connected to videoflow_pro');

    // 读取并清理 SQL 脚本
    const migrationPath = join(__dirname, 'migrations', '001-init.sql');
    let sql = readFileSync(migrationPath, 'utf8');

    // 移除不兼容的命令
    sql = sql.replace(/DROP DATABASE.*?;/gi, '');
    sql = sql.replace(/CREATE DATABASE.*?;/gi, '');
    sql = sql.replace(/\\c.*$/gm, '');
    sql = sql.replace(/--.*$/gm, ''); // 移除单行注释

    // 执行表创建
    console.log('📝 Creating tables...');
    await dbClient.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Database: videoflow_pro');
    console.log('📋 Total tables: 9');
    console.log('👤 Default admin user:');
    console.log('   Email: admin@videoflow.pro');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('');

    await dbClient.end();

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// 执行迁移
migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
