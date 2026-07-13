# Deploy — EC2 (backend) + AWS Amplify (frontend)

- **Backend**: EC2 1대에서 `docker-compose.yml` + `docker-compose.prod.yml` (+ 신 계정은 `docker-compose.newacct.yml`) 로 backend + nginx + certbot. **DB 는 RDS**(신 계정) 또는 postgres 컨테이너(구 계정).
- **AI 추천(챗봇)**: EC2 가 SQS 로 enqueue → **Lambda `admix-ai-agent`** 가 consume. 백엔드 배포 시 **EC2 와 Lambda 둘 다** 갱신해야 한다(아래 "운영" 참조).
- **Frontend**: AWS Amplify Hosting 이 GitHub `main` 브랜치에 연결되어 있어 **push 하면 자동 빌드/배포**된다. 별도 CLI 스텝 없음.

> **현재 운영 (2026-07~, 신 AWS 계정 `787418837344`, 서울 `ap-northeast-2`, CLI 프로필 `ooh-new`)**
> - Backend EC2: `43.201.172.34` (admix-backend) · SSH `~/.ssh/admix-key.pem` · 도메인 `https://43-201-172-34.sslip.io`
> - DB: **RDS `admix-db`** (postgres 컨테이너 미기동 → compose 에 `docker-compose.newacct.yml` override **필수**. 빠지면 빈 로컬 DB 로 붙음)
> - AI 추천: **Lambda `admix-ai-agent`** (SQS FIFO `admix-ai-jobs.fifo` consume) · 이미지 ECR `787418837344.dkr.ecr.ap-northeast-2.amazonaws.com/admix-ai-agent`
> - Frontend: Amplify 앱 `d5zpc903rfz5q` (구 계정 앱 유지 + `NEXT_PUBLIC_API_URL`→새 백엔드). `main` push 시 자동 배포.
>
> 아래 "## 1)~5)" 는 **최초 구축 기록**(예시 값은 구 계정 `13.125.7.82`/`ooh-key`)이라 참고용. **재배포는 "## 운영" 섹션**을 본다.

## 사전 준비

- AWS 계정 (CLI 자격증명 유효해야 함 — `aws sts get-caller-identity`)
- 도메인 1개 (`api.your-domain.com` 으로 backend HTTPS) — **현재 운영**: `43-201-172-34.sslip.io` (Elastic IP `43.201.172.34` 를 sslip.io 무료 DNS 로 노출)
- AWS Amplify Hosting 앱 (이미 생성·연결되어 있음. GitHub `auraworks/ooh-recommend` `main` 브랜치 watch). **현재 운영**: `https://main.d5zpc903rfz5q.amplifyapp.com`
- OpenAI API key

> **배포 모델 한 줄 요약**: 백엔드는 EC2 한 대에 `docker compose` 로 띄우는 컨테이너 구성이고, 로컬 머신에서 만든 그 컨테이너 환경(코드 + DB 데이터)을 그대로 EC2 로 옮기는 방식이다. 따라서 git pull 이 아니라 **로컬 코드를 `rsync` 로 EC2 에 푸시한 뒤 컨테이너를 rebuild** 한다. 자세한 명령은 아래 "운영" 섹션 참조.

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
bash <(curl -fsSL https://raw.githubusercontent.com/auraworks/ooh-recommend/main/deploy/ec2-setup.sh)
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

## 6) Frontend — AWS Amplify (자동 배포)

이미 Amplify Hosting 앱이 `auraworks/ooh-recommend` 의 `main` 브랜치와 연결되어 있다.

- **자동 배포**: `git push origin main` 하면 Amplify 가 빌드 + 배포까지 자동 처리
- **app root**: `frontend/` (Amplify Console 에서 monorepo 설정)
- **환경변수** (Amplify Console → App settings → Environment variables):
  - `NEXT_PUBLIC_API_URL = https://api.your-domain.com`  (현재 운영값: `https://43-201-172-34.sslip.io`)
- **빌드 설정**: Amplify Console 에 저장된 설정 사용. 레포에 `amplify.yml` 두지 않음
  (Console UI 와 충돌 방지)

프론트 도메인 변경 시 backend `.env` 의 `FRONTEND_URL` 갱신:
```bash
# EC2 에서
cd ~/ooh-recommend
# backend/.env 수정 → FRONTEND_URL=https://<amplify-domain>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate backend
```

## 운영

### 프론트 재배포
`git push origin main` 만 하면 Amplify 가 알아서 빌드/배포한다.

### 백엔드 재배포 — **로컬 rsync → EC2 rebuild** 방식

git pull 이 아니라 로컬 코드를 통째로 EC2 에 동기화한 뒤 컨테이너를 rebuild 한다.
이렇게 하는 이유: 운영 EC2 가 GitHub private repo 접근 권한(deploy key/PAT)이
설정되어 있지 않은 환경에서도 동작해야 하고, 로컬 검증 결과(`docker compose`
로 돌려본 그 코드 그대로)를 그대로 띄우는 게 가장 안전하기 때문.

**한 줄 흐름**: 로컬 코드 → `rsync` → EC2 → `docker compose up --build` → `alembic upgrade head` → `/health` 확인.

이 4단계가 `deploy/redeploy.sh` 한 스크립트로 묶여 있다.

```bash
bash deploy/redeploy.sh
```

환경변수 (기본값으로 안 되는 환경에서 override):

| 변수 | 기본 | 의미 |
|---|---|---|
| `EC2_HOST` | `ubuntu@43.201.172.34` | EC2 SSH target (신 계정 admix-backend) |
| `SSH_KEY` | `~/.ssh/admix-key.pem` | SSH 키 위치 |
| `REPO_DIR` | `/home/ubuntu/ooh-recommend` | EC2 의 monorepo 루트 |

스크립트가 안에서 실행하는 명령은 아래와 같다 (참고용 — 디버깅 시 수동 실행).

```bash
# 1) 로컬 → EC2 코드 동기화 (.git, node_modules, .env, macOS 메타파일 제외)
#    ⚠️ 소스는 반드시 monorepo 루트의 **절대경로**. 상대경로 `./` 는 셸 작업디렉토리가
#    하위폴더면 --delete 가 EC2 레포를 통째로 덮어쓴다(사고 이력). redeploy.sh 는 $ROOT 절대경로 사용.
rsync -az --delete \
  --exclude='.git/' --exclude='node_modules/' --exclude='.next/' \
  --exclude='*.tsbuildinfo' --exclude='__pycache__/' --exclude='.pytest_cache/' \
  --exclude='.venv/' --exclude='venv/' \
  --exclude='.DS_Store' --exclude='._*' \
  --exclude='.omc/' --exclude='.claude/' \
  --exclude='backend/.env' --exclude='.env' --exclude='.env.local' \
  -e "ssh -i ~/.ssh/admix-key.pem" \
  /ABS/PATH/ooh-recommend/ ubuntu@43.201.172.34:/home/ubuntu/ooh-recommend/

# 2) EC2 에서 backend rebuild + 마이그  (newacct override 필수 — RDS 연결)
ssh -i ~/.ssh/admix-key.pem ubuntu@43.201.172.34 '
  cd ~/ooh-recommend && \
  docker compose --env-file backend/.env \
    -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.newacct.yml \
    up -d --build backend && \
  docker exec ooh-backend alembic upgrade head && \
  curl -s http://127.0.0.1:8000/health
'
```

### AI 추천(챗봇) 재배포 — **Lambda `admix-ai-agent`**

챗봇/AI 추천 로직(`recommend_v2.py` 의 `_event_stream`)은 프론트가 async(`/recommend/v2/jobs`→폴링)로
호출하므로 **실제로는 Lambda 가 처리**한다. 이 로직을 바꾸면 EC2 재배포만으로는 유저에게 반영되지
않고 **Lambda 이미지도 다시 빌드/푸시**해야 한다. (EC2 는 `/v2/stream` 및 enqueue/폴링만 담당.)

```bash
cd backend
# 1) ECR 로그인
aws --profile ooh-new ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin \
    787418837344.dkr.ecr.ap-northeast-2.amazonaws.com

# 2) 이미지 빌드+푸시 (amd64, provenance off — Lambda 는 OCI attestation 매니페스트 거부)
docker buildx build --provenance=false --platform linux/amd64 \
  -f Dockerfile.lambda \
  -t 787418837344.dkr.ecr.ap-northeast-2.amazonaws.com/admix-ai-agent:latest --push .

# 3) 함수 코드 갱신 + 완료 대기
aws --profile ooh-new lambda update-function-code --region ap-northeast-2 \
  --function-name admix-ai-agent \
  --image-uri 787418837344.dkr.ecr.ap-northeast-2.amazonaws.com/admix-ai-agent:latest
aws --profile ooh-new lambda wait function-updated --region ap-northeast-2 \
  --function-name admix-ai-agent

# 4) E2E 확인 (EC2 에서 enqueue→폴링 — done 나오면 신 코드 반영됨)
ssh -i ~/.ssh/admix-key.pem ubuntu@43.201.172.34 '
  jid=$(curl -s -X POST http://127.0.0.1:8000/recommend/v2/jobs \
    -H "content-type: application/json" -d "{\"message\":\"안녕하세요\"}" \
    | grep -oE "[0-9a-f-]{36}" | head -1)
  sleep 6
  curl -s http://127.0.0.1:8000/recommend/v2/jobs/$jid | head -c 400
'
```

> requirements-lambda.txt 변경이 없으면 위 3스텝이면 된다. 새 파이썬 의존성을 추가했다면
> `backend/requirements-lambda.txt` 에도 반영 후 빌드.

> ⚠️ **macOS 메타파일 (`._*`, `.DS_Store`) 은 반드시 exclude** 할 것. 빠뜨리면 EC2 가
> 쓰레기 파일로 도배되고, 잘못된 변형(예: `backend/` 만 보내기)을 쓰면
> `backend/` 디렉토리 구조가 평탄화돼서 `docker compose build` 가 깨진다. 이번에
> 한 번 망가져서 복구한 이력이 있음. `deploy/redeploy.sh` 는 이 함정을 모두 피한다.

### DB 데이터 이전 (로컬 → EC2)

> ⚠️ **신 계정은 DB 가 RDS** 라 EC2 에 `ooh-postgres` 컨테이너가 없다. 아래 예시의 EC2 측
> `docker exec ooh-postgres ...` 는 **구 계정 기준**이다. 신 계정에서는 EC2 에서 RDS 로 직접
> `psql`/`pg_restore` 하거나(엔드포인트 `admix-db.cjuy04k4msd0.ap-northeast-2.rds.amazonaws.com`,
> db `admix_recommend`, 비번은 Secrets Manager), backend 컨테이너를 경유해 실행한다.
> 로컬 소스 측 `ooh-postgres` 덤프는 그대로 유효.

운영 DB 가 비어있거나 로컬에서 만든 신규 데이터를 옮길 때만 실행.

```bash
# 로컬: media 테이블 data-only 덤프
mkdir -p /tmp/db-transfer
docker exec ooh-postgres pg_dump -U postgres -d ooh_recommend \
  --data-only --column-inserts \
  -t media_items -t media_keywords \
  > /tmp/db-transfer/media-data.sql

# EC2 로 전송 + 적용
scp -i ~/.ssh/ooh-key.pem /tmp/db-transfer/media-data.sql ubuntu@13.125.7.82:/home/ubuntu/
ssh -i ~/.ssh/ooh-key.pem ubuntu@13.125.7.82 '
  docker exec -i ooh-postgres psql -U postgres -d ooh_recommend -v ON_ERROR_STOP=1 \
    < /home/ubuntu/media-data.sql
'
```

전체 DB (세션 포함) 이전이라면 `pg_dump -Fc` 로 풀 덤프 → EC2 에 `pg_restore`.
운영 중 세션을 덮어쓰면 위험하므로 보통은 위처럼 **테이블 단위 데이터만** 옮긴다.

### CORS / `FRONTEND_URL` 운영 주의

backend `CORSMiddleware.allow_origins` 는 `backend/.env` 의 `FRONTEND_URL` 을
콤마(`,`) 로 split 한다. **Amplify 자동 배포로 새 도메인이 생기거나
커스텀 도메인을 붙이면 반드시 추가**해야 한다. 안 그러면 브라우저에서
`POST /chat/graph/sessions net::ERR_FAILED` (실제 응답은 `400 Disallowed CORS origin`).

```bash
# EC2 에서
cd ~/ooh-recommend
cp backend/.env backend/.env.bak.$(date +%Y%m%d-%H%M%S)
# FRONTEND_URL 값을 콤마로 연장 (예시)
#   FRONTEND_URL=http://localhost:3000,https://main.d5zpc903rfz5q.amplifyapp.com,https://<custom>
docker compose --env-file backend/.env \
  -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.newacct.yml \
  up -d --force-recreate backend
```

### 기타

- **로그**: `docker compose logs -f backend`
- **DB 백업**: (구 계정) `docker exec ooh-postgres pg_dump -U postgres -Fc ooh_recommend > backup-$(date +%F).dump` / (신 계정 RDS) EC2 에서 `pg_dump -h admix-db.cjuy04k4msd0.ap-northeast-2.rds.amazonaws.com -U postgres -Fc admix_recommend > backup-$(date +%F).dump`
- **마이그레이션 상태**: `docker exec ooh-backend alembic current` (head 표시 확인)
- **인증서 갱신**: certbot 자동 (90일 주기). 수동: `sudo certbot renew --dry-run`
