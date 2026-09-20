import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

/**
 * 生成 JWT token
 */
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * 用户注册
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { email, username, password, displayName } = req.body;

    // 参数验证
    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: '邮箱、用户名和密码不能为空'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '邮箱格式不正确'
      });
    }

    // 验证用户名格式（3-50字符，字母数字下划线）
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: '用户名必须是3-50个字符，只能包含字母、数字和下划线'
      });
    }

    // 验证密码强度（至少6位）
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码长度至少为6位'
      });
    }

    // 检查邮箱是否已存在
    const emailCheck = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: '该邮箱已被注册'
      });
    }

    // 检查用户名是否已存在
    const usernameCheck = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: '该用户名已被使用'
      });
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const result = await query(
      `INSERT INTO users (email, username, password_hash, display_name, role, status, balance_points)
       VALUES ($1, $2, $3, $4, 'user', 'active', 0)
       RETURNING id, email, username, display_name, role, balance_points, created_at`,
      [email, username, passwordHash, displayName || username]
    );

    const user = result.rows[0];

    // 生成 token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
          balancePoints: user.balance_points,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试'
    });
  }
}

/**
 * 用户登录
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供登录凭证和密码'
      });
    }

    // 查询用户（支持邮箱或用户名登录）
    const result = await query(
      `SELECT id, email, username, password_hash, display_name, avatar_url,
              role, status, balance_points, created_at
       FROM users
       WHERE email = $1 OR username = $1`,
      [login]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const user = result.rows[0];

    // 检查用户状态
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: '该账号已被封禁'
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: '该账号未激活'
      });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 更新最后登录时间
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // 生成 token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          role: user.role,
          balancePoints: user.balance_points,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
}

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export async function getCurrentUser(req, res) {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          username: req.user.username,
          displayName: req.user.display_name,
          avatarUrl: req.user.avatar_url,
          role: req.user.role,
          balancePoints: req.user.balance_points,
          createdAt: req.user.created_at,
          lastLoginAt: req.user.last_login_at
        }
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
}

/**
 * 更新用户资料
 * PUT /api/auth/profile
 */
export async function updateProfile(req, res) {
  try {
    const { displayName, avatarUrl } = req.body;
    const userId = req.user.id;

    const result = await query(
      `UPDATE users
       SET display_name = COALESCE($1, display_name),
           avatar_url = COALESCE($2, avatar_url),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, username, display_name, avatar_url, role, balance_points`,
      [displayName, avatarUrl, userId]
    );

    res.json({
      success: true,
      message: '资料更新成功',
      data: {
        user: {
          id: result.rows[0].id,
          email: result.rows[0].email,
          username: result.rows[0].username,
          displayName: result.rows[0].display_name,
          avatarUrl: result.rows[0].avatar_url,
          role: result.rows[0].role,
          balancePoints: result.rows[0].balance_points
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: '更新资料失败'
    });
  }
}

/**
 * 修改密码
 * PUT /api/auth/password
 */
export async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请提供旧密码和新密码'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度至少为6位'
      });
    }

    // 获取当前密码
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '旧密码错误'
      });
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({
      success: true,
      message: '密码修改成功'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: '修改密码失败'
    });
  }
}
