## 🔧 SSH连接故障排查

请在 Vultr Web Console 执行以下命令：

### 1. 检查SSH配置
```bash
# 检查sshd配置
grep -E "PubkeyAuthentication|PasswordAuthentication|PermitRootLogin" /etc/ssh/sshd_config
```

### 2. 确保关键配置正确
```bash
# 备份原配置
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# 确保这些配置启用
sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

# 或直接添加配置
cat >> /etc/ssh/sshd_config << EOF

# Custom settings for deployment
PubkeyAuthentication yes
PermitRootLogin yes
PasswordAuthentication yes
EOF
```

### 3. 重启SSH服务
```bash
systemctl restart ssh
systemctl status ssh
```

### 4. 检查authorized_keys
```bash
# 查看文件内容
cat ~/.ssh/authorized_keys

# 确认权限正确
ls -la ~/.ssh/
ls -la ~/.ssh/authorized_keys
```

### 5. 查看SSH日志（如果还有问题）
```bash
tail -50 /var/log/auth.log
```

---

执行完成后，截图给我看结果。
