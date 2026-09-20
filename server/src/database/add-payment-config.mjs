import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'videoflow_pro',
    user: 'postgres',
    password: 'Mp112233@'
});

async function addPaymentConfig() {
    const client = await pool.connect();
    try {
        console.log('💳 添加码支付配置...\n');

        // 插入码支付配置
        await client.query(`
            INSERT INTO system_settings (setting_key, setting_value, setting_description, setting_type)
            VALUES
                ('codepay_enabled', 'true', '是否启用码支付', 'boolean'),
                ('codepay_api_url', 'https://api.codepay.com', '码支付API地址', 'string'),
                ('codepay_app_id', '', '码支付应用ID', 'string'),
                ('codepay_app_secret', '', '码支付应用密钥', 'string'),
                ('codepay_notify_url', 'http://localhost:3001/api/payment/notify', '支付回调地址', 'string'),
                ('payment_timeout', '300', '支付超时时间（秒）', 'number')
            ON CONFLICT (setting_key) DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                updated_at = CURRENT_TIMESTAMP
        `);

        console.log('✅ 码支付配置添加成功\n');

        // 查询确认
        const result = await client.query(`
            SELECT setting_key, setting_value, setting_description
            FROM system_settings
            WHERE setting_key LIKE 'codepay_%' OR setting_key = 'payment_timeout'
            ORDER BY setting_key
        `);

        console.log('📋 当前支付配置：\n');
        result.rows.forEach(row => {
            console.log(`   ${row.setting_key}: ${row.setting_value}`);
            console.log(`      说明: ${row.setting_description}\n`);
        });

        console.log('⚠️  请在管理后台配置以下信息：');
        console.log('   1. 码支付应用ID (codepay_app_id)');
        console.log('   2. 码支付应用密钥 (codepay_app_secret)');
        console.log('   3. 码支付API地址 (codepay_api_url)');

    } catch (error) {
        console.error('❌ 添加失败:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

addPaymentConfig();
