import { query } from '../config/database.js';
import { encryptApiKey, decryptApiKey } from '../utils/crypto.js';

/**
 * 获取所有 AI 模型列表
 * GET /api/models
 * 查询参数: type (video/image), status (active/inactive)
 */
export async function getModels(req, res) {
  try {
    const { type, enabled } = req.query;

    let sql = 'SELECT * FROM ai_models WHERE 1=1';
    const params = [];

    if (type) {
      params.push(type);
      sql += ` AND model_type = $${params.length}`;
    }

    if (enabled !== undefined) {
      params.push(enabled === 'true');
      sql += ` AND is_enabled = $${params.length}`;
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const result = await query(sql, params);

    // 解密 API Key（仅显示部分）
    const models = result.rows.map(model => ({
      ...model,
      apiKey: model.api_key_encrypted ? '***' + model.api_key_encrypted.slice(-4) : null,
      apiKeyEncrypted: undefined
    }));

    res.json({
      success: true,
      data: {
        models,
        total: models.length
      }
    });

  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      message: '获取模型列表失败'
    });
  }
}

/**
 * 获取单个模型详情
 * GET /api/models/:id
 */
export async function getModelById(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM ai_models WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模型不存在'
      });
    }

    const model = result.rows[0];

    // 管理员可以看到完整 API Key，普通用户看脱敏版
    if (req.user.role === 'admin' && model.api_key_encrypted) {
      model.apiKey = decryptApiKey(model.api_key_encrypted);
    } else {
      model.apiKey = model.api_key_encrypted ? '***' + model.api_key_encrypted.slice(-4) : null;
    }

    delete model.api_key_encrypted;

    res.json({
      success: true,
      data: { model }
    });

  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({
      success: false,
      message: '获取模型详情失败'
    });
  }
}

/**
 * 创建 AI 模型配置
 * POST /api/models
 * 仅管理员
 */
export async function createModel(req, res) {
  try {
    const {
      modelType,
      modelName,
      modelKey,
      provider,
      apiBaseUrl,
      apiKey,
      apiFormat,
      defaultParams,
      description,
      pointsCost,
      billingType,
      isEnabled,
      sortOrder
    } = req.body;

    // 参数验证
    if (!modelType || !modelName || !modelKey || !provider || !apiBaseUrl || !apiKey) {
      return res.status(400).json({
        success: false,
        message: '模型类型、名称、唯一标识、提供商、API地址和API密钥为必填项'
      });
    }

    if (!['video', 'image'].includes(modelType)) {
      return res.status(400).json({
        success: false,
        message: '模型类型必须是 video 或 image'
      });
    }

    if (billingType && !['per_request', 'per_second'].includes(billingType)) {
      return res.status(400).json({
        success: false,
        message: '计费类型必须是 per_request(按次) 或 per_second(按秒)'
      });
    }

    // 加密 API Key
    const encryptedApiKey = encryptApiKey(apiKey);

    const result = await query(
      `INSERT INTO ai_models (
        model_type, model_name, model_key, provider, description,
        api_base_url, api_key_encrypted, api_format,
        points_cost, billing_type, default_params, is_enabled, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        modelType,
        modelName,
        modelKey,
        provider,
        description || '',
        apiBaseUrl,
        encryptedApiKey,
        apiFormat || 'openai',
        pointsCost || 10,
        billingType || 'per_request',
        JSON.stringify(defaultParams || {}),
        isEnabled !== undefined ? isEnabled : true,
        sortOrder || 0
      ]
    );

    const model = result.rows[0];
    model.apiKey = '***' + apiKey.slice(-4);
    delete model.api_key_encrypted;

    res.status(201).json({
      success: true,
      message: '模型创建成功',
      data: { model }
    });

  } catch (error) {
    console.error('Create model error:', error);
    res.status(500).json({
      success: false,
      message: '创建模型失败'
    });
  }
}

/**
 * 更新 AI 模型配置
 * PUT /api/models/:id
 * 仅管理员
 */
export async function updateModel(req, res) {
  try {
    const { id } = req.params;
    const {
      modelName,
      description,
      apiBaseUrl,
      apiKey,
      apiFormat,
      defaultParams,
      pointsCost,
      billingType,
      isEnabled,
      sortOrder
    } = req.body;

    // 检查模型是否存在
    const checkResult = await query(
      'SELECT id FROM ai_models WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模型不存在'
      });
    }

    // 验证计费类型
    if (billingType && !['per_request', 'per_second'].includes(billingType)) {
      return res.status(400).json({
        success: false,
        message: '计费类型必须是 per_request(按次) 或 per_second(按秒)'
      });
    }

    // 构建更新语句
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (modelName !== undefined) {
      params.push(modelName);
      updates.push(`model_name = $${paramIndex++}`);
    }

    if (description !== undefined) {
      params.push(description);
      updates.push(`description = $${paramIndex++}`);
    }

    if (apiBaseUrl !== undefined) {
      params.push(apiBaseUrl);
      updates.push(`api_base_url = $${paramIndex++}`);
    }

    if (apiKey !== undefined) {
      const encryptedApiKey = encryptApiKey(apiKey);
      params.push(encryptedApiKey);
      updates.push(`api_key_encrypted = $${paramIndex++}`);
    }

    if (apiFormat !== undefined) {
      params.push(apiFormat);
      updates.push(`api_format = $${paramIndex++}`);
    }

    if (defaultParams !== undefined) {
      params.push(JSON.stringify(defaultParams));
      updates.push(`default_params = $${paramIndex++}`);
    }

    if (pointsCost !== undefined) {
      params.push(pointsCost);
      updates.push(`points_cost = $${paramIndex++}`);
    }

    if (billingType !== undefined) {
      params.push(billingType);
      updates.push(`billing_type = $${paramIndex++}`);
    }

    if (isEnabled !== undefined) {
      params.push(isEnabled);
      updates.push(`is_enabled = $${paramIndex++}`);
    }

    if (sortOrder !== undefined) {
      params.push(sortOrder);
      updates.push(`sort_order = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有可更新的字段'
      });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE ai_models
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(sql, params);
    const model = result.rows[0];

    model.apiKey = model.api_key_encrypted ? '***' + model.api_key_encrypted.slice(-4) : null;
    delete model.api_key_encrypted;

    res.json({
      success: true,
      message: '模型更新成功',
      data: { model }
    });

  } catch (error) {
    console.error('Update model error:', error);
    res.status(500).json({
      success: false,
      message: '更新模型失败'
    });
  }
}

/**
 * 删除 AI 模型（软删除：停用）
 * DELETE /api/models/:id
 * 仅管理员
 */
export async function deleteModel(req, res) {
  try {
    const { id } = req.params;

    // 检查模型是否存在
    const checkResult = await query(
      'SELECT id, model_name FROM ai_models WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模型不存在'
      });
    }

    // 软删除：更新状态为 disabled
    await query(
      `UPDATE ai_models SET is_enabled = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: '模型已停用'
    });

  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({
      success: false,
      message: '停用模型失败'
    });
  }
}

/**
 * 永久删除 AI 模型（硬删除）
 * DELETE /api/models/:id/permanent
 * 仅管理员
 */
export async function permanentDeleteModel(req, res) {
  try {
    const { id } = req.params;

    // 检查模型是否存在并获取类型
    const checkResult = await query(
      'SELECT id, model_name, model_type FROM ai_models WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模型不存在'
      });
    }

    const modelToDelete = checkResult.rows[0];

    // 检查该类型的模型总数（包括启用和停用）
    const countResult = await query(
      'SELECT COUNT(*) as count FROM ai_models WHERE model_type = $1',
      [modelToDelete.model_type]
    );

    const count = parseInt(countResult.rows[0].count);

    // 如果该类型只剩一个模型，不允许删除
    if (count <= 1) {
      return res.status(400).json({
        success: false,
        message: `无法删除：${modelToDelete.model_type === 'video' ? '视频' : '图片'}模型至少需要保留一个`
      });
    }

    // 检查是否有进行中的任务（pending, processing）
    const taskResult = await query(
      `SELECT COUNT(*) as count FROM generation_tasks
       WHERE model_id = $1 AND status IN ('pending', 'processing')`,
      [id]
    );

    const taskCount = parseInt(taskResult.rows[0].count);

    if (taskCount > 0) {
      return res.status(400).json({
        success: false,
        message: `无法删除：该模型有 ${taskCount} 个任务正在进行中，请等待任务完成或取消后再删除`
      });
    }

    // 永久删除（级联删除相关记录）
    // 1. 先删除积分交易记录
    await query(
      `DELETE FROM points_transactions
       WHERE related_task_id IN (SELECT id FROM generation_tasks WHERE model_id = $1)`,
      [id]
    );

    // 2. 再删除任务记录
    await query(
      'DELETE FROM generation_tasks WHERE model_id = $1',
      [id]
    );

    // 3. 最后删除模型
    await query(
      'DELETE FROM ai_models WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: '模型已永久删除'
    });

  } catch (error) {
    console.error('Permanent delete model error:', error);
    res.status(500).json({
      success: false,
      message: '删除模型失败'
    });
  }
}

/**
 * 测试模型连接
 * POST /api/models/:id/test
 * 仅管理员
 */
export async function testModel(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM ai_models WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模型不存在'
      });
    }

    const model = result.rows[0];

    // 解密 API Key
    const apiKey = model.api_key_encrypted ? decryptApiKey(model.api_key_encrypted) : null;

    if (!apiKey) {
      return res.json({
        success: false,
        message: 'API Key 未配置',
        modelName: model.model_name
      });
    }

    // 测试 API 连接
    try {
      const testUrl = `${model.api_base_url}/models`;

      const testResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10秒超时
      });

      if (testResponse.ok) {
        res.json({
          success: true,
          message: 'API 连接成功',
          modelName: model.model_name,
          data: {
            modelName: model.model_name,
            provider: model.provider,
            apiBaseUrl: model.api_base_url,
            isEnabled: model.is_enabled
          }
        });
      } else {
        const errorText = await testResponse.text().catch(() => '');
        res.json({
          success: false,
          message: `API 返回错误: ${testResponse.status} ${testResponse.statusText}`,
          modelName: model.model_name,
          details: errorText
        });
      }
    } catch (fetchError) {
      res.json({
        success: false,
        message: `连接失败: ${fetchError.message}`,
        modelName: model.model_name
      });
    }

  } catch (error) {
    console.error('Test model error:', error);
    res.status(500).json({
      success: false,
      message: '测试模型连接失败'
    });
  }
}

/**
 * 获取模型渠道列表（用于前端渠道系统）
 * GET /api/models/channels
 * 将模型按 provider 分组，转换为前端 Channel 格式
 */
export async function getModelChannels(req, res) {
  try {
    // 只返回启用的模型
    const result = await query(
      `SELECT * FROM ai_models
       WHERE is_enabled = true
       ORDER BY provider, sort_order ASC, created_at DESC`
    );

    // 按 provider 分组
    const providerMap = new Map();

    for (const model of result.rows) {
      const provider = model.provider;

      if (!providerMap.has(provider)) {
        // 解密第一个模型的API Key（用于渠道认证）
        const apiKey = model.api_key_encrypted ? decryptApiKey(model.api_key_encrypted) : '';

        providerMap.set(provider, {
          id: `provider_${provider.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: provider,
          baseUrl: 'http://localhost:3001/api', // 指向我们自己的后端
          apiKey: apiKey,
          apiFormat: 'openai', // 使用 OpenAI 格式
          models: [],
          source: 'backend' // 标记来源
        });
      }

      // 映射模型类型到前端capability
      const capabilityMap = {
        'video': 'video',
        'image': 'image',
        'text': 'text',
        'audio': 'audio'
      };

      const capability = capabilityMap[model.model_type] || 'text';

      // 添加模型到渠道
      providerMap.get(provider).models.push({
        name: model.model_key, // 使用 model_key 作为唯一标识
        capability: capability,
        displayName: model.model_name, // 添加显示名称
        description: model.description, // 添加模型说明
        pointsCost: model.points_cost, // 添加积分消耗
        billingType: model.billing_type // 添加计费类型
      });
    }

    // 转换为数组
    const channels = Array.from(providerMap.values());

    res.json({
      success: true,
      data: {
        channels,
        total: channels.length
      }
    });

  } catch (error) {
    console.error('Get model channels error:', error);
    res.status(500).json({
      success: false,
      message: '获取模型渠道失败'
    });
  }
}
