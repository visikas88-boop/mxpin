// 数据库迁移脚本
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config();

const { Pool } = pg;

// 数据库连接配置
const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    database: process.env.DATABASE_NAME || 'videoflow_pro',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD
});

// 迁移文件列表
const migrations = [
    'src/database/migration_high_profit_subscription.sql',
    'src/database/migration_upload_post_integration.sql',
    'src/database/migration_profile_quota_management.sql'
];

async function runMigration(filePath) {
    const fullPath = path.join(__dirname, filePath);
    console.log(`\n📄 执行迁移: ${filePath}`);

    try {
        // 读取SQL文件
        const sql = fs.readFileSync(fullPath, 'utf8');

        // 执行SQL
        await pool.query(sql);

        console.log(`✅ 迁移成功: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`❌ 迁移失败: ${filePath}`);
        console.error(`错误信息: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🚀 开始数据库迁移...\n');
    console.log(`数据库: ${process.env.DATABASE_NAME}`);
    console.log(`主机: ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`);
    console.log(`用户: ${process.env.DATABASE_USER}`);

    try {
        // 测试连接
        await pool.query('SELECT NOW()');
        console.log('✅ 数据库连接成功\n');

        // 执行所有迁移
        let successCount = 0;
        for (const migration of migrations) {
            const success = await runMigration(migration);
            if (success) successCount++;
        }

        console.log(`\n📊 迁移统计:`);
        console.log(`   总计: ${migrations.length}`);
        console.log(`   成功: ${successCount}`);
        console.log(`   失败: ${migrations.length - successCount}`);

        if (successCount === migrations.length) {
            console.log('\n🎉 所有迁移执行成功！');

            // 验证迁移结果
            console.log('\n🔍 验证迁移结果...');

            // 检查订阅套餐
            const plans = await pool.query('SELECT * FROM subscription_plans');
            console.log(`✅ subscription_plans 表: ${plans.rows.length} 条记录`);
            plans.rows.forEach(plan => {
                console.log(`   - ${plan.name}: ¥${plan.price_monthly}/月 (利润率: ${plan.profit_margin}%)`);
            });

            // 检查其他表
            const tables = [
                'upload_post_config',
                'user_upload_post_profiles',
                'social_accounts',
                'publishing_tasks'
            ];

            for (const table of tables) {
                try {
                    const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
                    console.log(`✅ ${table} 表: ${result.rows[0].count} 条记录`);
                } catch (err) {
                    console.log(`⚠️ ${table} 表: 检查失败 (${err.message})`);
                }
            }

        } else {
            console.log('\n⚠️ 部分迁移失败，请检查错误信息');
        }

    } catch (error) {
        console.error('\n❌ 数据库连接失败:');
        console.error(error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
