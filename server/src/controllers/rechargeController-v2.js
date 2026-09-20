import { query } from '../config/database.js';

/**
 * 获取积分兑换比例
 */
async function getExchangeRate() {
  const result = await query(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'points_exchange_rate'`,
    []
  );
  return result.rows.length > 0 ? parseInt(result.rows[0].setting_value) : 10;
}

/**
 * 计算套餐积分
 */
function calculatePoints(pkg, exchangeRate) {
  if (pkg.points_calc_mode === 'manual') {
    // 手动模式：直接使用设置的积分
    return {
      basePoints: pkg.manual_base_points || 0,
      giftPoints: pkg.manual_gift_points || 0,
      totalPoints: (pkg.manual_base_points || 0) + (pkg.manual_gift_points || 0),
      giftPercent: pkg.manual_gift_points && pkg.manual_base_points
        ? Math.floor((pkg.manual_gift_points / pkg.manual_base_points) * 100)
        : 0
    };
  } else {
    // 自动模式：根据价格和比例计算
    const basePoints = Math.floor(pkg.price * exchangeRate);
    const giftPoints = Math.floor(basePoints * (pkg.gift_percent / 100));
    const totalPoints = basePoints + giftPoints;

    return {
      basePoints,
      giftPoints,
      totalPoints,
      giftPercent: pkg.gift_percent
    };
  }
}

/**
 * 获取积分套餐列表
 * GET /api/recharge/packages
 */
export async function getRechargePackages(req, res) {
  try {
    const userId = req.user.id;

    // 获取用户信息
    const userResult = await query(
      `SELECT id, username, email, balance_points
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = userResult.rows[0];

    // 获取积分比例
    const exchangeRate = await getExchangeRate();

    // 获取套餐分组和套餐列表
    const packagesResult = await query(`
      SELECT
        g.group_id,
        g.group_type,
        g.group_name,
        g.group_name_en,
        g.group_desc,
        g.group_desc_en,
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
        p.desc,
        p.desc_en,
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
          groupDesc: row.group_desc,
          groupDescEn: row.group_desc_en,
          sortOrder: row.group_sort_order,
          packages: []
        });
      }

      if (row.id) {
        // 计算积分
        const points = calculatePoints(row, exchangeRate);

        // 生成赠送标签
        let giftDesc = null;
        if (points.giftPercent > 0) {
          giftDesc = `+${points.giftPercent}%`;
        }

        groupsMap.get(row.group_id).packages.push({
          id: row.id,
          packageType: row.package_type,
          packageName: row.package_name,
          packageNameEn: row.package_name_en,
          price: parseFloat(row.price),
          originalPrice: row.original_price ? parseFloat(row.original_price) : null,
          basePoints: points.basePoints,
          giftPoints: points.giftPoints,
          totalPoints: points.totalPoints,
          giftPercent: points.giftPercent,
          giftDesc: giftDesc,
          validType: row.valid_type,
          validDays: row.valid_days,
          validEndDate: row.valid_end_date,
          desc: row.desc,
          descEn: row.desc_en,
          isHot: row.is_hot,
          sortOrder: row.sort_order,
          // 附加信息
          pointsCalcMode: row.points_calc_mode,
          exchangeRate: exchangeRate
        });
      }
    });

    const packageGroups = Array.from(groupsMap.values());

    res.json({
      success: true,
      data: {
        userInfo: {
          id: user.id,
          username: user.username,
          email: user.email,
          balancePoints: user.balance_points
        },
        packageGroups,
        systemConfig: {
          exchangeRate: exchangeRate,
          currencySymbol: '¥'
        }
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
 * POST /api/recharge/create-order
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

    // 获取积分比例
    const exchangeRate = await getExchangeRate();

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

    // 计算积分
    const points = calculatePoints(pkg, exchangeRate);

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
        user_id, order_no, package_id, package_name, amount, receive_points,
        payment_method, status, valid_days, valid_end_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending', $7, $8)
      RETURNING id`,
      [userId, orderNo, pkg.id, pkg.package_name, pkg.price, points.totalPoints, pkg.valid_days, validEndDate]
    );

    const orderId = orderResult.rows[0].id;

    // TODO: 这里应该调用支付接口生成支付二维码或支付链接
    // 目前返回模拟数据
    const paymentUrl = `https://pay.example.com/order/${orderNo}`;
    const qrCode = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;

    res.json({
      success: true,
      data: {
        orderId: orderNo,
        packageId: pkg.id,
        amount: parseFloat(pkg.price),
        totalPoints: points.totalPoints,
        basePoints: points.basePoints,
        giftPoints: points.giftPoints,
        exchangeRate: exchangeRate,
        paymentUrl,
        qrCode
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

/**
 * 获取系统配置（积分比例）
 * GET /api/recharge/settings
 */
export async function getRechargeSettings(req, res) {
  try {
    const settingsResult = await query(
      `SELECT setting_key, setting_value, setting_desc, setting_type
       FROM system_settings
       WHERE setting_key IN ('points_exchange_rate', 'currency_symbol', 'currency_name')`,
      []
    );

    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.setting_key] = {
        value: row.setting_type === 'number' ? parseFloat(row.setting_value) : row.setting_value,
        desc: row.setting_desc,
        type: row.setting_type
      };
    });

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Get recharge settings error:', error);
    res.status(500).json({
      success: false,
      message: '获取系统配置失败'
    });
  }
}

/**
 * 更新积分比例（管理员）
 * PUT /api/recharge/settings/exchange-rate
 */
export async function updateExchangeRate(req, res) {
  try {
    const { rate } = req.body;

    if (!rate || rate <= 0) {
      return res.status(400).json({
        success: false,
        message: '积分比例必须大于0'
      });
    }

    await query(
      `UPDATE system_settings
       SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = 'points_exchange_rate'`,
      [rate.toString()]
    );

    res.json({
      success: true,
      message: `积分比例已更新为 1:${rate}`,
      data: {
        exchangeRate: rate
      }
    });

  } catch (error) {
    console.error('Update exchange rate error:', error);
    res.status(500).json({
      success: false,
      message: '更新积分比例失败'
    });
  }
}
