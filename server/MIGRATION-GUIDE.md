# 数据库迁移指南

## 问题说明
视频生成功能需要 `user_points` 表来管理用户积分，但当前数据库中只有 `users.balance_points` 字段。

## 迁移步骤

### 方法一：使用自动化脚本（推荐）
双击运行 `run-migration.bat`，脚本会自动：
1. 查找 PostgreSQL 安装路径
2. 执行 `create-user-points-table.sql` 迁移脚本
3. 显示执行结果

### 方法二：手动执行
如果自动脚本失败，请手动执行以下命令：

```bash
# Windows
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -U postgres -d videoflow_pro -f create-user-points-table.sql

# 或者使用 psql 命令行
psql -h localhost -U postgres -d videoflow_pro -f create-user-points-table.sql
```

### 方法三：直接复制SQL
打开 PostgreSQL 客户端（如 pgAdmin），连接到 `videoflow_pro` 数据库，执行 `create-user-points-table.sql` 中的全部内容。

## 迁移内容
- 创建 `user_points` 表
- 从 `users.balance_points` 迁移现有积分数据
- 自动关联所有用户

## 验证
迁移成功后，会显示所有用户的积分信息：
```
username    | balance | total_recharged | total_consumed
------------|---------|-----------------|----------------
visicas     | 100000  | 0               | 0
testuser    | 0       | 0               | 0
```

## 注意事项
- 迁移是安全的，使用 `CREATE TABLE IF NOT EXISTS` 和 `ON CONFLICT` 避免重复
- 不会删除 `users.balance_points` 字段（向后兼容）
- 执行前会提示输入 postgres 用户密码

## 完成后
重新测试视频生成功能，系统会：
1. 检查用户积分余额
2. 扣除相应积分（minimax-h3: 295积分/次）
3. 调用云端AI模型生成视频
4. 失败时自动退回积分
