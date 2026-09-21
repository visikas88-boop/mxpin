-- VideoFlow Pro 数据库初始化脚本
-- 在服务器上执行: psql -U videoflow -d videoflow_pro -f init-database.sql

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    points DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 积分交易记录表
CREATE TABLE IF NOT EXISTS point_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'recharge', 'consume', 'refund'
    description TEXT,
    balance_after DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 充值套餐表
CREATE TABLE IF NOT EXISTS recharge_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    points DECIMAL(10, 2) NOT NULL,
    bonus_points DECIMAL(10, 2) DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    package_id INTEGER REFERENCES recharge_packages(id),
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
    payment_method VARCHAR(50),
    payment_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 视频生成记录表
CREATE TABLE IF NOT EXISTS video_generations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    video_url TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    points_cost DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Upload-Post 平台配置表
CREATE TABLE IF NOT EXISTS social_platforms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'tiktok', 'youtube', 'instagram', etc.
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 视频发布记录表
CREATE TABLE IF NOT EXISTS video_publications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES video_generations(id),
    platform_id INTEGER REFERENCES social_platforms(id),
    platform_video_id VARCHAR(255),
    title TEXT,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'publishing', 'published', 'failed'
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_video_generations_user_id ON video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_social_platforms_user_id ON social_platforms(user_id);
CREATE INDEX IF NOT EXISTS idx_video_publications_user_id ON video_publications(user_id);

-- 插入默认管理员账号（密码: admin123，需要在应用层加密）
INSERT INTO users (username, email, password_hash, is_admin, points)
VALUES ('admin', 'admin@videoflow.pro', '$2b$10$placeholder', TRUE, 1000.00)
ON CONFLICT (email) DO NOTHING;

-- 插入默认充值套餐
INSERT INTO recharge_packages (name, price, points, bonus_points, description, sort_order)
VALUES
    ('体验套餐', 9.90, 100, 0, '新用户体验', 1),
    ('标准套餐', 29.90, 300, 30, '最受欢迎', 2),
    ('进阶套餐', 99.90, 1000, 200, '高性价比', 3),
    ('专业套餐', 299.90, 3000, 800, '专业用户首选', 4)
ON CONFLICT DO NOTHING;

-- 插入系统配置
INSERT INTO system_configs (key, value, description)
VALUES
    ('video_generation_cost', '10', '视频生成每次消耗积分'),
    ('video_publish_cost', '5', '视频发布每次消耗积分'),
    ('system_version', '0.19.0', '当前系统版本'),
    ('upload_post_api_url', 'https://api.upload-post.com', 'Upload-Post API地址')
ON CONFLICT (key) DO NOTHING;

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_platforms_updated_at ON social_platforms;
CREATE TRIGGER update_social_platforms_updated_at
    BEFORE UPDATE ON social_platforms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_configs_updated_at ON system_configs;
CREATE TRIGGER update_system_configs_updated_at
    BEFORE UPDATE ON system_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 完成提示
SELECT 'Database initialized successfully!' AS status;
