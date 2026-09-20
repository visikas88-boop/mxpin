import axios from 'axios';
import FormData from 'form-data';

// 测试调用视频生成API
async function testVideoAPI() {
    const apiBaseUrl = 'https://julun.cc';
    const apiKey = 'sk-a4s29FgmEGbFfnBVcQr7Qf5KnuCvESuVsHApOg2LYkf1mFgY'; // 真实解密后的key

    console.log('测试1: 检查v1端点');
    try {
        const response = await axios.get(`${apiBaseUrl}/v1/models`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        console.log('✅ v1/models连通:', response.status);
        console.log('可用模型:', JSON.stringify(response.data, null, 2).substring(0, 500));
    } catch (error) {
        console.error('❌ v1/models失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应类型:', error.response.headers['content-type']);
        }
    }

    console.log('\n测试2: 创建视频生成任务（OpenAI格式）');
    try {
        const body = {
            model: 'minimax-h3 2k',  // 使用正确的模型名（有空格）
            prompt: '测试视频：一只可爱的猫咪在草地上玩耍',
            seconds: 6,
            size: '1280x720'
        };

        const response = await axios.post(`${apiBaseUrl}/v1/videos/generations`, body, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log('✅ 任务创建成功:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ 任务创建失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
        }
    }

    console.log('\n测试3: 尝试chat/completions格式');
    try {
        const body = {
            model: 'minimax-h3-2k',
            messages: [{
                role: 'user',
                content: '测试'
            }]
        };

        const response = await axios.post(`${apiBaseUrl}/v1/chat/completions`, body, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log('✅ chat连通:', response.status);
    } catch (error) {
        console.error('❌ chat失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
        }
    }
}

testVideoAPI();
