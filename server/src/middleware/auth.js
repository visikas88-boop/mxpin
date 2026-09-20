import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

/**
 * JWT 认证中间件（支持管理员和普通用户）
 * 验证请求头中的 token，将用户信息附加到 req.user
 */
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 查询用户信息（排除密码）- 支持管理员和普通用户
    const result = await query(
      `SELECT id, email, username, display_name, avatar_url, role, status,
              balance_points, created_at, last_login_at
       FROM users
       WHERE id = $1 AND status = 'active'`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用'
      });
    }

    req.user = result.rows[0];
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '认证令牌已过期'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: '认证过程出错'
    });
  }
}

/**
 * 角色验证中间件
 * @param {string[]} allowedRoles - 允许的角色列表
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
}

/**
 * 可选认证中间件
 * token 存在则验证，不存在则继续（用于公开但可个性化的接口）
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      `SELECT id, email, username, display_name, role, status, balance_points
       FROM users
       WHERE id = $1 AND status = 'active'`,
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      req.user = result.rows[0];
    }

    next();
  } catch (error) {
    // 可选认证，出错不拦截
    next();
  }
}

/**
 * 简化的认证别名（兼容新旧代码）
 */
export const authenticate = authenticateToken;

/**
 * 管理员权限中间件
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '未认证'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  }

  next();
}
