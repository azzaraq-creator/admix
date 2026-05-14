#!/usr/bin/env bash
# AWS MFA 세션 자격증명 발급.
#
# 사용법:
#   bash deploy/aws-mfa-session.sh 123456
#   ↳ Google Authenticator 등의 6자리 코드를 인자로 전달
#
# 결과:
#   ~/.aws/credentials 의 [ooh-mfa] profile 을 새 임시 자격증명으로 덮어씀.
#   이후 모든 명령에 --profile ooh-mfa 또는 export AWS_PROFILE=ooh-mfa
#
# 환경변수 (한 번 셋팅하면 됨):
#   MFA_ARN     — arn:aws:iam::<ACCOUNT>:mfa/<USER>
#   SRC_PROFILE — long-term key profile 이름 (default: ooh-longterm)
#   DST_PROFILE — 발급된 세션을 저장할 profile (default: ooh-mfa)
#   DURATION    — 초 단위 유효기간 (default: 28800 = 8시간, max 129600 = 36시간)

set -euo pipefail

TOKEN="${1:?usage: $0 <6-digit-code>}"
MFA_ARN="${MFA_ARN:?MFA_ARN env required (arn:aws:iam::...:mfa/<user>)}"
SRC_PROFILE="${SRC_PROFILE:-ooh-longterm}"
DST_PROFILE="${DST_PROFILE:-ooh-mfa}"
DURATION="${DURATION:-28800}"

echo "==> STS GetSessionToken (source: $SRC_PROFILE, duration: ${DURATION}s)"
JSON=$(aws sts get-session-token \
  --profile "$SRC_PROFILE" \
  --serial-number "$MFA_ARN" \
  --token-code "$TOKEN" \
  --duration-seconds "$DURATION")

AK=$(echo "$JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Credentials"]["AccessKeyId"])')
SK=$(echo "$JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Credentials"]["SecretAccessKey"])')
ST=$(echo "$JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Credentials"]["SessionToken"])')
EXP=$(echo "$JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["Credentials"]["Expiration"])')

aws configure set aws_access_key_id "$AK" --profile "$DST_PROFILE"
aws configure set aws_secret_access_key "$SK" --profile "$DST_PROFILE"
aws configure set aws_session_token "$ST" --profile "$DST_PROFILE"
aws configure set region ap-northeast-2 --profile "$DST_PROFILE"

echo "==> 발급 완료 → profile: $DST_PROFILE  (만료: $EXP)"
echo "    export AWS_PROFILE=$DST_PROFILE   # 또는 매 명령에 --profile $DST_PROFILE"

aws sts get-caller-identity --profile "$DST_PROFILE"
