import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function updateAdminPassword() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: 'videoflow_pro',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 更新管理员密码
    const newHash = '$2b$10$lRmuJKuZBUd6LMQSaiw2heCHEDmtlyZqph1XY.knrCXR240dFUudS';
    const result = await client.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING username, email',
      [newHash, 'admin']
    );

    if (result.rowCount > 0) {
      console.log('✅ Admin password updated successfully');
      console.log('   Username:', result.rows[0].username);
      console.log('   Email:', result.rows[0].email);
    } else {
      console.log('⚠️  Admin user not found');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateAdminPassword();
