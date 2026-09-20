import { query } from '../config/database.js';

/**
 * 获取积分套餐列表
 * GET /api/recharge/packages
 */
export async function getRechargePackages(req, res) {
  try {
    // 用户信息可选（如果已登录则获取）
    let userInfo = null;
    if (req.user && req.user.id) {
      const userResult = await query(
        `SELECT id, username, email, balance_points
         FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (userResult.rows.length > 0) {
        userInfo = {
          id: userResult.rows[0].id,
          username: userResult.rows[0].username,
          email: userResult.rows[0].email,
          balancePoints: userResult.rows[0].balance_points
        };
      }
    }

    // 获取套餐分组和套餐列表
    const packagesResult = await query(`
      SELECT
        g.group_id,
        g.group_type,
        g.group_name,
        g.group_name_en,
        g.group_description,
        g.group_description_en,
        g.sort_order as group_sort_order,
        p.id,
        p.package_type,
        p.package_name,
        p.package_name_en,
        p.price,
        p.original_price,
        p.points_calc_mode,
        p.gift_percent,
        p.manual_base_points,
        p.manual_gift_points,
        p.valid_type,
        p.valid_days,
        p.valid_end_date,
        p.description,
        p.description_en,
        p.is_hot,
        p.sort_order
      FROM recharge_package_groups g
      LEFT JOIN recharge_packages p ON g.group_id = p.group_id AND p.is_enabled = TRUE
      WHERE g.is_enabled = TRUE
      ORDER BY g.sort_order, p.sort_order
    `);

    // 组织数据结构
    const groupsMap = new Map();

    packagesResult.rows.forEach(row => {
      if (!groupsMap.has(row.group_id)) {
        groupsMap.set(row.group_id, {
          groupId: row.group_id,
          groupType: row.group_type,
          groupName: row.group_name,
          groupNameEn: row.group_name_en,
          groupDesc: row.group_description,
          groupDescEn: row.group_description_en,
          sortOrder: row.group_sort_order,
          packages: []
        });
      }

      if (row.id) {
        // 计算积分（根据模式）
        let basePoints, giftPoints, totalPoints;

        if (row.points_calc_mode === 'manual' && row.manual_base_points) {
          // 手动模式
          basePoints = row.manual_base_points;
          giftPoints = row.manual_gift_points || 0;
          totalPoints = basePoints + giftPoints;
        } else {
          // 自动模式：需要获取兑换比例
          // 这里暂时使用默认比例10，实际应该从system_settings读取
          const exchangeRate = 10; // TODO: 从数据库读取
          basePoints = Math.floor(parseFloat(row.price) * exchangeRate);
          giftPoints = Math.floor(basePoints * (row.gift_percent || 0) / 100);
          totalPoints = basePoints + giftPoints;
        }

        groupsMap.get(row.group_id).packages.push({
          id: row.id,
          packageType: row.package_type,
          packageName: row.package_name,
          packageNameEn: row.package_name_en,
          price: parseFloat(row.price),
          originalPrice: row.original_price ? parseFloat(row.original_price) : null,
          basePoints: basePoints,
          giftPoints: giftPoints,
          totalPoints: totalPoints,
          giftPercent: row.gift_percent || 0,
          validType: row.valid_type,
          validDays: row.valid_days,
          validEndDate: row.valid_end_date,
          desc: row.description,
          descEn: row.description_en,
          isHot: row.is_hot,
          sortOrder: row.sort_order
        });
      }
    });

    const packageGroups = Array.from(groupsMap.values());

    res.json({
      success: true,
      data: {
        userInfo,
        packageGroups
      }
    });

  } catch (error) {
    console.error('Get recharge packages error:', error);
    res.status(500).json({
      success: false,
      message: '获取套餐列表失败'
    });
  }
}

/**
 * 创建充值订单
 * POST /api/points/create-order
 */
export async function createRechargeOrder(req, res) {
  try {
    const userId = req.user.id;
    const { packageId } = req.body;

    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: '套餐ID不能为空'
      });
    }

    // 获取套餐信息
    const packageResult = await query(
      `SELECT * FROM recharge_packages WHERE id = $1 AND is_enabled = TRUE`,
      [packageId]
    );

    if (packageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '套餐不存在或已下架'
      });
    }

    const pkg = packageResult.rows[0];

    // 生成订单号
    const orderNo = `RCH${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    // 计算有效期
    let validEndDate = null;
    if (pkg.valid_type === 'timeLimit') {
      if (pkg.valid_days) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + pkg.valid_days);
        validEndDate = endDate.toISOString().split('T')[0];
      } else if (pkg.valid_end_date) {
        validEndDate = pkg.valid_end_date;
      }
    }

    // 创建订单（待支付状态）
    const orderResult = await query(
      `INSERT INTO recharge_orders (
        user_id, order_number, package_id, package_name, total_amount, receive_points,
        payment_method, status, valid_days, valid_end_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending', $7, $8)
      RETURNING id, order_number`,
      [userId, orderNo, pkg.id, pkg.package_name, pkg.price, pkg.total_points, pkg.valid_days, validEndDate]
    );

    const order = orderResult.rows[0];

    res.json({
      success: true,
      data: {
        orderId: order.order_number,
        orderNumber: order.order_number,
        packageId: pkg.id,
        amount: parseFloat(pkg.price),
        totalPoints: pkg.total_points,
        receivePoints: pkg.total_points,
        validDays: pkg.valid_days,
        validEndDate: validEndDate
      },
      message: '订单创建成功，请完成支付'
    });

  } catch (error) {
    console.error('Create recharge order error:', error);
    res.status(500).json({
      success: false,
      message: '创建订单失败'
    });
  }
}
