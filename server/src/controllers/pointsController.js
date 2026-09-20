import { query } from '../config/database.js';

/**
 * 获取用户积分余额
 * GET /api/points/balance
 */
export async function getBalance(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT balance_points, total_recharged, total_consumed FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        balance: user.balance_points,
        totalRecharged: user.total_recharged,
        totalConsumed: user.total_consumed
      }
    });

  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: '获取积分余额失败'
    });
  }
}

/**
 * 获取积分交易记录
 * GET /api/points/transactions
 */
export async function getTransactions(req, res) {
  try {
    const userId = req.user.id;
    const { type, limit = 20, offset = 0 } = req.query;

    let sql = 'SELECT * FROM points_transactions WHERE user_id = $1';
    const params = [userId];

    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    params.push(parseInt(limit));
    sql += ` LIMIT $${params.length}`;

    params.push(parseInt(offset));
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // 获取总数
    const countResult = await query(
      'SELECT COUNT(*) FROM points_transactions WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        transactions: result.rows.map(tx => ({
          id: tx.id,
          type: tx.type,
          points: tx.points,
          balanceBefore: tx.balance_before,
          balanceAfter: tx.balance_after,
          remark: tx.remark,
          createdAt: tx.created_at
        })),
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: '获取交易记录失败'
    });
  }
}

/**
 * 手动充值积分（管理员）
 * POST /api/points/recharge
 */
export async function manualRecharge(req, res) {
  try {
    const { userId, amount, note } = req.body;
    const adminId = req.user.id;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '用户ID和充值金额必填，金额必须大于0'
      });
    }

    // 查询用户
    const userResult = await query(
      'SELECT balance_points FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const currentBalance = userResult.rows[0].balance_points;
    const newBalance = currentBalance + amount;

    // 生成订单号
    const orderNo = `RCH${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    // 更新用户积分
    await query(
      'UPDATE users SET balance_points = $1, total_recharged = total_recharged + $2 WHERE id = $3',
      [newBalance, amount, userId]
    );

    // 创建充值订单
    const orderResult = await query(
      `INSERT INTO recharge_orders (
        user_id, order_no, amount, receive_points, payment_method, status
      )
      VALUES ($1, $2, $3, $4, 'manual', 'completed')
      RETURNING id`,
      [userId, orderNo, amount, amount]
    );

    const orderId = orderResult.rows[0].id;

    // 记录积分交易
    await query(
      `INSERT INTO points_transactions (
        user_id, type, points, balance_before, balance_after, remark
      )
      VALUES ($1, 'recharge', $2, $3, $4, $5)`,
      [userId, amount, currentBalance, newBalance, note || '手动充值']
    );

    // 记录管理员日志
    await query(
      `INSERT INTO admin_logs (
        admin_user_id, operation_type, target_type, target_id, operation_content
      )
      VALUES ($1, 'recharge', 'user', $2, $3)`,
      [adminId, userId, JSON.stringify({ amount, note, orderId, orderNo })]
    );

    res.json({
      success: true,
      message: '充值成功',
      data: {
        orderId,
        userId,
        amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance
      }
    });

  } catch (error) {
    console.error('Manual recharge error:', error);
    res.status(500).json({
      success: false,
      message: '充值失败'
    });
  }
}

/**
 * 获取充值订单列表
 * GET /api/points/orders
 */
export async function getRechargeOrders(req, res) {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    let sql = 'SELECT * FROM recharge_orders WHERE user_id = $1';
    const params = [userId];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    params.push(parseInt(limit));
    sql += ` LIMIT $${params.length}`;

    params.push(parseInt(offset));
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // 获取总数
    const countResult = await query(
      'SELECT COUNT(*) FROM recharge_orders WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        orders: result.rows.map(order => ({
          id: order.id,
          orderNo: order.order_no,
          amount: order.amount,
          receivePoints: order.receive_points,
          paymentMethod: order.payment_method,
          status: order.status,
          createdAt: order.created_at,
          paidAt: order.paid_at
        })),
        total: parseInt(countResult.rows[0].count),
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
 * 获取积分统计
 * GET /api/points/stats
 */
export async function getPointsStats(req, res) {
  try {
    const userId = req.user.id;

    // 获取用户积分信息
    const userResult = await query(
      'SELECT balance_points, total_recharged, total_consumed FROM users WHERE id = $1',
      [userId]
    );

    // 获取本月消费
    const monthlyResult = await query(
      `SELECT COALESCE(SUM(ABS(points)), 0) as monthly_consumed
       FROM points_transactions
       WHERE user_id = $1 AND type = 'consume'
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [userId]
    );

    // 获取任务统计
    const taskStatsResult = await query(
      `SELECT
         COUNT(*) as total_tasks,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
         COUNT(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 END) as active_tasks
       FROM generation_tasks
       WHERE user_id = $1`,
      [userId]
    );

    const user = userResult.rows[0];
    const taskStats = taskStatsResult.rows[0];

    res.json({
      success: true,
      data: {
        balance: user.balance_points,
        totalRecharged: user.total_recharged,
        totalConsumed: user.total_consumed,
        monthlyConsumed: parseInt(monthlyResult.rows[0].monthly_consumed),
        tasks: {
          total: parseInt(taskStats.total_tasks),
          completed: parseInt(taskStats.completed_tasks),
          failed: parseInt(taskStats.failed_tasks),
          active: parseInt(taskStats.active_tasks)
        }
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
