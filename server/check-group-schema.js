import pg from 'pg';
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

async function checkSchema() {
    try {
        // 查看表结构
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'recharge_package_groups'
            ORDER BY ordinal_position
        `);

        console.log('recharge_package_groups 表结构:');
        console.table(result.rows);

        // 查看现有数据
        const data = await pool.query('SELECT * FROM recharge_package_groups');
        console.log('\n现有数据:');
        console.table(data.rows);

    } catch (error) {
        console.error('错误:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
