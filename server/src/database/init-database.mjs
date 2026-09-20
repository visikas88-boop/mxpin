import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// 数据库配置
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'videoflow_pro',
    user: 'postgres',
    password: 'Mp112233@'
});

async function initDatabase() {
    const client = await pool.connect();

    try {
        console.log('🚀 开始初始化数据库...\n');

        // 第1步：创建表结构
        console.log('📋 步骤1: 创建表结构...');
        const schemaPath = path.join(__dirname, 'recharge-packages-schema-fixed3.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await client.query(schemaSql);
        console.log('✅ 表结构创建成功\n');

        // 第2步：插入套餐数据
        console.log('📦 步骤2: 插入套餐数据...');
        const dataPath = path.join(__dirname, 'insert-packages-data-final.sql');
        const dataSql = fs.readFileSync(dataPath, 'utf8');

        await client.query(dataSql);
        console.log('✅ 套餐数据插入成功\n');

        // 第3步：验证数据
        console.log('🔍 步骤3: 验证数据...\n');

        // 查询分组
        const groups = await client.query(`
            SELECT group_id, group_name, group_type
            FROM recharge_package_groups
            ORDER BY group_id
        `);

        console.log('📂 套餐分组:');
        groups.rows.forEach(g => {
            console.log(`   [${g.group_id}] ${g.group_name} (${g.group_type})`);
        });
        console.log('');

        // 查询套餐统计
        const stats = await client.query(`
            SELECT
                COUNT(*) as total_packages,
                SUM(CASE WHEN group_id = 'limited' THEN 1 ELSE 0 END) as limited_packages,
                SUM(CASE WHEN group_id = 'daily' THEN 1 ELSE 0 END) as daily_packages
            FROM recharge_packages
        `);

        console.log('📊 套餐统计:');
        console.log(`   总套餐数: ${stats.rows[0].total_packages}`);
        console.log(`   限时套餐: ${stats.rows[0].limited_packages}`);
        console.log(`   日常套餐: ${stats.rows[0].daily_packages}\n`);

        // 显示部分套餐
        const packages = await client.query(`
            SELECT
                package_name,
                price,
                gift_percent,
                CASE WHEN valid_type = 'permanent' THEN '永久' ELSE CONCAT(valid_days, '天') END as validity,
                is_hot,
                is_enabled
            FROM recharge_packages
            ORDER BY sort_order
            LIMIT 8
        `);

        console.log('📋 套餐示例（前8个）:');
        packages.rows.forEach((pkg, idx) => {
            const hot = pkg.is_hot ? '🔥' : '  ';
            const status = pkg.is_enabled ? '✅' : '❌';
            console.log(`   ${hot} ${status} ${pkg.package_name} - ¥${pkg.price} (赠送${pkg.gift_percent}%) - ${pkg.validity}`);
        });
        console.log('');

        // 查询系统设置
        const settings = await client.query(`
            SELECT setting_key, setting_value, setting_description
            FROM system_settings
            WHERE setting_key = 'points_exchange_rate'
        `);

        if (settings.rows.length > 0) {
            console.log('⚙️  系统设置:');
            console.log(`   积分兑换比例: 1元 = ${settings.rows[0].setting_value} 积分\n`);
        }

    } catch (error) {
        console.error('❌ 初始化失败:', error.message);
        console.error('错误详情:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

initDatabase()
    .then(() => {
        console.log('✨ 数据库初始化完成！');
        console.log('');
        console.log('📝 后续步骤:');
        console.log('   1. 刷新管理后台页面');
        console.log('   2. 进入"积分管理"');
        console.log('   3. 查看"积分设置" Tab');
        console.log('   4. 应该能看到2个分组和18个套餐');
        console.log('');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 错误:', error.message);
        process.exit(1);
    });
