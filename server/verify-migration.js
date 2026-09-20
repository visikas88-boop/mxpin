// 验证数据库迁移结果
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

async function verify() {
    console.log('🔍 验证数据库迁移结果...\n');

    try {
        // 1. 检查订阅套餐
        console.log('📦 1. 订阅套餐 (subscription_plans):');
        const plans = await pool.query('SELECT name, price_monthly, profit_margin, max_profiles, max_publish_per_month FROM subscription_plans ORDER BY price_monthly');
        console.log(`   总计: ${plans.rows.length} 个套餐\n`);
        plans.rows.forEach(plan => {
            console.log(`   ✅ ${plan.name}`);
            console.log(`      月费: ¥${plan.price_monthly}`);
            console.log(`      利润率: ${plan.profit_margin}%`);
            console.log(`      Profile数: ${plan.max_profiles}`);
            console.log(`      月发布次数: ${plan.max_publish_per_month}\n`);
        });

        // 2. 检查Upload-Post配置
        console.log('⚙️  2. Upload-Post配置 (upload_post_config):');
        const config = await pool.query('SELECT * FROM upload_post_config');
        if (config.rows.length > 0) {
            const c = config.rows[0];
            console.log(`   ✅ 配置已存在`);
            console.log(`      最大Profile数: ${c.max_profiles}`);
            console.log(`      当前已使用: ${c.current_profiles_used}`);
            console.log(`      预警阈值: ${c.profile_quota_warning_threshold}\n`);
        } else {
            console.log(`   ⚠️  配置表为空，需要管理员配置API Key\n`);
        }

        // 3. 检查核心表
        console.log('📊 3. 核心表检查:');
        const tables = [
            'user_upload_post_profiles',
            'social_accounts',
            'publishing_tasks',
            'publishing_logs'
        ];

        for (const table of tables) {
            try {
                const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`   ✅ ${table}: ${result.rows[0].count} 条记录`);
            } catch (err) {
                console.log(`   ❌ ${table}: ${err.message}`);
            }
        }

        // 4. 检查触发器
        console.log('\n🔧 4. 触发器检查:');
        const triggers = await pool.query(`
            SELECT trigger_name, event_object_table
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            AND trigger_name LIKE '%profile%'
        `);
        triggers.rows.forEach(t => {
            console.log(`   ✅ ${t.trigger_name} on ${t.event_object_table}`);
        });

        // 5. 检查函数
        console.log('\n⚡ 5. 函数检查:');
        const functions = await pool.query(`
            SELECT proname as function_name
            FROM pg_proc
            WHERE proname LIKE '%profile%' OR proname LIKE '%quota%'
        `);
        functions.rows.forEach(f => {
            console.log(`   ✅ ${f.function_name}()`);
        });

        // 6. 测试配额检查函数
        console.log('\n🧪 6. 测试配额检查:');
        const quotaInfo = await pool.query('SELECT * FROM get_profile_quota_info()');
        if (quotaInfo.rows.length > 0) {
            const q = quotaInfo.rows[0];
            console.log(`   最大配额: ${q.max_profiles}`);
            console.log(`   已使用: ${q.current_used}`);
            console.log(`   可用: ${q.available}`);
            console.log(`   使用率: ${q.usage_percent}%`);
            console.log(`   状态: ${q.is_full ? '❌ 已满' : q.is_warning ? '⚠️ 预警' : '✅ 正常'}`);
        }

        console.log('\n✅ 数据库迁移验证完成！\n');
        console.log('📋 下一步:');
        console.log('   1. 注册后端路由');
        console.log('   2. 配置Upload-Post API Key');
        console.log('   3. 注册前端路由');

    } catch (error) {
        console.error('❌ 验证失败:', error.message);
    } finally {
        await pool.end();
    }
}

verify();
