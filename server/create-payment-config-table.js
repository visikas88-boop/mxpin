import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DATABASE_USER || 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'videoflow_pro',
    password: process.env.DATABASE_PASSWORD || 'Mp112233@',
    port: process.env.DATABASE_PORT || 5432,
});

async function createTable() {
    try {
        console.log('连接数据库...');

        const sql = fs.readFileSync('src/database/payment-config-schema.sql', 'utf8');

        console.log('执行SQL...');
        await pool.query(sql);

        console.log('✅ 支付配置表创建成功！');

        // 查询创建的表
        const result = await pool.query(`
            SELECT * FROM payment_config ORDER BY id
        `);

        console.log('\n当前支付配置：');
        console.table(result.rows);

    } catch (error) {
        console.error('❌ 创建表失败:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

createTable();
