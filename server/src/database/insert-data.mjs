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

async function executeSQLFile() {
    const client = await pool.connect();

    try {
        console.log('📦 开始插入套餐数据...\n');

        // 读取SQL文件
        const sqlFilePath = path.join(__dirname, 'insert-packages-data.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');

        // 执行SQL
        await client.query('BEGIN');

        // 分割SQL语句并逐个执行
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            if (statement.trim()) {
                await client.query(statement);
            }
        }

        await client.query('COMMIT');

        console.log('✅ 套餐数据插入成功！\n');

        // 查询验证
        const result = await client.query(`
            SELECT
                COUNT(*) as total_packages,
                SUM(CASE WHEN group_id = 1 THEN 1 ELSE 0 END) as limited_packages,
                SUM(CASE WHEN group_id = 2 THEN 1 ELSE 0 END) as daily_packages
            FROM recharge_packages
        `);

        console.log('📊 统计信息：');
        console.log(`   总套餐数: ${result.rows[0].total_packages}`);
        console.log(`   限时套餐: ${result.rows[0].limited_packages}`);
        console.log(`   日常套餐: ${result.rows[0].daily_packages}\n`);

        // 显示部分套餐数据
        const packages = await client.query(`
            SELECT package_name, price, gift_percent,
                   CASE WHEN valid_type = 'permanent' THEN '永久' ELSE CONCAT(valid_days, '天') END as validity
            FROM recharge_packages
            ORDER BY sort_order
            LIMIT 5
        `);

        console.log('📋 部分套餐示例：');
        packages.rows.forEach(pkg => {
            console.log(`   ${pkg.package_name} - ¥${pkg.price} (赠送${pkg.gift_percent}%) - ${pkg.validity}`);
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 执行失败:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

executeSQLFile()
    .then(() => {
        console.log('\n✨ 完成！请刷新管理后台页面查看套餐数据。');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 错误:', error);
        process.exit(1);
    });
