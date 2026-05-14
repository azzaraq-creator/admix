#!/usr/bin/env bash
# EC2 (Ubuntu 22.04) 최초 셋업 스크립트.
# ssh 로 인스턴스 접속 후 한 번 실행.
#
#   curl -fsSL https://raw.githubusercontent.com/<owner>/ooh-recommend/main/deploy/ec2-setup.sh | bash
#
# 또는 레포 clone 한 뒤:
#   bash deploy/ec2-setup.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/swinglala/ooh-recommend.git}"
REPO_DIR="${REPO_DIR:-$HOME/ooh-recommend}"

echo "==> apt update + 기본 패키지"
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git nginx ufw

echo "==> Docker 설치 (공식 repo)"
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER" || true

echo "==> certbot (HTTPS 무료 인증서)"
sudo apt-get install -y certbot python3-certbot-nginx

echo "==> UFW 방화벽 (22/80/443 만 허용)"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

if [ ! -d "$REPO_DIR" ]; then
  echo "==> 레포 clone"
  git clone "$REPO_URL" "$REPO_DIR"
fi

echo
echo "==> 완료. 다음 단계:"
echo "  1) cd $REPO_DIR"
echo "  2) cp backend/.env.production.example backend/.env"
echo "     # POSTGRES_PASSWORD, OPENAI_API_KEY, FRONTEND_URL 채움"
echo "  3) docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres"
echo "  4) docker exec ooh-postgres psql -U postgres -d ooh_recommend -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
echo "  5) bash deploy/restore-db.sh   # seed/ad_data.sql 을 미리 scp 로 올려둘 것"
echo "  6) docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
echo "  7) sudo cp deploy/nginx.conf.template /etc/nginx/sites-available/ooh-backend"
echo "     sudo sed -i 's/__DOMAIN__/api.your-domain.com/g' /etc/nginx/sites-available/ooh-backend"
echo "     sudo ln -sf /etc/nginx/sites-available/ooh-backend /etc/nginx/sites-enabled/"
echo "     sudo rm -f /etc/nginx/sites-enabled/default"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo "  8) sudo certbot --nginx -d api.your-domain.com"
echo
echo "⚠️ docker 그룹 변경 반영 위해 한 번 로그아웃 → 재접속."
