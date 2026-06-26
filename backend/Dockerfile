FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    libreoffice-impress poppler-utils \
    fonts-nanum fonts-noto-cjk fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

# PPT 변환 시 없는 폰트 대체 매핑 (맑은고딕→Noto CJK, Arial→Liberation 등)
COPY fonts-local.conf /etc/fonts/local.conf
RUN fc-cache -f

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY alembic.ini .
COPY alembic ./alembic
COPY scripts ./scripts

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
