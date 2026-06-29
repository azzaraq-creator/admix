#!/usr/bin/env bash
# PPT/PPTX → 슬라이드 이미지 변환 스크립트
#
# 사전 설치 (macOS):
#   brew install --cask libreoffice
#   brew install poppler
#
# 사용법:
#   ./scripts/convert-ppt.sh <input.pptx> <deck-id> [title]
# 예시:
#   ./scripts/convert-ppt.sh ~/Desktop/intro.pptx intro-2026 "회사소개 2026"
#
# 결과: frontend/public/decks/<deck-id>/ 에 slide-*.png, thumb-*.png, meta.json 생성

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <input.pptx> <deck-id> [title]" >&2
  exit 1
fi

INPUT="$1"
DECK_ID="$2"
TITLE="${3:-}"

if [[ ! -f "$INPUT" ]]; then
  echo "✗ 입력 파일을 찾을 수 없음: $INPUT" >&2
  exit 1
fi

# 필수 도구 확인
SOFFICE_BIN=""
if command -v soffice &>/dev/null; then
  SOFFICE_BIN="soffice"
elif [[ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]]; then
  SOFFICE_BIN="/Applications/LibreOffice.app/Contents/MacOS/soffice"
else
  echo "✗ LibreOffice가 필요함:  brew install --cask libreoffice" >&2
  exit 1
fi

if ! command -v pdftoppm &>/dev/null; then
  echo "✗ poppler가 필요함:  brew install poppler" >&2
  exit 1
fi

# 스크립트 위치 기준으로 프로젝트 루트 계산
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$PROJECT_ROOT/frontend/public/decks/$DECK_ID"

# 기존 출력 정리
if [[ -d "$OUT_DIR" ]]; then
  echo "→ 기존 출력 제거: $OUT_DIR"
  rm -rf "$OUT_DIR"
fi
mkdir -p "$OUT_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "→ PPT → PDF 변환"
"$SOFFICE_BIN" --headless --convert-to pdf --outdir "$TMP_DIR" "$INPUT" >/dev/null

PDF="$TMP_DIR/$(basename "${INPUT%.*}").pdf"
if [[ ! -f "$PDF" ]]; then
  echo "✗ PDF 변환 실패" >&2
  exit 1
fi

echo "→ 슬라이드 렌더 (본문 150dpi)"
pdftoppm -png -r 150 "$PDF" "$OUT_DIR/slide"

echo "→ 썸네일 렌더 (50dpi)"
pdftoppm -png -r 50 "$PDF" "$OUT_DIR/thumb"

# meta.json 생성 (Node로)
echo "→ meta.json 작성"
TITLE="$TITLE" OUT_DIR="$OUT_DIR" node -e '
const fs = require("fs");
const path = require("path");
const dir = process.env.OUT_DIR;
const title = process.env.TITLE || "";
const files = fs.readdirSync(dir);
const slides = files.filter(f => /^slide-\d+\.png$/.test(f)).sort();
const thumbs = files.filter(f => /^thumb-\d+\.png$/.test(f)).sort();
if (slides.length === 0) { console.error("no slides generated"); process.exit(1); }
if (slides.length !== thumbs.length) { console.error("slide/thumb count mismatch"); process.exit(1); }
const meta = {
  title,
  totalSlides: slides.length,
  slides: slides.map((image, i) => ({ image, thumb: thumbs[i] })),
};
fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
'

COUNT=$(node -e 'console.log(require("'"$OUT_DIR"'/meta.json").totalSlides)')
echo ""
echo "✓ 완료: $OUT_DIR"
echo "  슬라이드 수: $COUNT"
echo "  접속: http://localhost:3000/deck/$DECK_ID"
