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
        // 查找所有表
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

        // 查找包含'key'或'api'的表
        const apiTables = result.rows.filter(row =>
            row.table_name.includes('key') ||
            row.table_name.includes('api') ||
            row.table_name.includes('payment')
        );

        if (apiTables.length > 0) {
            console.log('\n🔑 可能包含API/支付配置的表：\n');
            for (const table of apiTables) {
                console.log(`   📊 ${table.table_name}`);
                const cols = await client.query(`
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                `, [table.table_name]);

                cols.rows.forEach(col => {
                    console.log(`      - ${col.column_name} (${col.data_type})`);
                });
                console.log('');
            }
        }
    } catch (error) {
        console.error('❌ 查询失败:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

findTables();
