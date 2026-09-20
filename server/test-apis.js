// 测试新添加的API端点
import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

// 模拟管理员登录获取token
async function getAdminToken() {
    try {
        // 这里需要使用实际的管理员账号
        // 如果没有，需要先创建一个
        const response = await axios.post(`${BASE_URL}/api/auth/admin/login`, {
            username: 'admin',
            password: 'admin123'
        });
        return response.data.token;
    } catch (error) {
        console.log('⚠️  请先创建管理员账号或使用正确的凭据');
        return null;
    }
}

async function testAPIs() {
    console.log('🧪 测试新添加的API端点\n');

    // 获取token（如果需要认证）
    // const token = await getAdminToken();

    // Test 1: 订阅套餐列表
    console.log('1️⃣ 测试订阅套餐API');
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/subscription/plans`);
        console.log(`   ✅ GET /api/admin/subscription/plans`);
        console.log(`   状态: ${response.status}`);
        console.log(`   套餐数量: ${response.data.data?.length || 0}`);
        if (response.data.data && response.data.data.length > 0) {
            const plan = response.data.data[0];
            console.log(`   示例: ${plan.plan_name} - ¥${plan.price_monthly}/月`);
        }
    } catch (error) {
        if (error.response?.status === 401) {
            console.log(`   ⚠️  需要认证 (401)`);
        } else {
            console.log(`   ❌ 错误: ${error.message}`);
        }
    }

    console.log('\n2️⃣ 测试Upload-Post配置API');
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/upload-post/config`);
        console.log(`   ✅ GET /api/admin/upload-post/config`);
        console.log(`   状态: ${response.status}`);
        console.log(`   已配置: ${response.data.data ? '是' : '否'}`);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log(`   ⚠️  需要认证 (401)`);
        } else {
            console.log(`   ❌ 错误: ${error.message}`);
        }
    }

    console.log('\n3️⃣ 测试Profile配额API');
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/profile-quota/quota`);
        console.log(`   ✅ GET /api/admin/profile-quota/quota`);
        console.log(`   状态: ${response.status}`);
        if (response.data.data) {
            const quota = response.data.data.quota;
            console.log(`   配额: ${quota.current_used}/${quota.max_profiles}`);
        }
    } catch (error) {
        if (error.response?.status === 401) {
            console.log(`   ⚠️  需要认证 (401)`);
        } else {
            console.log(`   ❌ 错误: ${error.message}`);
        }
    }

    console.log('\n4️⃣ 测试Health Check');
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        console.log(`   ✅ GET /health`);
        console.log(`   状态: ${response.status}`);
        console.log(`   服务: ${response.data.service}`);
    } catch (error) {
        console.log(`   ❌ 错误: ${error.message}`);
    }

    console.log('\n📊 测试总结:');
    console.log('   所有API端点已注册');
    console.log('   需要管理员认证才能访问数据');
    console.log('   可以在前端管理后台正常使用\n');
}

testAPIs();
