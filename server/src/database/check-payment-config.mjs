import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'videoflow_pro',
    user: 'postgres',
    password: 'Mp112233@'
});

async function checkConfig() {
    const client = await pool.connect();
    try {
        // 检查upload_post_config表结构
        console.log('📊 upload_post_config 表结构：\n');
        const cols = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'upload_post_config'
            ORDER BY ordinal_position
        `);
        
        cols.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });

        // 查询配置数据
        console.log('\n📋 配置数据：\n');
        const data = await client.query('SELECT * FROM upload_post_config');
        
        if (data.rows.length === 0) {
            console.log('   ❌ 无配置数据');
        } else {
            data.rows.forEach(row => {
                console.log(`   配置ID: ${row.id}`);
                console.log(`   用户ID: ${row.user_id}`);
                console.log(`   配置内容:`, JSON.stringify(row.config, null, 2));
                console.log('');
            });
        }

        // 检查system_settings表是否有支付相关配置
        console.log('🔍 system_settings 中的支付配置：\n');
        const settings = await client.query(`
            SELECT *
            FROM system_settings
            WHERE setting_key LIKE '%payment%' OR setting_key LIKE '%pay%'
        `);

        if (settings.rows.length === 0) {
            console.log('   ❌ 未找到支付配置\n');
            
            console.log('📋 所有系统设置：\n');
            const allSettings = await client.query('SELECT * FROM system_settings ORDER BY id');
            allSettings.rows.forEach(s => {
                console.log(`   ${s.setting_key} = ${s.setting_value}`);
            });
        } else {
            settings.rows.forEach(s => {
                console.log(`   ${s.setting_key} = ${s.setting_value}`);
            });
        }

    } catch (error) {
        console.error('❌ 查询失败:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkConfig();
