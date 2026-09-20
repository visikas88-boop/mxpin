// 检查表结构
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    database: process.env.DATABASE_NAME || 'videoflow_pro',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
});

async function checkStructure() {
    try {
        console.log('🔍 检查 subscription_plans 表结构:\n');

        const columns = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'subscription_plans'
            ORDER BY ordinal_position
        `);

        columns.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}`);
        });

        console.log('\n📊 查询数据:\n');
        const data = await pool.query('SELECT * FROM subscription_plans LIMIT 3');
        console.log(`  共 ${data.rows.length} 条记录`);

        if (data.rows.length > 0) {
            console.log('\n  示例数据:');
            console.log(JSON.stringify(data.rows[0], null, 2));
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await pool.end();
    }
}

checkStructure();
