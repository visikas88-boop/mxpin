# Vultr SSH修复 - 最后一次机会

## 在Vultr控制台执行以下命令：

### 1. 配置SSH允许密码和密钥认证
```bash
cat > /tmp/fix_ssh.sh << 'EOF'
#!/bin/bash
set -e

echo "=== 修复SSH配置 ==="

# 备份原配置
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# 配置SSH
cat > /etc/ssh/sshd_config << 'SSHCONF'
Port 22
PermitRootLogin yes
PubkeyAuthentication yes
PasswordAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
SSHCONF

# 确保.ssh目录存在
mkdir -p /root/.ssh
chmod 700 /root/.ssh

# 添加公钥（如果有的话）
if [ ! -f /root/.ssh/authorized_keys ]; then
    touch /root/.ssh/authorized_keys
fi
chmod 600 /root/.ssh/authorized_keys

# 重启SSH服务
systemctl restart sshd
systemctl status sshd

echo "✅ SSH配置已修复"
echo "测试命令："
echo "  ssh root@45.32.65.122"
EOF

chmod +x /tmp/fix_ssh.sh
/tmp/fix_ssh.sh
```

### 2. 添加SSH公钥（可选，更安全）
```bash
cat >> /root/.ssh/authorized_keys << 'EOF'
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCm2ClnsI/VVZNel5Z6cX+Jv2cu2kBEHEY+2kuz3ao7/pNsqIBn3hz3Uo9OGO50gV6mb6GcvGb7orUFyLNI/xAUg6rEk0BP2qYC9VBeuGxtgEzx0ciQpyMvfdKRLTbhTN1gZlTgzSmoTHnmLIYp8allIRyuoYRIYFRmBrtadFLx5nUoMb0gQeQtooD6T84Xx7E6qAlcZq2z3n5Z1yDLFQ7NlfSujEqgVgaw96JslF8Xm35bDLTwRQFWh80MHpyIk4gj7l8EjlT7LQ1qVDQ/alC1C0RoGe44naXRvBk/sRMJJ3DDU/UntAdKVaZmo/7Dump92WmAC57467jN3IO//tPeBmlHZFn85yyZ6WnV3B3ImhKANBTEOIeayVYdLFwUhRyZjy+mHPBhJxZ/Gf38AtHiLTHOlsgh2YlAwkR2Rp9k3hT3uNI2TwfQolWuIHJcRSYzXAV8zGgSWTD6Lp6SH5mt4caVkatWpk5YizVkQQZ+g2xK/Zqvk68/ha1qdMQETsWlxjvkVxxcYbMCCkPL7IGZlP+Lu0kOfl1rQcLzQ+iU+WWgP4a6nzwTipV9xtKhNluihBtKGCnFeEkWgGo3hZmg17rft/rmZ5Pwsm9vfpLyNW/8j26en0dAUSD1UwRAuK7DHTk4G3hO8zR1JfbCwx4pf/deK7JKqDFhRhwoeI6z5w== claude-code@oneap
EOF
chmod 600 /root/.ssh/authorized_keys
```

### 3. 测试SSH连接
```bash
echo "SSH配置完成，现在可以测试连接了"
```

---

## 执行步骤：

1. **复制上面第1步的整个代码块**
2. **粘贴到Vultr控制台执行**
3. **看到"✅ SSH配置已修复"后，告诉我**

我会立即测试SSH连接！
