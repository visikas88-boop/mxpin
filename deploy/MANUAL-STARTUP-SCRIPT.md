# Vultr Startup Script 手动添加指南

由于API调用JSON编码问题，采用手动添加Startup Script的方式（3分钟完成）

## 步骤1：创建Startup Script

1. 访问：https://my.vultr.com/settings/#settingsstartupscripts
2. 点击右上角 **"Add Startup Script"** 按钮
3. 填写信息：
   - **Name**: `videoflow-auto-deploy`
   - **Type**: 选择 **"Boot"**
   - **Script**: 复制 `F:\Aipost\deploy\startup-script-simple.sh` 的全部内容粘贴进去
4. 点击 **"Add Startup Script"** 保存

## 步骤2：应用到服务器

1. 访问：https://my.vultr.com/subs/
2. 点击你的服务器（IP: 45.32.65.122）
3. 点击 **"Settings"** 标签页
4. 找到 **"Startup Script"** 部分
5. 从下拉菜单选择 `videoflow-auto-deploy`
6. 点击 **"Update"** 或 **"Apply"**

## 步骤3：重启服务器

在服务器详情页面：
1. 点击右上角的 **"..."** 或 **"Manage"** 菜单
2. 选择 **"Reboot"** 
3. 确认重启

## 等待部署完成

- 服务器重启：1-2分钟
- 脚本执行：5-8分钟
- 服务启动：1分钟
- **总计：7-10分钟**

## 验证部署

10分钟后访问：http://45.32.65.122

或SSH连接查看日志：
```bash
ssh root@45.32.65.122
tail -f /var/log/videoflow-deploy.log
```

密码：`Vultr2026@`

---

## 🔄 或者使用Vultr控制台直接执行（更快）

如果觉得上述步骤复杂，可以：

1. 访问：https://my.vultr.com/subs/
2. 点击服务器 -> **"View Console"**
3. 登录：`root` / `Vultr2026@`
4. 复制粘贴执行：

```bash
curl -o /tmp/deploy.sh https://raw.githubusercontent.com/visikas88-boop/mxpin/main/deploy/manual-deploy-simple.sh && bash /tmp/deploy.sh
```

这个方法5-8分钟即可完成！
