import { query } from '../config/database.js';

/**
 * ============================================
 * 用户管理
 * ============================================
 */

/**
 * 获取用户列表
 * GET /api/admin/users
 */
export async function getUserList(req, res) {
  try {
    const {
      status,
      role,
      keyword,
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    let sql = `
      SELECT id, email, username, display_name, avatar_url, role, status,
             balance_points, total_recharged, total_consumed,
             created_at, last_login_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params = [];

    // 状态筛选
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    // 角色筛选
    if (role) {
      params.push(role);
      sql += ` AND role = $${params.length}`;
    }

    // 关键词搜索
    if (keyword) {
      params.push(`%${keyword}%`);
      sql += ` AND (email ILIKE $${params.length} OR username ILIKE $${params.length} OR display_name ILIKE $${params.length})`;
    }

    // 排序
    const validSortFields = ['created_at', 'last_login_at', 'balance_points', 'total_consumed', 'username'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortField} ${order}`;

    // 分页
    params.push(parseInt(limit));
    sql += ` LIMIT $${params.length}`;
    params.push(parseInt(offset));
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams = [];

    if (status) {
      countParams.push(status);
      countSql += ` AND status = $${countParams.length}`;
    }
    if (role) {
      countParams.push(role);
      countSql += ` AND role = $${countParams.length}`;
    }
    if (keyword) {
      countParams.push(`%${keyword}%`);
      countSql += ` AND (email ILIKE $${countParams.length} OR username ILIKE $${countParams.length} OR display_name ILIKE $${countParams.length})`;
    }

    const countResult = await query(countSql, countParams);

    res.json({
      success: true,
      data: {
        users: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get user list error:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
}

/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
export async function getUserDetail(req, res) {
  try {
    const { id } = req.params;

    const userResult = await query(
      `SELECT id, email, username, display_name, avatar_url, role, status,
              balance_points, total_recharged, total_consumed,
              created_at, last_login_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = userResult.rows[0];

    // 获取任务统计
    const taskStats = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
         COUNT(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 END) as active
       FROM generation_tasks WHERE user_id = $1`,
      [id]
    );

    // 获取最近充值记录
    const recentRecharges = await query(
      `SELECT id, order_no, amount, receive_points, payment_method, status, created_at
       FROM recharge_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [id]
    );

    // 获取最近消费记录
    const recentTransactions = await query(
      `SELECT id, type, points, balance_before, balance_after, remark, created_at
       FROM points_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      data: {
        user,
        stats: {
          tasks: taskStats.rows[0]
        },
        recentRecharges: recentRecharges.rows,
        recentTransactions: recentTransactions.rows
      }
    });

  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({
      success: false,
      message: '获取用户详情失败'
    });
  }
}

/**
 * 更新用户状态
 * PUT /api/admin/users/:id/status
 */
export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user.id;

    if (!['active', 'inactive', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    await query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );

    // 记录管理员操作日志
    await query(
      `INSERT INTO admin_logs (admin_user_id, operation_type, target_type, target_id, operation_content)
       VALUES ($1, 'update_status', 'user', $2, $3)`,
      [adminId, id, JSON.stringify({ status, reason })]
    );

    res.json({
      success: true,
      message: '用户状态更新成功'
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: '更新用户状态失败'
    });
  }
}

/**
 * 删除用户
 * DELETE /api/admin/users/:id
 */
/**
 * 检查用户是否有消费记录
 * GET /api/admin/users/:id/check-records
 */
export async function checkUserRecords(req, res) {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const userCheck = await query('SELECT username FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查积分交易记录（消费类型）
    const consumeRecords = await query(
      `SELECT COUNT(*) as count FROM points_transactions
       WHERE user_id = $1 AND type = 'consume'`,
      [id]
    );

    // 检查充值订单记录
    const rechargeRecords = await query(
      `SELECT COUNT(*) as count FROM recharge_orders WHERE user_id = $1`,
      [id]
    );

    // 检查生成任务记录
    const taskRecords = await query(
      `SELECT COUNT(*) as count FROM generation_tasks WHERE user_id = $1`,
      [id]
    );

    const hasRecords =
      parseInt(consumeRecords.rows[0].count) > 0 ||
      parseInt(rechargeRecords.rows[0].count) > 0 ||
      parseInt(taskRecords.rows[0].count) > 0;

    res.json({
      success: true,
      data: {
        hasRecords,
        consumeCount: parseInt(consumeRecords.rows[0].count),
        rechargeCount: parseInt(rechargeRecords.rows[0].count),
        taskCount: parseInt(taskRecords.rows[0].count),
      }
    });
  } catch (error) {
    console.error('检查用户记录失败:', error);
    res.status(500).json({
      success: false,
      message: '检查用户记录失败'
    });
  }
}

/**
 * 删除用户（支持级联删除）
 * DELETE /api/admin/users/:id?cascade=true&force=true
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const { cascade, force } = req.query; // cascade: 是否级联删除, force: 是否强制删除
    const adminId = req.user.id;

    // 检查用户是否存在
    const userCheck = await query('SELECT username FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查是否有消费记录（积分交易、充值订单、生成任务）
    if (force !== 'true') {
      const transactionCount = await query(
        'SELECT COUNT(*) FROM points_transactions WHERE user_id = $1',
        [id]
      );

      const orderCount = await query(
        'SELECT COUNT(*) FROM recharge_orders WHERE user_id = $1',
        [id]
      );

      let taskCount = { rows: [{ count: 0 }] };
      try {
        taskCount = await query(
          'SELECT COUNT(*) FROM generation_tasks WHERE user_id = $1',
          [id]
        );
      } catch (err) {
        console.log('generation_tasks表可能不存在，跳过');
      }

      const totalRecords =
        parseInt(transactionCount.rows[0].count) +
        parseInt(orderCount.rows[0].count) +
        parseInt(taskCount.rows[0].count);

      // 如果有消费记录，要求确认
      if (totalRecords > 0) {
        return res.status(200).json({
          success: false,
          needConfirm: true,
          message: `该用户存在 ${totalRecords} 条消费记录`,
          data: {
            username: userCheck.rows[0].username,
            transactionCount: parseInt(transactionCount.rows[0].count),
            orderCount: parseInt(orderCount.rows[0].count),
            taskCount: parseInt(taskCount.rows[0].count),
            totalRecords
          }
        });
      }
    }

    // 级联删除相关记录（无论是否有force/cascade参数，都需要先删除关联记录）
    console.log('开始删除用户关联记录，用户ID:', id);

    // 删除user_points记录
    try {
      const result1 = await query('DELETE FROM user_points WHERE user_id = $1', [id]);
      console.log('删除user_points记录:', result1.rowCount);
    } catch (err) {
      console.log('user_points删除失败:', err.message);
    }

    // 删除积分交易记录
    try {
      const result2 = await query('DELETE FROM points_transactions WHERE user_id = $1', [id]);
      console.log('删除points_transactions记录:', result2.rowCount);
    } catch (err) {
      console.log('points_transactions删除失败:', err.message);
    }

    // 删除充值订单记录
    try {
      const result3 = await query('DELETE FROM recharge_orders WHERE user_id = $1', [id]);
      console.log('删除recharge_orders记录:', result3.rowCount);
    } catch (err) {
      console.log('recharge_orders删除失败:', err.message);
    }

    // 删除生成任务记录
    try {
      const result4 = await query('DELETE FROM generation_tasks WHERE user_id = $1', [id]);
      console.log('删除generation_tasks记录:', result4.rowCount);
    } catch (err) {
      console.log('generation_tasks删除失败:', err.message);
    }

    // 物理删除用户（最后执行）
    const deleteResult = await query('DELETE FROM users WHERE id = $1', [id]);
    console.log('删除用户记录:', deleteResult.rowCount);

    if (deleteResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: '用户删除失败，可能已被删除或存在约束冲突'
      });
    }

    // 记录日志
    await query(
      `INSERT INTO admin_logs (admin_user_id, operation_type, target_type, target_id, operation_content)
       VALUES ($1, 'delete', 'user', $2, $3)`,
      [adminId, id, JSON.stringify({
        username: userCheck.rows[0].username,
        cascade: cascade === 'true' || force === 'true',
        force: force === 'true'
      })]
    );

    res.json({
      success: true,
      message: (cascade === 'true' || force === 'true') ? '用户及所有记录已彻底删除' : '用户删除成功'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: '删除用户失败: ' + error.message
    });
  }
}

/**
 * ============================================
 * 积分管理
 * ============================================
 */

/**
 * 获取积分流水列表
 * GET /api/admin/points/transactions
 */
export async function getPointsTransactions(req, res) {
  try {
    const {
      userId,
      type,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT pt.*, u.username, u.email, u.display_name
      FROM points_transactions pt
      LEFT JOIN users u ON pt.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      sql += ` AND pt.user_id = $${params.length}`;
    }

    if (type) {
      params.push(type);
      sql += ` AND pt.type = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      sql += ` AND pt.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      sql += ` AND pt.created_at <= $${params.length}`;
    }

    sql += ' ORDER BY pt.created_at DESC';

    params.push(parseInt(limit));
    sql += ` LIMIT $${params.length}`;
    params.push(parseInt(offset));
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // 获取总数和统计
    let countSql = 'SELECT COUNT(*) as total, SUM(CASE WHEN type = \'recharge\' THEN points ELSE 0 END) as total_recharge, SUM(CASE WHEN type = \'consume\' THEN ABS(points) ELSE 0 END) as total_consume FROM points_transactions WHERE 1=1';
    const countParams = [];

    if (userId) {
      countParams.push(userId);
      countSql += ` AND user_id = $${countParams.length}`;
    }
    if (type) {
      countParams.push(type);
      countSql += ` AND type = $${countParams.length}`;
    }
    if (startDate) {
      countParams.push(startDate);
      countSql += ` AND created_at >= $${countParams.length}`;
    }
    if (endDate) {
      countParams.push(endDate);
      countSql += ` AND created_at <= $${countParams.length}`;
    }

    const statsResult = await query(countSql, countParams);

    res.json({
      success: true,
      data: {
        transactions: result.rows,
        total: parseInt(statsResult.rows[0].total),
        stats: {
          totalRecharge: parseInt(statsResult.rows[0].total_recharge || 0),
          totalConsume: parseInt(statsResult.rows[0].total_consume || 0)
        },
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get points transactions error:', error);
    res.status(500).json({
      success: false,
      message: '获取积分流水失败'
    });
  }
}

/**
 * 获取充值订单列表
 * GET /api/admin/points/recharge-orders
 */
export async function getRechargeOrders(req, res) {
  try {
    const {
      userId,
      status,
      paymentMethod,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT ro.*, u.username, u.email, u.display_name
      FROM recharge_orders ro
      LEFT JOIN users u ON ro.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      sql += ` AND ro.user_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND ro.status = $${params.length}`;
    }

    if (paymentMethod) {
      params.push(paymentMethod);
      sql += ` AND ro.payment_method = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      sql += ` AND ro.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      sql += ` AND ro.created_at <= $${params.length}`;
    }

    sql += ' ORDER BY ro.created_at DESC';

    params.push(parseInt(limit));
    sql += ` LIMIT $${params.length}`;
    params.push(parseInt(offset));
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // 获取总数和统计
    let statsSql = 'SELECT COUNT(*) as total, SUM(amount) as total_amount, SUM(receive_points) as total_points FROM recharge_orders WHERE 1=1';
    const statsParams = [];

    if (userId) {
      statsParams.push(userId);
      statsSql += ` AND user_id = $${statsParams.length}`;
    }
    if (status) {
      statsParams.push(status);
      statsSql += ` AND status = $${statsParams.length}`;
    }
    if (paymentMethod) {
      statsParams.push(paymentMethod);
      statsSql += ` AND payment_method = $${statsParams.length}`;
    }
    if (startDate) {
      statsParams.push(startDate);
      statsSql += ` AND created_at >= $${statsParams.length}`;
    }
    if (endDate) {
      statsParams.push(endDate);
      statsSql += ` AND created_at <= $${statsParams.length}`;
    }

    const statsResult = await query(statsSql, statsParams);

    res.json({
      success: true,
      data: {
        orders: result.rows,
        total: parseInt(statsResult.rows[0].total),
        stats: {
          totalAmount: parseFloat(statsResult.rows[0].total_amount || 0),
          totalPoints: parseInt(statsResult.rows[0].total_points || 0)
        },
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get recharge orders error:', error);
    res.status(500).json({
      success: false,
      message: '获取充值订单失败'
    });
  }
}

/**
 * 获取积分统计数据
 * GET /api/admin/points/stats
 */
export async function getPointsStats(req, res) {
  try {
    const { startDate, endDate } = req.query;

    // 总体统计
    const overallStats = await query(`
      SELECT
        SUM(balance_points) as total_balance,
        SUM(total_recharged) as total_recharged,
        SUM(total_consumed) as total_consumed,
        COUNT(*) as total_users
      FROM users WHERE status != 'deleted'
    `);

    // 今日统计
    const todayStats = await query(`
      SELECT
        COUNT(CASE WHEN type = 'recharge' THEN 1 END) as recharge_count,
        COALESCE(SUM(CASE WHEN type = 'recharge' THEN points ELSE 0 END), 0) as recharge_amount,
        COUNT(CASE WHEN type = 'consume' THEN 1 END) as consume_count,
        COALESCE(SUM(CASE WHEN type = 'consume' THEN ABS(points) ELSE 0 END), 0) as consume_amount
      FROM points_transactions
      WHERE created_at >= CURRENT_DATE
    `);

    // 近7天趋势
    const trendStats = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(CASE WHEN type = 'recharge' THEN 1 END) as recharge_count,
        COALESCE(SUM(CASE WHEN type = 'recharge' THEN points ELSE 0 END), 0) as recharge_amount,
        COUNT(CASE WHEN type = 'consume' THEN 1 END) as consume_count,
        COALESCE(SUM(CASE WHEN type = 'consume' THEN ABS(points) ELSE 0 END), 0) as consume_amount
      FROM points_transactions
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        overall: overallStats.rows[0],
        today: todayStats.rows[0],
        trend: trendStats.rows
      }
    });

  } catch (error) {
    console.error('Get points stats error:', error);
    res.status(500).json({
      success: false,
      message: '获取积分统计失败'
    });
  }
}

/**
 * 获取系统概览统计
 * GET /api/admin/dashboard/stats
 */
export async function getDashboardStats(req, res) {
  try {
    // 用户统计
    const userStats = await query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_users_today,
        COUNT(CASE WHEN last_login_at >= CURRENT_DATE THEN 1 END) as active_today
      FROM users WHERE status != 'deleted'
    `);

    // 任务统计
    const taskStats = await query(`
      SELECT
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as tasks_today
      FROM generation_tasks
    `);

    // 积分统计
    const pointsStats = await query(`
      SELECT
        COALESCE(SUM(balance_points), 0) as total_balance,
        COALESCE(SUM(total_recharged), 0) as total_recharged,
        COALESCE(SUM(total_consumed), 0) as total_consumed
      FROM users WHERE status != 'deleted'
    `);

    // 今日积分流水
    const todayPoints = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'recharge' THEN points ELSE 0 END), 0) as recharged_today,
        COALESCE(SUM(CASE WHEN type = 'consume' THEN ABS(points) ELSE 0 END), 0) as consumed_today
      FROM points_transactions
      WHERE created_at >= CURRENT_DATE
    `);

    res.json({
      success: true,
      data: {
        users: userStats.rows[0],
        tasks: taskStats.rows[0],
        points: {
          ...pointsStats.rows[0],
          ...todayPoints.rows[0]
        }
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
}
