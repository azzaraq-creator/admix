# Deploy — EC2 + Vercel

`docker-compose.yml` + `docker-compose.prod.yml` 그대로 EC2 에 띄움.

## 사전 준비

- AWS 계정 (CLI 자격증명 유효해야 함 — `aws sts get-caller-identity`)
- 도메인 1개 (`api.your-domain.com` 으로 backend HTTPS)
- Vercel 계정 (frontend)
- OpenAI API key

## 1) AWS — EC2 인스턴스 생성

리전: `ap-northeast-2` (서울), 인스턴스 타입: `t3.small` (2 vCPU / 2 GB RAM)
Ubuntu 22.04 LTS, EBS 30 GB.

### CLI 로 한 번에 (예시 — 본인 값으로 치환)

```bash
REGION=ap-northeast-2
KEY_NAME=ooh-key
SG_NAME=ooh-backend-sg

# 1) 키페어 생성 (이미 있으면 skip)
aws ec2 create-key-pair --region $REGION --key-name $KEY_NAME \
  --query KeyMaterial --output text > ~/.ssh/$KEY_NAME.pem
chmod 600 ~/.ssh/$KEY_NAME.pem

# 2) 시큐리티 그룹 (22/80/443)
SG_ID=$(aws ec2 create-security-group --region $REGION \
  --group-name $SG_NAME --description "ooh backend" \
  --query GroupId --output text)
aws ec2 authorize-security-group-ingress --region $REGION --group-id $SG_ID \
  --ip-permissions \
  IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges='[{CidrIp=0.0.0.0/0}]' \
  IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=0.0.0.0/0}]' \
  IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges='[{CidrIp=0.0.0.0/0}]'

# 3) 최신 Ubuntu 22.04 AMI
AMI_ID=$(aws ec2 describe-images --region $REGION \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query 'Images | sort_by(@,&CreationDate) | [-1].ImageId' --output text)

# 4) 인스턴스 launch
INSTANCE_ID=$(aws ec2 run-instances --region $REGION \
  --image-id $AMI_ID --instance-type t3.small \
  --key-name $KEY_NAME --security-group-ids $SG_ID \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ooh-backend}]' \
  --query 'Instances[0].InstanceId' --output text)

# 5) Elastic IP 할당
ALLOC_ID=$(aws ec2 allocate-address --region $REGION --domain vpc --query AllocationId --output text)
aws ec2 wait instance-running --region $REGION --instance-ids $INSTANCE_ID
aws ec2 associate-address --region $REGION --instance-id $INSTANCE_ID --allocation-id $ALLOC_ID

PUBLIC_IP=$(aws ec2 describe-addresses --region $REGION --allocation-ids $ALLOC_ID \
  --query 'Addresses[0].PublicIp' --output text)
echo "Public IP: $PUBLIC_IP"
```

## 2) DNS 설정

도메인 등록 기관에서 A 레코드:
```
api.your-domain.com.  →  $PUBLIC_IP   (TTL 300)
```
전파 확인: `dig +short api.your-domain.com`

## 3) EC2 셋업

```bash
ssh -i ~/.ssh/ooh-key.pem ubuntu@$PUBLIC_IP
bash <(curl -fsSL https://raw.githubusercontent.com/swinglala/ooh-recommend/main/deploy/ec2-setup.sh)
# 로그아웃 → 재접속 (docker 그룹 반영)
```

## 4) 시크릿 + DB 데이터

로컬에서 seed 파일을 EC2 로 전송:
```bash
scp -i ~/.ssh/ooh-key.pem seed/ad_data.sql ubuntu@$PUBLIC_IP:~/ooh-recommend/seed/
```

EC2 안:
```bash
cd ~/ooh-recommend
cp backend/.env.production.example backend/.env
# editor 로 POSTGRES_PASSWORD, OPENAI_API_KEY, FRONTEND_URL 입력
# 강력한 패스워드: openssl rand -base64 32

# postgres 먼저 띄우고 데이터 restore
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres
sleep 5
bash deploy/restore-db.sh

# backend 까지 전부
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose ps
curl -s http://127.0.0.1:8000/health   # {"status":"ok"} 확인
```

## 5) nginx + HTTPS

```bash
sudo cp deploy/nginx.conf.template /etc/nginx/sites-available/ooh-backend
sudo sed -i 's/__DOMAIN__/api.your-domain.com/g' /etc/nginx/sites-available/ooh-backend
sudo ln -sf /etc/nginx/sites-available/ooh-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# HTTP 확인
curl -s http://api.your-domain.com/health

# HTTPS 발급 (대화형 — 이메일 입력 후 redirect: 2 선택 권장)
sudo certbot --nginx -d api.your-domain.com

# 자동 갱신 cron 확인
sudo systemctl status certbot.timer
```

## 6) Vercel — frontend

- GitHub 연동, root = `frontend`
- env: `NEXT_PUBLIC_API_URL = https://api.your-domain.com`
- 배포 후 도메인을 EC2 backend `.env` 의 `FRONTEND_URL` 에 추가:
```bash
# EC2 에서
cd ~/ooh-recommend
# backend/.env 수정 → FRONTEND_URL=https://your-app.vercel.app
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate backend
```

## 운영

- **로그**: `docker compose logs -f backend`
- **재배포 (코드만)**: EC2 에서 `git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend`
- **DB 백업**: `docker exec ooh-postgres pg_dump -U postgres -Fc ooh_recommend > backup-$(date +%F).dump`
- **인증서 갱신**: certbot 자동 (90일 주기). 수동: `sudo certbot renew --dry-run`
