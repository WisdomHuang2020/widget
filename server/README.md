# widget 留言板后端 — 部署与运维

一个零依赖的 Node HTTP 服务，给 `/feedback`（读者提交）与 `/admin`（作者查看）提供接口。

## 为什么是「自建」而不是第三方 BaaS

「留言只有管理员能看到」是一条**服务端**约束。任何把判断逻辑放进前端 JS 的做法，
等于把钥匙贴在门上。因此这里必须有一个真实的身份校验环节，且数据库不能公开可读。

选择自建而非托管 BaaS 的理由：数据留在自己的机器上、无第三方账号依赖、
无免费额度到期风险、代码可审计。代价是需要自己维护进程与备份——本文就是为此而写。

## 架构

```
浏览器 ──HTTPS──▶ nginx (443, www.widget.power-knowledge.tech)
                    │
                    ├── location /            → /var/www/widget  (静态 dist)
                    └── location /api/        → 127.0.0.1:8791   (本服务)
                                                        │
                                                        └── SQLite /var/lib/widget-api/data.db
```

| 项 | 值 |
|---|---|
| 代码 | `/opt/widget-api/` |
| 数据 | `/var/lib/widget-api/data.db`（目录 750，属主 `www-data`） |
| 服务 | `widget-api.service`（systemd，`User=www-data`） |
| 监听 | `127.0.0.1:8791` —— **只监听回环**，公网无法直连 |
| 反代 | `/etc/nginx/sites-available/widget` 里的 `location /api/` |

## 首次部署

```bash
# 1) 建目录
mkdir -p /opt/widget-api /var/lib/widget-api

# 2) 上传 server/ 下的 index.mjs、init-admin.mjs、widget-api.service
#    （在仓库根目录执行）
tar czf - -C server index.mjs init-admin.mjs widget-api.service \
  | ssh root@43.142.148.37 "tar xzf - -C /opt/widget-api"

# 3) 属主与权限
chown -R www-data:www-data /opt/widget-api /var/lib/widget-api
chmod 750 /var/lib/widget-api

# 4) 初始化管理员（密码只打印这一次，记下来）
runuser -u www-data -- /usr/bin/node /opt/widget-api/init-admin.mjs --username power-admin

# 5) 装服务
cp /opt/widget-api/widget-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now widget-api

# 6) 验证
systemctl is-active widget-api
curl -s http://127.0.0.1:8791/api/health
```

nginx 端需要这一块（已存在于 `sites-available/widget` 的 443 主服务内）：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8791;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
    client_max_body_size 32k;
}
```

改完 `nginx -t && systemctl reload nginx`。

## 日常运维

### 查看日志

```bash
journalctl -u widget-api -n 50 --no-pager      # 最近 50 行
journalctl -u widget-api -f                    # 实时跟随
journalctl -u widget-api --since today         # 今天
```

日志里有：每次 `/api/*` 请求的方法、路径、状态码、耗时；登录成功/失败；
新增留言的 id 与长度。**不会打印密码、会话令牌或留言正文。**

### 重启

```bash
systemctl restart widget-api
```

改动 `index.mjs` 后必须重启才生效。

### 更新后端代码

```bash
# 本机（仓库根目录）
tar czf - -C server index.mjs init-admin.mjs widget-api.service \
  | ssh root@43.142.148.37 "tar xzf - -C /opt/widget-api && \
      chown www-data:www-data /opt/widget-api/*.mjs && \
      systemctl restart widget-api && systemctl is-active widget-api"
```

### 备份数据库

数据是单文件 SQLite，WAL 模式下直接 `cp` 可能拿到不一致的快照，**应使用 `.backup`**：

```bash
sqlite3 /var/lib/widget-api/data.db ".backup '/root/widget-data-$(date +%F).db'"
```

若未装 `sqlite3`，退而求其次：先 `systemctl stop widget-api`，`cp` 三个文件
（`data.db`、`data.db-wal`、`data.db-shm`），再 `start`。

建议放进 cron，每日一份、保留 14 天。

### 密码管理

```bash
# 重置为新的随机密码（会吊销所有已登录会话）
runuser -u www-data -- /usr/bin/node /opt/widget-api/init-admin.mjs --reset
```

日常改密码走 `/admin` 页面「修改密码」，无需登录服务器。
改密后除当前浏览器外，其它设备的会话立即失效。

**忘记密码**：用上面的 `--reset`，不要试图从数据库还原——库里只有 scrypt 哈希。

### 清空留言（谨慎）

```bash
sqlite3 /var/lib/widget-api/data.db "DELETE FROM messages;"
```

删除不可恢复。**先备份。**

## 接口一览

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| `GET` | `/api/health` | — | 存活探测，返回版本与管理员是否已初始化 |
| `POST` | `/api/feedback` | — | 提交留言（公开），限流 + 蜜罐 |
| `POST` | `/api/admin/login` | — | 登录，成功下发会话 Cookie |
| `POST` | `/api/admin/logout` | Cookie | 登出 |
| `GET` | `/api/admin/me` | Cookie | 当前身份 |
| `GET` | `/api/admin/messages` | Cookie | 列表，支持 `status`/`limit`/`offset` |
| `PATCH` | `/api/admin/messages/:id` | Cookie | 改状态（`new`/`read`/`archived`） |
| `DELETE` | `/api/admin/messages/:id` | Cookie | 删除 |
| `POST` | `/api/admin/password` | Cookie | 改密码 |

## 故障排查

| 现象 | 排查方向 |
|---|---|
| `/api/health` 返回 502 | 服务没起来：`systemctl status widget-api`、`journalctl -u widget-api -n 50` |
| 服务起不来，日志报 `EACCES` | `/var/lib/widget-api` 属主不对，或 `ProtectSystem=strict` 下路径未列入 `ReadWritePaths` |
| 服务起不来，报 `SQLITE_CANTOPEN` | 目录不存在或 `www-data` 无写权限（`chmod 750` + `chown`） |
| 登录一直 401 | 密码错；或 Cookie 没落地（检查是否经 HTTPS 访问——`Secure` Cookie 不会在 HTTP 下发送） |
| 登录后刷新又退出 | `SameSite=Strict` 导致跨站不发送。后台只能在正式域名用，GitHub Pages 镜像站不行 |
| 提交返回 429 | 触发限流（10 分钟 5 条）。等窗口过期，或重启服务清空内存计数 |
| 提交返回 413 | 请求体超过 32k，检查 nginx `client_max_body_size` 与前端长度限制 |
| 改完 nginx 后 `/api/` 404 | `proxy_pass` 结尾**不能带**斜杠（`.../api/` 会吞掉前缀）；另检查 `location /api/` 是否写在了错误的 server 块里 |

## 安全说明

- 密码：scrypt（N=16384, r=8, p=1），16 字节随机盐，哈希串自带参数便于日后升级。
- 会话：32 字节随机令牌，库内存 SHA-256；有效期 7 天；改密后吊销其它会话。
- Cookie：`HttpOnly`（JS 读不到）、`SameSite=Strict`（跨站不发）、`Secure`（仅 HTTPS）。
- CSRF：管理接口校验 `Origin` 与 `Host` 同源。
- 限流：登录 15 分钟 8 次；留言 10 分钟 5 条 / 24 小时 20 条。
- 隐私：不存明文 IP，只存加盐 SHA-256 前 32 位用于计数。
- 端口：只监听 `127.0.0.1`，无公网入口；systemd 单元带 `NoNewPrivileges`、
  `ProtectSystem=strict`、`ProtectHome`、`RestrictAddressFamilies` 等加固项。

**未做、也不打算做的**：邮件通知、验证码、多管理员、富文本。留言量级不需要，
每加一项都是新的攻击面。
