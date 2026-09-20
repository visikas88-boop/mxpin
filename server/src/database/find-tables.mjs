import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'videoflow_pro',
    user: 'postgres',
    password: 'Mp112233@'
});

async function findTables() {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('📋 数据库中的所有表：\n');
        result.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
    } catch (error) {
        console.error('❌ 查询失败:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

findTables();
