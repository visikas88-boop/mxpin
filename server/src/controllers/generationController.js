import { query } from '../config/database.js';
import { decryptApiKey } from '../utils/crypto.js';
import axios from 'axios';

/**
 * 创建生成任务
 * POST /api/generation/create
 */
export async function createTask(req, res) {
  try {
    const { modelId, prompt, negativePrompt, params } = req.body;
    const userId = req.user.id;

    // 参数验证
    if (!modelId || !prompt) {
      return res.status(400).json({
        success: false,
        message: '模型ID和提示词不能为空'
      });
    }

    // 查询模型信息
    const modelResult = await query(
      'SELECT * FROM ai_models WHERE id = $1 AND is_enabled = true',
      [modelId]
    );

    if (modelResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模型不存在或已停用'
      });
    }

    const model = modelResult.rows[0];

    // 检查用户积分
    const userResult = await query(
      'SELECT balance_points FROM users WHERE id = $1',
      [userId]
    );

    const userBalance = userResult.rows[0].balance_points;
    const pointsCost = model.points_cost;

    if (userBalance < pointsCost) {
      return res.status(400).json({
        success: false,
        message: '积分余额不足',
        data: {
          required: pointsCost,
          current: userBalance,
          shortage: pointsCost - userBalance
        }
      });
    }

    // 创建生成任务
    const taskResult = await query(
      `INSERT INTO generation_tasks (
        user_id, model_id, task_type, prompt, negative_prompt, params,
        points_cost, status, progress
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0)
      RETURNING *`,
      [
        userId,
        modelId,
        model.model_type,
        prompt,
        negativePrompt || null,
        JSON.stringify(params || {}),
        pointsCost
      ]
    );

    const task = taskResult.rows[0];

    // 扣除积分
    await query(
      'UPDATE users SET balance_points = balance_points - $1, total_consumed = total_consumed + $1 WHERE id = $2',
      [pointsCost, userId]
    );

    // 记录积分交易
    await query(
      `INSERT INTO points_transactions (
        user_id, type, points, balance_before, balance_after, related_task_id, remark
      )
      VALUES ($1, 'consume', $2, $3, $4, $5, $6)`,
      [
        userId,
        -pointsCost,
        userBalance,
        userBalance - pointsCost,
        task.id,
        `${model.model_name} - ${model.model_type === 'video' ? '视频生成' : '图片生成'}`
      ]
    );

    // 异步调用 AI 生成（不阻塞响应）
    processGeneration(task.id, model, prompt, negativePrompt, params).catch(err => {
      console.error('Generation processing error:', err);
    });

    res.status(201).json({
      success: true,
      message: '任务创建成功',
      data: {
        taskId: task.id,
        status: task.status,
        pointsCost,
        estimatedTime: model.model_type === 'video' ? '3-5分钟' : '30-60秒'
      }
    });

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: '创建任务失败'
    });
  }
}

/**
 * 异步处理 AI 生成
 */
async function processGeneration(taskId, model, prompt, negativePrompt, params) {
  try {
    // 更新任务状态为处理中
    await query(
      'UPDATE generation_tasks SET status = $1, progress = $2, started_at = NOW() WHERE id = $3',
      ['processing', 10, taskId]
    );

    // 解密 API Key
    const apiKey = decryptApiKey(model.api_key_encrypted);

    // 合并默认参数和用户参数
    const mergedParams = {
      ...(model.default_params || {}),
      ...(params || {})
    };

    // 调用 AI API
    let result;
    if (model.custom_script) {
      // 使用自定义脚本
      result = await executeCustomScript(model, apiKey, prompt, negativePrompt, mergedParams);
    } else {
      // 使用标准格式
      result = await callAIAPI(model, apiKey, prompt, negativePrompt, mergedParams);
    }

    // 保存生成结果
    const contentResult = await query(
      `INSERT INTO generated_contents (
        task_id, user_id, content_type, file_url, file_size,
        thumbnail_url, duration, width, height
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        taskId,
        result.userId,
        model.model_type,
        result.fileUrl,
        result.fileSize || 0,
        result.thumbnailUrl || null,
        result.duration || null,
        result.width || null,
        result.height || null
      ]
    );

    // 更新任务为完成
    await query(
      `UPDATE generation_tasks
       SET status = 'completed', progress = 100,
           result_url = $1, completed_at = NOW()
       WHERE id = $2`,
      [result.fileUrl, taskId]
    );

    // 更新模型统计
    await query(
      'UPDATE ai_models SET total_calls = total_calls + 1, success_calls = success_calls + 1 WHERE id = $1',
      [model.id]
    );

  } catch (error) {
    console.error('Processing error:', error);

    // 更新任务为失败
    await query(
      `UPDATE generation_tasks
       SET status = 'failed', error_message = $1, completed_at = NOW()
       WHERE id = $2`,
      [error.message, taskId]
    );

    // 更新模型统计
    await query(
      'UPDATE ai_models SET total_calls = total_calls + 1, failed_calls = failed_calls + 1 WHERE id = $1',
      [model.id]
    );

    // 退还积分
    const taskInfo = await query('SELECT user_id, points_cost FROM generation_tasks WHERE id = $1', [taskId]);
    if (taskInfo.rows.length > 0) {
      const { user_id, points_cost } = taskInfo.rows[0];
      await query(
        'UPDATE users SET balance_points = balance_points + $1 WHERE id = $2',
        [points_cost, user_id]
      );
      await query(
        'UPDATE generation_tasks SET points_refunded = $1 WHERE id = $2',
        [points_cost, taskId]
      );

      // 记录退款
      const userBalance = await query('SELECT balance_points FROM users WHERE id = $1', [user_id]);
      await query(
        `INSERT INTO points_transactions (
          user_id, type, points, balance_before, balance_after, related_task_id, remark
        )
        VALUES ($1, 'refund', $2, $3, $4, $5, '生成失败退款')`,
        [user_id, points_cost, userBalance.rows[0].balance_points - points_cost, userBalance.rows[0].balance_points, taskId]
      );
    }
  }
}

/**
 * 调用标准 AI API
 */
async function callAIAPI(model, apiKey, prompt, negativePrompt, params) {
  // 这里实现标准的 OpenAI 格式调用
  // 实际项目中需要根据不同提供商调整

  const requestData = {
    prompt,
    negative_prompt: negativePrompt,
    ...params
  };

  const response = await axios.post(model.api_base_url, requestData, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 300000 // 5 分钟超时
  });

  // 模拟返回数据（实际需要根据 API 响应解析）
  return {
    userId: response.data.user_id,
    fileUrl: response.data.output_url || response.data.url,
    fileSize: response.data.file_size,
    thumbnailUrl: response.data.thumbnail_url,
    duration: response.data.duration,
    resolution: response.data.resolution,
    metadata: response.data.metadata
  };
}

/**
 * 执行自定义脚本
 */
async function executeCustomScript(model, apiKey, prompt, negativePrompt, params) {
  // 动态执行自定义脚本
  // 安全考虑：生产环境需要沙箱隔离
  const scriptFunction = new Function('model', 'apiKey', 'prompt', 'negativePrompt', 'params', 'axios', model.custom_script);
  return await scriptFunction(model, apiKey, prompt, negativePrompt, params, axios);
}

/**
 * 获取任务状态
 * GET /api/generation/tasks/:id
 */
export async function getTaskStatus(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT t.*, m.model_name, m.model_type, m.provider,
              c.file_url, c.thumbnail_url, c.duration, c.width, c.height
       FROM generation_tasks t
       LEFT JOIN ai_models m ON t.model_id = m.id
       LEFT JOIN generated_contents c ON c.task_id = t.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const task = result.rows[0];

    res.json({
      success: true,
      data: {
        task: {
          id: task.id,
          status: task.status,
          progress: task.progress,
          prompt: task.prompt,
          modelName: task.model_name,
          modelType: task.model_type,
          provider: task.provider,
          pointsCost: task.points_cost,
          pointsRefunded: task.points_refunded,
          resultUrl: task.file_url,
          thumbnailUrl: task.thumbnail_url,
          duration: task.duration,
          width: task.width,
          height: task.height,
          errorMessage: task.error_message,
          createdAt: task.created_at,
          startedAt: task.started_at,
          completedAt: task.completed_at
        }
      }
    });

  } catch (error) {
    console.error('Get task status error:', error);
    res.status(500).json({
      success: false,
      message: '获取任务状态失败'
    });
  }
}

/**
 * 获取用户任务列表
 * GET /api/generation/tasks
 */
export async function getUserTasks(req, res) {
  try {
    const userId = req.user.id;
    const { status, type, limit = 20, offset = 0 } = req.query;

    let sql = `
      SELECT t.*, m.model_name, m.model_type, m.provider,
             c.file_url, c.thumbnail_url
      FROM generation_tasks t
      LEFT JOIN ai_models m ON t.model_id = m.id
      LEFT JOIN generated_contents c ON c.task_id = t.id
      WHERE t.user_id = $1
    `;
    const params = [userId];

    if (status) {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      sql += ` AND t.task_type = $${params.length}`;
    }

    sql += ' ORDER BY t.created_at DESC';

    params.push(parseInt(limit));
    sql += ` LIMIT $${params.length}`;

    params.push(parseInt(offset));
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // 获取总数
    const countResult = await query(
      'SELECT COUNT(*) FROM generation_tasks WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        tasks: result.rows.map(task => ({
          id: task.id,
          status: task.status,
          progress: task.progress,
          prompt: task.prompt.substring(0, 100) + (task.prompt.length > 100 ? '...' : ''),
          modelName: task.model_name,
          modelType: task.model_type,
          pointsCost: task.points_cost,
          thumbnailUrl: task.thumbnail_url,
          createdAt: task.created_at,
          completedAt: task.completed_at
        })),
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get user tasks error:', error);
    res.status(500).json({
      success: false,
      message: '获取任务列表失败'
    });
  }
}

/**
 * 取消任务
 * POST /api/generation/tasks/:id/cancel
 */
export async function cancelTask(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 查询任务
    const taskResult = await query(
      'SELECT * FROM generation_tasks WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const task = taskResult.rows[0];

    // 只能取消 pending 或 processing 状态的任务
    if (!['pending', 'processing'].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: '该任务无法取消'
      });
    }

    // 更新任务状态
    await query(
      'UPDATE generation_tasks SET status = $1, completed_at = NOW() WHERE id = $2',
      ['cancelled', id]
    );

    // 退还积分
    await query(
      'UPDATE users SET balance_points = balance_points + $1 WHERE id = $2',
      [task.points_cost, userId]
    );

    await query(
      'UPDATE generation_tasks SET points_refunded = $1 WHERE id = $2',
      [task.points_cost, id]
    );

    // 记录退款
    const userBalance = await query('SELECT balance_points FROM users WHERE id = $1', [userId]);
    await query(
      `INSERT INTO points_transactions (
        user_id, type, points, balance_before, balance_after, related_task_id, remark
      )
      VALUES ($1, 'refund', $2, $3, $4, $5, '任务取消退款')`,
      [userId, task.points_cost, userBalance.rows[0].balance_points - task.points_cost, userBalance.rows[0].balance_points, id]
    );

    res.json({
      success: true,
      message: '任务已取消，积分已退还'
    });

  } catch (error) {
    console.error('Cancel task error:', error);
    res.status(500).json({
      success: false,
      message: '取消任务失败'
    });
  }
}
