import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'videoflow_pro',
    user: 'postgres',
    password: 'Mp112233@'
});

async function queryPaymentKeys() {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT id, key_name, key_type, api_endpoint, config
            FROM ai_api_keys
            WHERE key_type = 'payment' OR key_name LIKE '%支付%' OR key_name LIKE '%码支付%'
        `);

        console.log('🔍 支付相关配置：\n');

        if (result.rows.length === 0) {
            console.log('❌ 未找到支付配置\n');
            console.log('查询所有API密钥...\n');

            const allKeys = await client.query(`
                SELECT id, key_name, key_type, api_endpoint
                FROM ai_api_keys
                ORDER BY id
            `);

            console.log('📋 所有API密钥：');
            allKeys.rows.forEach(row => {
                console.log(`   [${row.id}] ${row.key_name} (${row.key_type}) - ${row.api_endpoint || 'N/A'}`);
            });
        } else {
            result.rows.forEach(row => {
                console.log(`✅ ${row.key_name}`);
                console.log(`   类型: ${row.key_type}`);
                console.log(`   端点: ${row.api_endpoint || 'N/A'}`);
                console.log(`   配置: ${JSON.stringify(row.config, null, 2)}`);
                console.log('');
            });
        }
    } catch (error) {
        console.error('❌ 查询失败:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

queryPaymentKeys();
