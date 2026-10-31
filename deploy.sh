#!/usr/bin/env bash
#
# 智能课表 · 网页版一键部署脚本
# ---------------------------------------------------------------
# 用法（在服务器上以 root 运行）：
#   bash deploy.sh                    # 用 IP 访问
#   bash deploy.sh example.com        # 用域名访问
#   bash deploy.sh example.com /tmp/web-deploy.zip
#
# 它会做这些事：
#   1. 检查并安装 nginx / unzip（apt / dnf / yum 自适应）
#   2. 把部署包解压到 /var/www/schedule
#   3. 写入 nginx 站点配置（含 404、静态缓存、SPA 回退）
#   4. 检查配置并重载 nginx
#   5. 放行防火墙 80 端口（ufw / firewalld）
#   6. 打印访问地址
#
# 重复运行是安全的：会覆盖旧文件并重新加载配置。
set -euo pipefail

DOMAIN="${1:-_}"
ZIP="${2:-/tmp/web-deploy.zip}"
APP_ROOT="/var/www/schedule"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*" >&2; }

# ---------- 0. 前置检查 ----------
if [ "$(id -u)" -ne 0 ]; then
  error "需要 root 权限运行"
  echo "  请用：sudo bash $0 $DOMAIN"
  exit 1
fi

if [ ! -f "$ZIP" ]; then
  error "找不到部署包：$ZIP"
  echo "  请先在本机执行："
  echo "    scp web-deploy.zip root@服务器IP:/tmp/"
  exit 1
fi

echo ""
echo "=================================================="
echo " 智能课表 · 网页版部署"
echo " 部署包: $ZIP"
echo " 目标目录: $APP_ROOT"
if [ "$DOMAIN" = "_" ]; then
  echo " 访问方式: 服务器 IP"
else
  echo " 访问域名: $DOMAIN"
fi
echo "=================================================="
echo ""

# ---------- 1. 检测包管理器 ----------
if command -v apt-get >/dev/null 2>&1; then
  PKG="apt"
elif command -v dnf >/dev/null 2>&1; then
  PKG="dnf"
elif command -v yum >/dev/null 2>&1; then
  PKG="yum"
elif command -v apk >/dev/null 2>&1; then
  PKG="apk"
else
  PKG=""
fi

inst() {
  case "$PKG" in
    apt) DEBIAN_FRONTEND=noninteractive apt-get update -qq && apt-get install -y -qq "$@" ;;
    dnf) dnf install -y "$@" ;;
    yum) yum install -y "$@" ;;
    apk) apk add --no-cache "$@" ;;
    *) error "无法识别包管理器，请手动安装：$*"; exit 1 ;;
  esac
}

MISSING=()
command -v nginx >/dev/null 2>&1 || MISSING+=(nginx)
command -v unzip >/dev/null 2>&1 || MISSING+=(unzip)

if [ ${#MISSING[@]} -gt 0 ]; then
  info "安装依赖：${MISSING[*]}"
  inst "${MISSING[@]}"
else
  info "nginx / unzip 已安装"
fi

# ---------- 2. 部署文件 ----------
info "解压部署包到 $APP_ROOT"
mkdir -p "$APP_ROOT"
# 清空旧文件（只动这个专用目录）
find "$APP_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
unzip -o -q "$ZIP" -d "$APP_ROOT"

if [ ! -f "$APP_ROOT/index.html" ]; then
  error "解压后没有 index.html，部署包可能不完整"
  exit 1
fi

# 权限：不同发行版 nginx 用户不同
if id www-data >/dev/null 2>&1; then WEB_USER=www-data
elif id nginx >/dev/null 2>&1; then WEB_USER=nginx
else WEB_USER=root
fi
chown -R "$WEB_USER":"$WEB_USER" "$APP_ROOT" 2>/dev/null || true
chmod -R 755 "$APP_ROOT"
info "文件就位（$WEB_USER 可读），共 $(find "$APP_ROOT" -type f | wc -l) 个文件"

# ---------- 3. 写 nginx 配置 ----------
if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
  CONF="/etc/nginx/sites-available/schedule.conf"
  LINK="/etc/nginx/sites-enabled/schedule.conf"
  USE_SITES=1
else
  CONF="/etc/nginx/conf.d/schedule.conf"
  LINK=""
  USE_SITES=0
fi

info "写入 nginx 配置：$CONF"
cat > "$CONF" <<EOF
# 智能课表 · 网页版（由 deploy.sh 生成）
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root $APP_ROOT;
    index index.html;
    charset utf-8;

    # Service Worker 不缓存，保证发版后能及时更新
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 静态资源缓存一周
    location ~* \\.(css|js|png|jpg|jpeg|svg|ico|woff2?)\$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # 单页应用回退
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    error_page 404 /404.html;
    location = /404.html {
        internal;
    }

    # 关掉版本号暴露
    server_tokens off;
}
EOF

if [ "$USE_SITES" = "1" ]; then
  ln -sf "$CONF" "$LINK"
  # Debian/Ubuntu 默认站点可能抢占 80 端口
  if [ -L /etc/nginx/sites-enabled/default ]; then
    warn "发现默认站点 default，已临时停用（避免抢占 80 端口）"
    rm -f /etc/nginx/sites-enabled/default
  fi
fi

# ---------- 4. 测试并重载 ----------
info "检查 nginx 配置"
if ! nginx -t; then
  error "nginx 配置有误，未重载。请查看上面的错误信息。"
  exit 1
fi

if systemctl is-active --quiet nginx 2>/dev/null; then
  systemctl reload nginx
else
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl start nginx || service nginx start
fi
info "nginx 已重载"

# ---------- 5. 防火墙 ----------
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null 2>&1 || true
  info "ufw 已放行 80 端口"
fi
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
  info "firewalld 已放行 http"
fi

# ---------- 6. 结果 ----------
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ "$DOMAIN" = "_" ]; then
  ACCESS="http://${SERVER_IP}"
else
  ACCESS="http://${DOMAIN}"
fi

echo ""
echo "=================================================="
echo -e " ${GREEN}部署完成${NC}"
echo "=================================================="
echo " 文件目录: $APP_ROOT"
echo " 访问地址: $ACCESS"
echo ""
echo " 下一步："
echo "   1) 云服务器控制台 → 安全组 → 放行 80 端口（必须，否则外网打不开）"
echo "   2) 如果有域名：把域名解析 A 记录指向 $SERVER_IP"
echo "   3) 配 HTTPS（推荐，PWA 与浏览器通知需要）："
echo "        apt-get install -y certbot python3-certbot-nginx"
echo "        certbot --nginx -d 你的域名"
echo "   4) 重新生成二维码："
echo "        node tools/make-qrcode.js --url $ACCESS/"
echo ""
