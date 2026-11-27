"""내려받기 응답 — 한글 파일 이름도 깨지지 않게(filename* = UTF-8)."""
from __future__ import annotations

from typing import IO, Iterator
from urllib.parse import quote

from fastapi.responses import StreamingResponse

_CHUNK = 1024 * 1024


def _chunks(fileobj: IO[bytes]) -> Iterator[bytes]:
    try:
        while chunk := fileobj.read(_CHUNK):
            yield chunk
    finally:
        fileobj.close()


def attachment(fileobj: IO[bytes], filename: str, *, ascii_name: str, media_type: str) -> StreamingResponse:
    """열린 파일을 조금씩 내려보내고 다 보내면 닫는다. ascii_name 은 filename* 을 모르는 옛 브라우저용."""
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"
    return StreamingResponse(_chunks(fileobj), media_type=media_type, headers={"Content-Disposition": disposition})
