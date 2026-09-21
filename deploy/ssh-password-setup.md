## 🔑 设置SSH密码认证

由于SSH密钥认证仍然失败，我们改用密码认证作为备选方案。

### 在 Vultr Web Console 执行：

```bash
# 1. 设置root密码（请设置一个强密码）
passwd

# 输入新密码两次（密码输入时不会显示）

# 2. 确保SSH配置允许密码登录
grep "PasswordAuthentication" /etc/ssh/sshd_config

# 如果显示 "PasswordAuthentication no"，执行：
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

# 3. 重启SSH服务
systemctl restart ssh

# 4. 验证配置
echo "✅ SSH配置完成！请告诉我root密码，我将使用密码连接"
```

---

## 或者：调试authorized_keys问题

```bash
# 查看SSH日志中的错误
tail -30 /var/log/auth.log | grep -i "authentication\|error"

# 检查.ssh目录和文件权限（必须严格）
ls -la ~/.ssh/
stat ~/.ssh/authorized_keys

# 如果权限不对，修复：
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chown root:root ~/.ssh
chown root:root ~/.ssh/authorized_keys

# 重启SSH
systemctl restart ssh
```

---

**方案1（推荐）**：设置root密码，然后告诉我密码（我会通过SSH密码登录）
**方案2**：执行调试命令，截图auth.log的错误信息
