import pkg from 'pg';
const { Pool } = pkg;
import { decryptApiKey } from './src/utils/crypto.js';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'videoflow_pro',
  user: 'postgres',
  password: 'Mp112233@'
});

async function getApiKey() {
  try {
    const result = await pool.query(
      `SELECT model_name, model_key, api_base_url, api_key_encrypted
       FROM ai_models
       WHERE model_key LIKE '%minimax%'
       LIMIT 1`
    );

    if (result.rows.length > 0) {
      const model = result.rows[0];
      console.log('模型名称:', model.model_name);
      console.log('模型key:', model.model_key);
      console.log('API地址:', model.api_base_url);
      console.log('加密的key:', model.api_key_encrypted);

      try {
        const decryptedKey = decryptApiKey(model.api_key_encrypted);
        console.log('\n解密后的API Key:', decryptedKey);
      } catch (err) {
        console.error('解密失败:', err.message);
      }
    } else {
      console.log('未找到minimax模型');
    }
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await pool.end();
  }
}

getApiKey();
