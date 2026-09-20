import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database.js';
import uploadPostService from './services/uploadPostService.js';
import authRoutes from './routes/auth.js';
import modelRoutes from './routes/models.js';
import generationRoutes from './routes/generation.js';
import pointsRoutes from './routes/points.js';
import adminRoutes from './routes/admin.js';
import rechargeRoutes from './routes/recharge.js';
import adminRechargeRoutes from './routes/adminRecharge.js';
import paymentRoutes from './routes/payment.js';
import paymentConfigRoutes from './routes/paymentConfig.js';
import videoRoutes from './routes/videos.js';

// Upload-Post 集成路由
import adminSubscriptionRoutes from './routes/adminSubscription.js';
import adminUploadPostRoutes from './routes/adminUploadPost.js';
import adminProfileQuotaRoutes from './routes/adminProfileQuota.js';
import socialAccountsRoutes from './routes/socialAccounts.js';
import publishingRoutes from './routes/publishing.js';
import platformsInfoRoutes from './routes/platformsInfo.js';
import profilesRoutes from './routes/profiles.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// =====================================================
// 中间件
// =====================================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// =====================================================
// 路由
// =====================================================

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'VideoFlow Pro API'
  });
});

// API 根路径
app.get('/api', (req, res) => {
  res.json({
    name: 'VideoFlow Pro API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      models: '/api/models',
      generate: '/api/generate',
      contents: '/api/contents',
      publish: '/api/publish',
      admin: '/api/admin'
    }
  });
});

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/generation', generationRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/admin/recharge', adminRechargeRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payment-config', paymentConfigRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/v1/videos', videoRoutes); // OpenAI 格式兼容

// Upload-Post 集成路由
app.use('/api/admin/subscription', adminSubscriptionRoutes);
app.use('/api/admin/upload-post', adminUploadPostRoutes);
app.use('/api/admin/profile-quota', adminProfileQuotaRoutes);
app.use('/api/social-accounts', socialAccountsRoutes);
app.use('/api/publishing', publishingRoutes);
app.use('/api/platforms', platformsInfoRoutes);
app.use('/api/profiles', profilesRoutes);

// =====================================================
// 错误处理
// =====================================================

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// =====================================================
// 启动服务器
// =====================================================

async function startServer() {
  try {
    // 测试数据库连接
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    // 初始化Upload-Post服务
    try {
      await uploadPostService.initialize();
      console.log('✅ Upload-Post service initialized');
    } catch (error) {
      console.warn('⚠️  Upload-Post not configured yet:', error.message);
      console.warn('   请在管理后台配置Upload-Post API Key');
    }

    // 启动 HTTP 服务器
    app.listen(PORT, () => {
      console.log('');
      console.log('🚀 VideoFlow Pro Server Started');
      console.log('================================');
      console.log(`📡 API Server: http://localhost:${PORT}`);
      console.log(`📚 API Docs: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('📋 Available Routes:');
      console.log('   POST   /api/auth/register');
      console.log('   POST   /api/auth/login');
      console.log('   GET    /api/auth/me');
      console.log('   PUT    /api/auth/profile');
      console.log('   PUT    /api/auth/password');
      console.log('   GET    /api/models');
      console.log('   GET    /api/models/:id');
      console.log('   POST   /api/models (admin)');
      console.log('   PUT    /api/models/:id (admin)');
      console.log('   DELETE /api/models/:id (admin)');
      console.log('   POST   /api/generation/create');
      console.log('   GET    /api/generation/tasks/:id');
      console.log('   GET    /api/generation/tasks');
      console.log('   POST   /api/generation/tasks/:id/cancel');
      console.log('   GET    /api/points/balance');
      console.log('   GET    /api/points/transactions');
      console.log('   GET    /api/points/stats');
      console.log('   POST   /api/points/recharge (admin)');
      console.log('================================');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await pool.end();
  process.exit(0);
});

// 启动
startServer();
