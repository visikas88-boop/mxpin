import pool from '../config/database.js';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { decryptApiKey } from '../utils/crypto.js';

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 20 // 最多20个文件
  }
});

/**
 * 创建视频生成任务
 * POST /videos
 */
export const createVideoTask = [
  (req, res, next) => {
    upload.fields([
      { name: 'image[]', maxCount: 9 },
      { name: 'first_frame', maxCount: 1 },
      { name: 'last_frame', maxCount: 1 },
      { name: 'video[]', maxCount: 5 },
      { name: 'audio[]', maxCount: 5 }
    ])(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: '文件大小超过限制（单个文件最大50MB）'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(413).json({
            success: false,
            message: '文件数量超过限制（最多20个文件）'
          });
        }
        return res.status(400).json({
          success: false,
          message: '文件上传失败: ' + err.message
        });
      }
      next();
    });
  },
  async (req, res) => {
    const client = await pool.connect();

    try {
      // 获取用户ID，如果未登录则使用默认用户或创建临时用户
      let userId = req.user?.id;

      if (!userId) {
        // 查找或创建默认测试用户
        const defaultUserQuery = await pool.query(
          `SELECT id FROM users WHERE email = 'test@videoflow.com' LIMIT 1`
        );

        if (defaultUserQuery.rows.length > 0) {
          userId = defaultUserQuery.rows[0].id;
        } else {
          return res.status(401).json({
            success: false,
            message: '请先登录后使用视频生成功能'
          });
        }
      }

      const {
        model,
        prompt,
        seconds,
        size,
        resolution_name,
        generate_audio,
        watermark,
        mode
      } = req.body;

      console.log('收到视频生成请求:', { model, prompt, seconds, size });

      // 验证必填参数
      if (!model || !prompt) {
        return res.status(400).json({
          success: false,
          message: '缺少必填参数：model 和 prompt'
        });
      }

      await client.query('BEGIN');

      // 解析模型（格式：channelId::modelName）
      const [channelId, modelName] = model.includes('::') ? model.split('::') : [null, model];

      // 查询模型信息
      const modelQuery = await client.query(
        `SELECT id, model_key, model_name, provider, api_base_url, api_key_encrypted,
                api_format, points_cost, billing_type, default_params
         FROM ai_models
         WHERE model_key = $1 AND is_enabled = true`,
        [modelName]
      );

      if (modelQuery.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: '模型不存在或未启用'
        });
      }

      const modelInfo = modelQuery.rows[0];
      const modelId = modelInfo.id;

      // 解密API Key
      const apiKey = decryptApiKey(modelInfo.api_key_encrypted);
      const apiBaseUrl = modelInfo.api_base_url;
      const apiFormat = modelInfo.api_format || 'openai';

      console.log('模型信息:', {
        provider: modelInfo.provider,
        apiBaseUrl,
        apiFormat,
        hasApiKey: !!apiKey
      });

      // 计算积分消耗
      let pointsCost = 0;
      if (modelInfo.billing_type === 'per_request') {
        pointsCost = modelInfo.points_cost || 0;
      } else if (modelInfo.billing_type === 'per_second') {
        const videoSeconds = parseInt(seconds) || 15;
        pointsCost = (modelInfo.points_cost || 0) * videoSeconds;
      }

      console.log('积分消耗:', pointsCost);

      // 检查用户积分余额
      const balanceQuery = await client.query(
        'SELECT balance FROM user_points WHERE user_id = $1',
        [userId]
      );

      const currentBalance = balanceQuery.rows[0]?.balance || 0;

      if (currentBalance < pointsCost) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          success: false,
          message: '积分余额不足',
          required: pointsCost,
          balance: currentBalance
        });
      }

      // 扣除积分
      if (pointsCost > 0) {
        await client.query(
          'UPDATE user_points SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2',
          [pointsCost, userId]
        );

        // 记录积分交易
        await client.query(
          `INSERT INTO points_transactions
           (user_id, points, type, balance_before, balance_after, remark)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, -pointsCost, 'deduction', currentBalance, currentBalance - pointsCost, `视频生成：${prompt.substring(0, 50)}...`]
        );
      }

      // 创建生成任务记录
      const taskResult = await client.query(
        `INSERT INTO generation_tasks
         (user_id, model_id, task_type, prompt, params, points_cost, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, status, created_at`,
        [
          userId,
          modelId,
          'video',
          prompt,
          JSON.stringify({
            model: model,
            seconds,
            size,
            resolution_name,
            generate_audio,
            watermark,
            mode,
            images_count: req.files?.['image[]']?.length || 0
          }),
          pointsCost,
          'pending'
        ]
      );

      await client.query('COMMIT');

      const taskId = taskResult.rows[0].id;

      // 返回 OpenAI 兼容的响应格式
      res.json({
        id: taskId,
        status: 'pending',
        model: model,
        created_at: taskResult.rows[0].created_at
      });

      console.log('任务创建成功:', taskId);

      // 异步调用真实的视频生成API
      callVideoGenerationAPI({
        taskId,
        userId,
        modelInfo,
        apiKey,
        apiBaseUrl,
        apiFormat,
        prompt,
        seconds,
        size,
        resolution_name,
        generate_audio,
        watermark,
        mode,
        files: req.files,
        pointsCost
      }).catch(err => {
        console.error('视频生成API调用失败:', err);
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create video task error:', error);
      res.status(500).json({
        success: false,
        message: '创建视频任务失败',
        error: error.message
      });
    } finally {
      client.release();
    }
  }
];

/**
 * 调用真实的视频生成API
 */
async function callVideoGenerationAPI(options) {
  const {
    taskId,
    userId,
    modelInfo,
    apiKey,
    apiBaseUrl,
    apiFormat,
    prompt,
    seconds,
    size,
    resolution_name,
    generate_audio,
    watermark,
    mode,
    files,
    pointsCost
  } = options;

  try {
    console.log('开始调用视频生成API...');
    console.log('模型信息:', { model: modelInfo.model_key, apiBaseUrl });

    // 判断是否使用multipart/form-data（有文件上传）还是JSON
    let response;

    if (files && (files['image[]']?.length > 0 || files['video[]']?.length > 0)) {
      // 有文件：使用FormData
      const formData = new FormData();
      formData.append('model', modelInfo.model_key);
      formData.append('prompt', prompt);
      if (seconds) formData.append('seconds', seconds.toString());
      if (size) formData.append('size', size);
      if (resolution_name) formData.append('resolution_name', resolution_name);
      if (generate_audio !== undefined) formData.append('generate_audio', generate_audio.toString());
      if (watermark !== undefined) formData.append('watermark', watermark.toString());
      if (mode) formData.append('mode', mode);

      // 添加图片文件
      if (files['image[]']) {
        for (const file of files['image[]']) {
          formData.append('image[]', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype
          });
        }
      }

      console.log('使用FormData上传，包含', files['image[]']?.length || 0, '张图片');

      response = await axios.post(`${apiBaseUrl}/v1/videos/generations`, formData, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        timeout: 15000
      });
    } else {
      // 无文件：使用JSON
      const body = {
        model: modelInfo.model_key,
        prompt: prompt,
        seconds: parseInt(seconds) || 6,
        size: size || '1280x720'
      };

      console.log('使用JSON请求:', body);

      response = await axios.post(`${apiBaseUrl}/v1/videos/generations`, body, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
    }

    const videoTaskId = response.data.id || response.data.task_id;
    console.log('视频任务已创建:', videoTaskId);

    if (!videoTaskId) {
      throw new Error('未获取到任务ID');
    }

    // 更新任务状态为processing
    await pool.query(
      `UPDATE generation_tasks
       SET status = $1, params = jsonb_set(params, '{external_task_id}', $2::jsonb)
       WHERE id = $3`,
      ['processing', JSON.stringify(videoTaskId), taskId]
    );

    // 轮询视频生成状态
    pollVideoStatus(taskId, videoTaskId, userId, apiKey, apiBaseUrl, pointsCost, prompt);

  } catch (error) {
    console.error('调用视频API失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }

    // 标记任务失败并退回积分
    await refundPoints(taskId, userId, pointsCost, `API调用失败: ${error.message}`, prompt);
  }
}

/**
 * 轮询视频生成状态
 */
async function pollVideoStatus(taskId, externalTaskId, userId, apiKey, apiBaseUrl, pointsCost, prompt) {
  const maxAttempts = 360; // 最多轮询360次（15分钟）- MiniMax H3通常需要5-15分钟
  let attempt = 0;

  const pollInterval = setInterval(async () => {
    attempt++;

    try {
      const statusUrl = `${apiBaseUrl}/v1/videos/generations/${externalTaskId}`;
      const response = await axios.get(statusUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 5000
      });

      const status = response.data.status;
      console.log(`轮询视频状态 (${attempt}/${maxAttempts}):`, status, '- 进度:', response.data.progress || 0);

      if (status === 'completed' || status === 'succeeded') {
        clearInterval(pollInterval);

        const videoUrl = response.data.video_url || response.data.url || response.data.result?.video_url;

        if (videoUrl) {
          await pool.query(
            `UPDATE generation_tasks
             SET status = $1, result_url = $2, completed_at = NOW()
             WHERE id = $3`,
            ['completed', videoUrl, taskId]
          );
          console.log('视频生成成功:', videoUrl);
        } else {
          await refundPoints(taskId, userId, pointsCost, '未获取到视频URL', prompt);
        }

      } else if (status === 'failed' || status === 'cancelled' || status === 'error') {
        clearInterval(pollInterval);
        const errorMsg = response.data.error?.message || response.data.message || '视频生成失败';
        await refundPoints(taskId, userId, pointsCost, errorMsg, prompt);
      }

      if (attempt >= maxAttempts) {
        clearInterval(pollInterval);
        await refundPoints(taskId, userId, pointsCost, '视频生成超时', prompt);
      }

    } catch (error) {
      console.error('轮询状态失败:', error.message);

      if (attempt >= maxAttempts) {
        clearInterval(pollInterval);
        await refundPoints(taskId, userId, pointsCost, '状态查询失败', prompt);
      }
    }
  }, 2500); // 每2.5秒轮询一次
}

/**
 * 退回积分
 */
async function refundPoints(taskId, userId, pointsCost, errorMessage, prompt) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 更新任务状态
    await client.query(
      `UPDATE generation_tasks
       SET status = $1, error_message = $2, points_refunded = $3, completed_at = NOW()
       WHERE id = $4`,
      ['failed', errorMessage, pointsCost, taskId]
    );

    // 退回积分
    if (pointsCost > 0) {
      const balanceQuery = await client.query(
        'SELECT balance FROM user_points WHERE user_id = $1',
        [userId]
      );
      const currentBalance = balanceQuery.rows[0]?.balance || 0;

      await client.query(
        'UPDATE user_points SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2',
        [pointsCost, userId]
      );

      await client.query(
        `INSERT INTO points_transactions
         (user_id, points, type, balance_before, balance_after, remark)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, pointsCost, 'refund', currentBalance, currentBalance + pointsCost, `视频生成失败退款：${prompt.substring(0, 50)}...`]
      );

      console.log(`已退回积分: ${pointsCost}, 原因: ${errorMessage}`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('退回积分失败:', error);
  } finally {
    client.release();
  }
}

/**
 * 获取视频任务状态
 * GET /videos/:id
 */
export const getVideoTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // 如果没有用户ID，只返回基本信息
    const query = userId
      ? `SELECT id, status, task_type, prompt, result_url, error_message, points_cost,
                points_refunded, params, created_at, completed_at
         FROM generation_tasks
         WHERE id = $1 AND user_id = $2`
      : `SELECT id, status, task_type, prompt, result_url, error_message, points_cost,
                points_refunded, params, created_at, completed_at
         FROM generation_tasks
         WHERE id = $1`;

    const queryParams = userId ? [id, userId] : [id];
    const result = await pool.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const task = result.rows[0];
    const params = task.params || {};

    // 返回 OpenAI 兼容的响应格式
    const response = {
      id: task.id,
      status: task.status,
      model: params.model || '',
      created_at: task.created_at
    };

    if (task.status === 'completed' && task.result_url) {
      response.video_url = task.result_url;
      response.url = task.result_url;
    }

    if (task.status === 'failed' && task.error_message) {
      response.error = {
        message: task.error_message
      };
    }

    res.json(response);

  } catch (error) {
    console.error('Get video task status error:', error);
    res.status(500).json({
      success: false,
      message: '获取任务状态失败',
      error: error.message
    });
  }
};
