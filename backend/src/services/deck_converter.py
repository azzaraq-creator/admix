"""PPT/PPTX → 슬라이드 PNG 변환 (LibreOffice + poppler).

scripts/convert-ppt.sh 의 로직을 Python으로 이식.
soffice 로 PDF 변환 후 pdftoppm 으로 본문/썸네일 PNG 렌더, meta.json 작성.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile

SLIDE_DPI = 150
THUMB_DPI = 50
CONVERT_TIMEOUT = 300


def _find_soffice() -> str:
    for name in ("soffice", "libreoffice"):
        path = shutil.which(name)
        if path:
            return path
    mac_path = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    if os.path.exists(mac_path):
        return mac_path
    raise RuntimeError("LibreOffice(soffice)를 찾을 수 없습니다.")


def _sorted_pngs(out_dir: str, prefix: str) -> list[str]:
    pattern = re.compile(rf"^{prefix}-(\d+)\.png$")
    matched: list[tuple[int, str]] = []
    for name in os.listdir(out_dir):
        m = pattern.match(name)
        if m:
            matched.append((int(m.group(1)), name))
    matched.sort()
    return [name for _, name in matched]


def convert_ppt_to_slides(pptx_path: str, out_dir: str, title: str) -> dict:
    soffice = _find_soffice()
    if shutil.which("pdftoppm") is None:
        raise RuntimeError("poppler(pdftoppm)를 찾을 수 없습니다.")

    os.makedirs(out_dir, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, pptx_path],
            check=True,
            capture_output=True,
            timeout=CONVERT_TIMEOUT,
        )
        base = os.path.splitext(os.path.basename(pptx_path))[0]
        pdf_path = os.path.join(tmp, f"{base}.pdf")
        if not os.path.exists(pdf_path):
            raise RuntimeError("PDF 변환에 실패했습니다.")

        subprocess.run(
            ["pdftoppm", "-png", "-r", str(SLIDE_DPI), pdf_path, os.path.join(out_dir, "slide")],
            check=True,
            capture_output=True,
            timeout=CONVERT_TIMEOUT,
        )
        subprocess.run(
            ["pdftoppm", "-png", "-r", str(THUMB_DPI), pdf_path, os.path.join(out_dir, "thumb")],
            check=True,
            capture_output=True,
            timeout=CONVERT_TIMEOUT,
        )

    slides = _sorted_pngs(out_dir, "slide")
    thumbs = _sorted_pngs(out_dir, "thumb")
    if not slides:
        raise RuntimeError("생성된 슬라이드가 없습니다.")
    if len(slides) != len(thumbs):
        raise RuntimeError("슬라이드/썸네일 개수가 일치하지 않습니다.")

    meta = {
        "title": title,
        "totalSlides": len(slides),
        "slides": [{"image": s, "thumb": t} for s, t in zip(slides, thumbs)],
    }
    with open(os.path.join(out_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    return meta
