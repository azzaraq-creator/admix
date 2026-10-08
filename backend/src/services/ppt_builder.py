"""기획안 PPT 생성 — python-pptx 로 슬라이드 레이아웃을 코드로 구성하고 데이터를 채운다.

프론트 React 슬라이드(components/proposals/*Template.tsx)의 1920x1080 디자인을
근사 재현한다. 슬라이드 순서: 표지 → 서머리(매체 5개씩) → 매체별 → Thanks.
"""
from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Optional

import httpx
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

from src.config import get_settings

# 1920x1080 px 디자인 → 슬라이드 16:9 (12192000 x 6858000 EMU)
EMU_PER_PX = 6350  # 1920 * 6350 = 12192000
PT_PER_PX = 0.5  # 1920px = 960pt (13.333in)
SLIDE_W = Emu(1920 * EMU_PER_PX)
SLIDE_H = Emu(1080 * EMU_PER_PX)

FONT = "Noto Sans KR"
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

# 프론트 디자인 토큰(app/globals.css)과 같은 값
GRAY_50 = RGBColor(0xF5, 0xF6, 0xFB)
GRAY_100 = RGBColor(0xEC, 0xEE, 0xF5)
GRAY_200 = RGBColor(0xDD, 0xE0, 0xEA)
GRAY_400 = RGBColor(0x9A, 0xA0, 0xB4)
GRAY_500 = RGBColor(0x72, 0x78, 0x92)
GRAY_600 = RGBColor(0x55, 0x5B, 0x73)
GRAY_700 = RGBColor(0x3D, 0x42, 0x58)
GRAY_900 = RGBColor(0x16, 0x1A, 0x2E)
STROKE = RGBColor(0xE4, 0xE5, 0xEE)
PRIMARY = RGBColor(0x7A, 0x3F, 0xE0)
PRIMARY_300 = RGBColor(0xB7, 0xA3, 0xF2)
PRIMARY_700 = RGBColor(0x54, 0x26, 0xA6)
PRIMARY_800 = RGBColor(0x3F, 0x1D, 0x82)
TOTAL_TINT = RGBColor(0xF9, 0xF8, 0xFE)  # primary-50 70% (흰 바탕 위)
PRIMARY_50 = RGBColor(0xF6, 0xF4, 0xFE)
# 보라 카드 위 반투명 흰색 — pptx 글자는 투명도를 못 써서 섞은 색으로 둔다.
WHITE_20_ON_PRIMARY = RGBColor(0x95, 0x65, 0xE6)
WHITE_55_ON_PRIMARY = RGBColor(0xC3, 0xA9, 0xF1)
WHITE_75_ON_PRIMARY = RGBColor(0xDE, 0xCF, 0xF7)
WHITE_85_ON_PRIMARY = RGBColor(0xEB, 0xE2, 0xFA)
WHITE_60_ON_DARK = RGBColor(0xA0, 0x9E, 0xA7)

ROWS_PER_PAGE = 5
EMPTY = "-"

# 프론트 슬라이드를 그대로 캡처한 이미지(1920×1080). 블러·그라데이션 심볼은 pptx 도형으로
# 재현할 수 없어 이미지로 깐다. 표지는 기획안명·날짜만 빼고 캡처, Thanks 는 슬라이드 전체.
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets")
COVER_BG = os.path.join(ASSETS, "cover-bg.png")
THANKS_BG = os.path.join(ASSETS, "thanks-bg.png")
# 매체·서머리 오른쪽 아래 흐린 로고(투명도 18% 를 이미지에 입혀 둠)
WATERMARK = os.path.join(ASSETS, "watermark.png")

# (머리글, 너비, 정렬) — SummaryTemplate.tsx 의 COL·HEADER_COLUMNS 와 같다.
SUMMARY_COLS = [
    ("NO", 64, PP_ALIGN.CENTER),
    ("구분", 140, PP_ALIGN.CENTER),
    ("지역", 130, PP_ALIGN.CENTER),
    ("매체명", 240, PP_ALIGN.LEFT),
    ("상품명", 220, PP_ALIGN.LEFT),
    ("개월 수", 140, PP_ALIGN.CENTER),
    ("광고비", 170, PP_ALIGN.RIGHT),
    ("제작비", 170, PP_ALIGN.RIGHT),
    ("합계", 180, PP_ALIGN.RIGHT),
    ("집행 기간", 338, PP_ALIGN.CENTER),
]
TOTAL_COL = 8


def _px(v: float) -> Emu:
    return Emu(int(v * EMU_PER_PX))


def _pt(v: float):
    return Pt(v * PT_PER_PX)


def _won(value) -> str:
    try:
        return f"{int(value):,}원"
    except (TypeError, ValueError):
        return EMPTY


def _num(value) -> str:
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return EMPTY


def _year_date(iso: Optional[str]) -> tuple[str, str]:
    from datetime import datetime, timezone

    if iso:
        try:
            d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        except ValueError:
            d = datetime.now(timezone.utc)
    else:
        d = datetime.now(timezone.utc)
    return str(d.year), f"{d.year}.{d.month:02d}.{d.day:02d}"


def _fetch_image(url: Optional[str]) -> Optional[bytes]:
    if not url:
        return None
    # 서버에 저장된 파일(/uploads/..., 로컬 개발의 매체 사진 등)은 HTTP 대신 디스크에서 읽는다.
    if url.startswith("/uploads/"):
        path = Path(get_settings().upload_dir) / url.removeprefix("/uploads/")
        try:
            return path.read_bytes()
        except OSError:
            return None
    try:
        resp = httpx.get(url, timeout=10, follow_redirects=True)
        resp.raise_for_status()
        return resp.content
    except Exception:  # noqa: BLE001 — 이미지 실패는 graceful
        return None


def _bg(slide, color: RGBColor) -> None:
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    shape.shadow.inherit = False


def _bg_image(slide, path: str) -> None:
    """1920×1080 배경 이미지를 슬라이드 전체에 풀블리드. 없으면 표지 바탕색으로 대신한다."""
    if os.path.exists(path):
        slide.shapes.add_picture(path, 0, 0, width=SLIDE_W, height=SLIDE_H)
    else:
        _bg(slide, RGBColor(0x11, 0x0C, 0x22))


def _watermark(slide) -> None:
    """오른쪽 아래 흐린 로고 — SlideWatermark.tsx(right 40, bottom 28, 높이 36)와 같은 위치."""
    if os.path.exists(WATERMARK):
        w, h = 127, 36
        slide.shapes.add_picture(WATERMARK, _px(1920 - 40 - w), _px(1080 - 28 - h),
                                 width=_px(w), height=_px(h))


def _no_theme_style(shape) -> None:
    """기본 테마 스타일(p:style)을 떼어 그림자 등 효과가 붙지 않게 한다."""
    style = shape._element.find(qn("p:style"))
    if style is not None:
        shape._element.remove(style)


def _rect(slide, left, top, width, height, color: RGBColor):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    shape.shadow.inherit = False
    _no_theme_style(shape)
    return shape


def _round_rect(slide, left, top, width, height, color: RGBColor, radius_px: float):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.adjustments[0] = min(0.5, _px(radius_px) / min(width, height))
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    shape.shadow.inherit = False
    _no_theme_style(shape)
    return shape


def _style_run(run, text, *, size, color, bold=False, spacing=None):
    run.text = str(text)
    run.font.size = _pt(size)
    run.font.bold = bold
    run.font.name = FONT
    run.font.color.rgb = color
    if spacing is not None:
        # 자간(px) — python-pptx 에 속성이 없어 rPr spc(1/100pt) 로 직접 지정
        run._r.get_or_add_rPr().set("spc", str(int(spacing * PT_PER_PX * 100)))


def _text(
    slide,
    left,
    top,
    width,
    height,
    text,
    *,
    size,
    color,
    bold=False,
    align=PP_ALIGN.LEFT,
    anchor=MSO_ANCHOR.TOP,
    tight=False,
    wrap=True,
    spacing=None,
    line_spacing=None,
):
    """tight=True 면 안쪽 여백을 없애 px 좌표를 프론트 디자인과 그대로 맞춘다."""
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    if tight:
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = align
    if line_spacing is not None:
        p.line_spacing = line_spacing
    _style_run(p.add_run(), text, size=size, color=color, bold=bold, spacing=spacing)
    return box


def _new_slide(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])  # blank


# ===== 슬라이드 빌더 =====


def build_cover(prs, detail: dict) -> None:
    """CoverTemplate.tsx — 배경·로고·짧은 선은 이미지, 기획안명·날짜만 텍스트로 얹는다."""
    slide = _new_slide(prs)
    _bg_image(slide, COVER_BG)
    year, date = _year_date(detail.get("updated_at"))
    heading = (detail.get("title") or "").strip() or f"광고 기획안_{year}"

    # 영문 머리말 + 기획안명 — 아래(짧은 선 위 48px)에 붙여 두 줄이 되면 위로 늘어난다.
    box = slide.shapes.add_textbox(_px(120), _px(300), _px(1080), _px(532))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.BOTTOM
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    eyebrow = tf.paragraphs[0]
    _style_run(eyebrow.add_run(), "ADVERTISING PROPOSAL", size=22, color=PRIMARY_300,
               bold=True, spacing=22 * 0.24)
    title = tf.add_paragraph()
    title.space_before = _pt(32)
    title.line_spacing = 1.15
    _style_run(title.add_run(), heading, size=96, color=WHITE, bold=True, spacing=-2.4)

    _text(slide, _px(120), _px(912), _px(1080), _px(44), date, size=32,
          color=WHITE_60_ON_DARK, tight=True)


def build_thanks(prs) -> None:
    """ThanksTemplate.tsx — 문구까지 모두 고정이라 슬라이드 전체를 캡처 이미지로 쓴다."""
    slide = _new_slide(prs)
    _bg_image(slide, THANKS_BG)


def _pos(value) -> int:
    return value if isinstance(value, int) and value > 0 else 1


def _ad_mult(it: dict) -> int:
    """광고비에 곱하는 값 — 수량 × 개월 수(기획안 금액 규칙과 같다)."""
    return _pos(it.get("quantity")) * _pos(it.get("months"))


def _prod_mult(it: dict) -> int:
    """제작비에 곱하는 값 — 수량 × 제작 수."""
    return _pos(it.get("quantity")) * _pos(it.get("production_count"))


def _summary_stat(slide, left, width, label, value, *, top, divider) -> None:
    pad = 28 if divider else 0
    if divider:
        _rect(slide, _px(left), _px(top + 28), _px(1), _px(66), STROKE)
    _text(slide, _px(left + pad), _px(top + 28), _px(width - pad - 8), _px(24), label,
          size=16, color=GRAY_500, tight=True, wrap=False)
    _text(slide, _px(left + pad), _px(top + 60), _px(width - pad - 8), _px(36), value,
          size=24, color=GRAY_900, bold=True, tight=True, wrap=False)


def _category_chip(slide, left, width, center_y, value) -> None:
    """구분 — 회색 둥근 칩. 칸보다 길면 두 줄로 감싼다."""
    inner = width - 24
    est = len(value) * 15 + 28
    chip_w = min(inner, est)
    chip_h = 32 if est <= inner else 54
    chip = _round_rect(slide, _px(left + (width - chip_w) / 2), _px(center_y - chip_h / 2),
                       _px(chip_w), _px(chip_h), GRAY_100, chip_h / 2)
    tf = chip.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = _px(10)
    tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    _style_run(p.add_run(), value, size=15, color=GRAY_600, bold=True)


def build_summary_pages(prs, detail: dict) -> None:
    """SummaryTemplate.tsx 와 같은 배치(1920×1080 px 좌표)."""
    items = detail.get("items", [])
    pages = [items[i:i + ROWS_PER_PAGE] for i in range(0, len(items), ROWS_PER_PAGE)]
    if not pages:
        pages = [[]]

    ad_total = sum((it.get("price") or 0) * _ad_mult(it) for it in items)
    prod_total = sum((it.get("production_fee") or 0) * _prod_mult(it) for it in items)
    regions = ", ".join(
        dict.fromkeys(it.get("region") for it in items if it.get("region"))
    ) or EMPTY
    starts = sorted(it["start_date"] for it in items if it.get("start_date"))
    ends = sorted((it["end_date"] for it in items if it.get("end_date")), reverse=True)
    period = f"{starts[0]} ~ {ends[0]}" if starts and ends else EMPTY

    left = 64
    stats_top = 128
    stats_h = 122
    gross_w = 400
    table_top = 290
    head_h = 56
    rows_top = table_top + head_h
    row_h = (1080 - 48 - rows_top) / ROWS_PER_PAGE
    col_x = [left]
    for _, w, _ in SUMMARY_COLS:
        col_x.append(col_x[-1] + w)

    for page_idx, rows in enumerate(pages):
        slide = _new_slide(prs)
        _bg(slide, WHITE)

        # 제목: 보라 막대 + Summary + 캠페인 요약
        _round_rect(slide, _px(left), _px(58), _px(6), _px(36), PRIMARY, 3)
        box = _text(slide, _px(left + 22), _px(50), _px(600), _px(56), "Summary",
                    size=40, color=GRAY_900, bold=True, tight=True, wrap=False,
                    anchor=MSO_ANCHOR.MIDDLE, spacing=-1)
        _style_run(box.text_frame.paragraphs[0].add_run(), "   캠페인 요약",
                   size=18, color=GRAY_400)

        # 요약 카드(회색) — 열 비율 1.5 : 0.7 : 1.2 : 1 : 1
        card_w = 1792 - 20 - gross_w
        _round_rect(slide, _px(left), _px(stats_top), _px(card_w), _px(stats_h), GRAY_50, 16)
        stats = [
            ("캠페인 기간", period, 1.5),
            ("집행 매체", f"{len(items)}개", 0.7),
            ("캠페인 지역", regions, 1.2),
            ("광고비 합계", _won(ad_total), 1),
            ("제작비 합계", _won(prod_total), 1),
        ]
        inner = card_w - 72
        fr_sum = sum(fr for _, _, fr in stats)
        x = left + 36
        for i, (label, value, fr) in enumerate(stats):
            w = inner * fr / fr_sum
            _summary_stat(slide, x, w, label, value, top=stats_top, divider=i > 0)
            x += w

        # 전체 금액 카드(보라) — GROSS 는 광고비 합계(제작비 제외)
        gx = left + card_w + 20
        _round_rect(slide, _px(gx), _px(stats_top), _px(gross_w), _px(stats_h), PRIMARY, 16)
        _text(slide, _px(gx + 36), _px(stats_top + 24), _px(gross_w - 72), _px(24),
              "전체 금액 합계(GROSS) · VAT 별도", size=16, color=WHITE_75_ON_PRIMARY,
              tight=True, wrap=False)
        _text(slide, _px(gx + 36), _px(stats_top + 54), _px(gross_w - 72), _px(48),
              _won(ad_total), size=36, color=WHITE, bold=True, tight=True, wrap=False)

        # 합계 열 연보라 바탕(머리글 ~ 마지막 매체 행)
        tint_bottom = rows_top + row_h * len(rows)
        _rect(slide, _px(col_x[TOTAL_COL]), _px(table_top + 2), _px(SUMMARY_COLS[TOTAL_COL][1]),
              _px(tint_bottom - table_top - 2), TOTAL_TINT)

        # 머리글: 위 진한 선 + 아래 옅은 선
        _rect(slide, _px(left), _px(table_top), _px(1792), _px(2), GRAY_900)
        _rect(slide, _px(left), _px(rows_top - 1), _px(1792), _px(1), GRAY_200)
        for ci, (label, w, align) in enumerate(SUMMARY_COLS):
            _text(slide, _px(col_x[ci] + 20), _px(table_top + 2), _px(w - 40), _px(head_h - 3),
                  label, size=15, bold=True, tight=True, wrap=False, align=align,
                  anchor=MSO_ANCHOR.MIDDLE,
                  color=PRIMARY_700 if ci == TOTAL_COL else GRAY_500)

        for ri, it in enumerate(rows):
            top = rows_top + row_h * ri
            cy = top + row_h / 2
            ad = (it.get("price") or 0) * _ad_mult(it) if it.get("price") is not None else None
            prod = (
                (it.get("production_fee") or 0) * _prod_mult(it)
                if it.get("production_fee") is not None else None
            )
            count = _pos(it.get("production_count"))
            start = it.get("start_date")
            cells = [
                (str(page_idx * ROWS_PER_PAGE + ri + 1), GRAY_400, False),
                None,  # 구분 칩
                (it.get("region") or EMPTY, GRAY_700, False),
                (it.get("media_name") or it.get("name") or EMPTY, GRAY_900, True),
                (it.get("product") or EMPTY, GRAY_700, False),
                (f"{_pos(it.get('months'))}개월", GRAY_700, False),
                (_num(ad), GRAY_700, False),
                (_num(prod), GRAY_700, False),
                (_num((ad or 0) + (prod or 0)), PRIMARY_800, True),
                (f"{start} ~ {it.get('end_date') or EMPTY}" if start else EMPTY, GRAY_700, False),
            ]
            for ci, cell in enumerate(cells):
                _, w, align = SUMMARY_COLS[ci]
                if cell is None:
                    if it.get("category"):
                        _category_chip(slide, col_x[ci], w, cy, it["category"])
                    else:
                        _text(slide, _px(col_x[ci]), _px(top), _px(w), _px(row_h), EMPTY,
                              size=18, color=GRAY_700, tight=True, align=PP_ALIGN.CENTER,
                              anchor=MSO_ANCHOR.MIDDLE)
                    continue
                text, color, bold = cell
                _text(slide, _px(col_x[ci] + 20), _px(top), _px(w - 40), _px(row_h - 1), text,
                      size=18, color=color, bold=bold, tight=True, align=align,
                      anchor=MSO_ANCHOR.MIDDLE, wrap=ci in (1, 2, 3, 4))
            if count > 1:
                # 제작 수 — 제작비 아래 작은 글씨
                _text(slide, _px(col_x[7] + 20), _px(cy + 14), _px(SUMMARY_COLS[7][1] - 40),
                      _px(20), f"제작 {count}회", size=14, color=GRAY_400, tight=True,
                      align=PP_ALIGN.RIGHT, wrap=False)
            _rect(slide, _px(left), _px(top + row_h - 1), _px(1792), _px(1), GRAY_100)

        _watermark(slide)


def _text_width(text: str, size: float) -> float:
    """대략적인 글자 폭(px) — 칩·제목 뒤 요소 배치용. 한글은 글자 크기, 영문·숫자는 그보다 좁게."""
    width = 0.0
    for ch in text:
        if "\uac00" <= ch <= "\ud7a3":
            width += size
        elif ch == " ":
            width += size * 0.3
        elif ch.isupper() or ch.isdigit():
            width += size * 0.62
        else:
            width += size * 0.52
    return width


def _wrap_lines(text: str, width: float, size: float) -> int:
    """글자 폭으로 줄바꿈을 따라 해 본 줄 수(단어 단위, 화면의 keep-all 과 같다).
    글자 폭은 넉넉히 잡아(_text_width) 실제 PPT 에서는 이보다 덜 차게 한다."""
    lines = 0
    line = ""
    for word in text.split():
        candidate = f"{line} {word}" if line else word
        if _text_width(candidate, size) <= width:
            line = candidate
            continue
        if line:
            lines += 1
        # 한 단어가 한 줄보다 길면 글자 단위로 나눈다.
        line = ""
        for ch in word:
            if line and _text_width(line + ch, size) > width:
                lines += 1
                line = ""
            line += ch
    return lines + (1 if line else 0)


def _chip(slide, left, top, text, *, accent=False) -> float:
    """MediaTemplate.tsx 의 Chip — 둥근 칩을 그리고 칩 너비(px)를 돌려준다."""
    w = _text_width(text, 15) + 28
    chip = _round_rect(slide, _px(left), _px(top), _px(w), _px(32),
                       PRIMARY_50 if accent else GRAY_100, 16)
    tf = chip.text_frame
    tf.word_wrap = False
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    _style_run(p.add_run(), text, size=15, bold=True,
               color=PRIMARY_700 if accent else GRAY_600)
    return w


def _round_picture(pic, width, height, radius_px: float) -> None:
    """그림 모서리를 둥글게 — 그림에는 adjustments 가 없어 반경(짧은 변 대비 1/100000)을 XML 로 넣는다."""
    pic.auto_shape_type = MSO_SHAPE.ROUNDED_RECTANGLE
    av = pic._element.spPr.find(qn("a:prstGeom")).get_or_add_avLst()
    av.append(av.makeelement(qn("a:gd"), {
        "name": "adj", "fmla": f"val {int(radius_px / min(width, height) * 100000)}",
    }))


def _cover_picture(slide, data: bytes, left, top, width, height, radius_px: float) -> bool:
    """이미지를 칸에 꽉 채우고(object-cover 처럼 잘라서) 모서리를 둥글게. 실패하면 False."""
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as img:
            iw, ih = img.size
        pic = slide.shapes.add_picture(io.BytesIO(data), _px(left), _px(top),
                                       width=_px(width), height=_px(height))
    except Exception:  # noqa: BLE001 — 이미지 실패는 graceful
        return False
    box_ratio, img_ratio = width / height, iw / ih
    if img_ratio > box_ratio:  # 이미지가 더 넓으면 좌우를 잘라낸다
        cut = (1 - box_ratio / img_ratio) / 2
        pic.crop_left = pic.crop_right = cut
    elif img_ratio < box_ratio:  # 더 길면 위아래를 잘라낸다
        cut = (1 - img_ratio / box_ratio) / 2
        pic.crop_top = pic.crop_bottom = cut
    _round_picture(pic, width, height, radius_px)
    return True


def _contain_photo(data: bytes, width: int, height: int) -> Optional[bytes]:
    """MediaTemplate.tsx 의 MediaPhoto — 사진 전체를 보이게(contain) 두고, 남는 칸은 같은 사진을
    흐리게 깔아 채운 한 장짜리 이미지(JPEG)를 만든다. 매체 사진 비율이 제각각이라 자르지 않는다."""
    try:
        from PIL import Image, ImageFilter, ImageOps

        scale = 1.5  # 화면 px 보다 조금 크게 만들어 확대해도 덜 뭉개지게
        size = (int(width * scale), int(height * scale))
        with Image.open(io.BytesIO(data)) as src:
            img = src.convert("RGB")
        bg = ImageOps.fit(img, size).filter(ImageFilter.GaussianBlur(60))
        bg = Image.blend(bg, Image.new("RGB", size, (0xEC, 0xEE, 0xF5)), 0.4)
        ratio = min(size[0] / img.width, size[1] / img.height)
        fg = img.resize((max(1, round(img.width * ratio)), max(1, round(img.height * ratio))),
                        Image.LANCZOS)
        bg.paste(fg, ((size[0] - fg.width) // 2, (size[1] - fg.height) // 2))
        out = io.BytesIO()
        bg.save(out, format="JPEG", quality=88)
        return out.getvalue()
    except Exception:  # noqa: BLE001 — 이미지 실패는 graceful
        return None


def _empty_box(slide, left, top, width, height, label) -> None:
    _round_rect(slide, _px(left), _px(top), _px(width), _px(height), GRAY_50, 16)
    _text(slide, _px(left), _px(top), _px(width), _px(height), label, size=18,
          color=GRAY_400, tight=True, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def _media_photo(slide, left, top, width, height, url) -> None:
    data = _fetch_image(url)
    photo = _contain_photo(data, width, height) if data else None
    if photo is None:
        _empty_box(slide, left, top, width, height, "이미지 없음")
        return
    pic = slide.shapes.add_picture(io.BytesIO(photo), _px(left), _px(top),
                                   width=_px(width), height=_px(height))
    _round_picture(pic, width, height, 16)


def _map_box(slide, left, top, width, height, url, empty_label) -> None:
    data = _fetch_image(url)
    if data is not None and _cover_picture(slide, data, left, top, width, height, 16):
        return
    _empty_box(slide, left, top, width, height, empty_label)



def _card_title(slide, left, top, width, title) -> None:
    _text(slide, _px(left), _px(top), _px(width), _px(28), title, size=18,
          color=GRAY_900, bold=True, tight=True, wrap=False)


def _spec_row(slide, left, top, width, label, value, *, first_row) -> None:
    """매체 정보 사양표 한 줄(높이 64) — 왼쪽 항목명, 오른쪽 값. 첫 줄은 위에 진한 선."""
    if first_row:
        _rect(slide, _px(left), _px(top), _px(width), _px(2), GRAY_900)
    _rect(slide, _px(left), _px(top + 63), _px(width), _px(1), GRAY_100)
    _text(slide, _px(left), _px(top), _px(104), _px(64), label, size=16, color=GRAY_500,
          tight=True, wrap=False, anchor=MSO_ANCHOR.MIDDLE)
    _text(slide, _px(left + 120), _px(top), _px(width - 120), _px(64), value, size=18,
          color=GRAY_900, bold=True, tight=True, wrap=False, anchor=MSO_ANCHOR.MIDDLE)


def _price_row(slide, left, top, width, label, note, value) -> None:
    box = _text(slide, _px(left), _px(top), _px(width), _px(28), label, size=16,
                color=WHITE_75_ON_PRIMARY, tight=True, wrap=False, anchor=MSO_ANCHOR.BOTTOM)
    if note:
        _style_run(box.text_frame.paragraphs[0].add_run(), f"  {note}", size=14,
                   color=WHITE_55_ON_PRIMARY)
    _text(slide, _px(left), _px(top), _px(width), _px(28), value, size=20, color=WHITE,
          bold=True, tight=True, wrap=False, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.BOTTOM)


def _price_card(slide, left, top, width, height, item: dict) -> None:
    _round_rect(slide, _px(left), _px(top), _px(width), _px(height), PRIMARY, 16)
    inner_l, inner_w = left + 28, width - 56
    _text(slide, _px(inner_l), _px(top + 28), _px(inner_w), _px(22), "집행 금액 · VAT 별도",
          size=16, color=WHITE_75_ON_PRIMARY, tight=True, wrap=False)
    price, fee = item.get("price"), item.get("production_fee")
    ad = price * _ad_mult(item) if price is not None else None
    prod = fee * _prod_mult(item) if fee is not None else None
    _price_row(slide, inner_l, top + 62, inner_w, "광고비",
               f"{_won(price)} × {_pos(item.get('months'))}개월" if price is not None else None,
               _won(ad))
    _price_row(slide, inner_l, top + 98, inner_w, "제작비",
               f"{_won(fee)} × {_pos(item.get('production_count'))}회" if fee is not None else None,
               _won(prod))
    _rect(slide, _px(inner_l), _px(top + height - 28 - 44 - 16), _px(inner_w), _px(1),
          WHITE_20_ON_PRIMARY)
    _text(slide, _px(inner_l), _px(top + height - 28 - 44), _px(inner_w), _px(44), "합계",
          size=18, color=WHITE_85_ON_PRIMARY, bold=True, tight=True, wrap=False,
          anchor=MSO_ANCHOR.BOTTOM)
    _text(slide, _px(inner_l), _px(top + height - 28 - 48), _px(inner_w), _px(48),
          _won((ad or 0) + (prod or 0)), size=36, color=WHITE, bold=True, tight=True,
          wrap=False, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.BOTTOM, spacing=-0.9)


def _media_facts(item: dict, plan: Optional[dict]) -> list[tuple[str, str]]:
    """매체 종류별 매체 정보 — MediaTemplate.tsx 의 mediaFacts 와 같은 항목·순서."""
    moving = item.get("media_source") == "MOVING"
    place = (
        [("운행 지역", item.get("operating_area") or EMPTY),
         ("운행 노선", item.get("operating_route") or EMPTY)]
        if moving
        else []
    )
    qty = " ".join(
        v for v in (
            f"{item['device_quantity']}기" if item.get("device_quantity") is not None else None,
            f"{item['surface_quantity']}면" if item.get("surface_quantity") is not None else None,
        ) if v
    ) or EMPTY
    product = (
        item.get("product")
        or ((plan.get("product_display_name") or plan.get("product_name")) if plan else None)
        or EMPTY
    )
    if item.get("ooh_type") == "DOOH":
        op = (
            f"{plan['operation_start_time']} ~ {plan['operation_end_time']}"
            if plan and plan.get("operation_start_time") and plan.get("operation_end_time")
            else item.get("operation") or EMPTY
        )
        broadcast = " · ".join(
            v for v in (
                f"영상 {plan['exposure_seconds']}초" if plan and plan.get("exposure_seconds") else None,
                f"일 {plan['daily_broadcasts']:,}회" if plan and plan.get("daily_broadcasts") else None,
            ) if v
        ) or EMPTY
        size = " · ".join(v for v in (item.get("spec"), item.get("resolution")) if v) or EMPTY
        return [
            ("상품", product),
            ("규격 · 해상도", size),
            ("수량", qty),
            ("운영 시간", op),
            ("송출 조건", broadcast),
            ("소재 형식", item.get("material_formats") or EMPTY),
            *place,
        ]
    return [
        ("상품", product),
        ("규격", item.get("spec") or EMPTY),
        ("수량", qty),
        *place,
        ("제작 수", f"{_pos(item.get('production_count'))}회"),
    ]


def build_media(prs, item: dict) -> None:
    """MediaTemplate.tsx 와 같은 배치(1920×1080 px 좌표)."""
    slide = _new_slide(prs)
    _bg(slide, WHITE)
    left, body_top, body_h = 64, 167, 841
    photo_w = 860
    right_l = left + photo_w + 24
    right_w = 1792 - photo_w - 24

    plans = item.get("plans") or []
    plan = next((p for p in plans if p.get("plan_no") == item.get("selected_plan_no")),
                plans[0] if plans else None)
    moving = item.get("media_source") == "MOVING"

    # 머리: 보라 막대 + 매체명 + 분류 칩 / 위치, 오른쪽 집행 기간
    name = item.get("media_name") or item.get("name") or EMPTY
    _round_rect(slide, _px(left), _px(58), _px(6), _px(36), PRIMARY, 3)
    name_w = min(_text_width(name, 40) + 8, 1100)
    _text(slide, _px(left + 22), _px(50), _px(name_w), _px(56), name, size=40, color=GRAY_900,
          bold=True, tight=True, wrap=False, anchor=MSO_ANCHOR.MIDDLE, spacing=-1)
    x = left + 22 + name_w + 20
    chips = [("이동 매체", True)] if moving else []
    chips += [(v, False) for v in (item.get("category"), item.get("ooh_type")) if v]
    for text, accent in chips:
        x += _chip(slide, x, 60, text, accent=accent) + 8
    location = (item.get("operating_area") if moving else item.get("address")) or "위치 정보 없음"
    _text(slide, _px(left + 22), _px(110), _px(1300), _px(26), location, size=18,
          color=GRAY_500, tight=True, wrap=False)
    start = item.get("start_date")
    period = f"{start} ~ {item.get('end_date') or EMPTY}" if start else "시작일 미정"
    _text(slide, _px(1456), _px(58), _px(400), _px(22), "집행 기간", size=15, color=GRAY_500,
          tight=True, wrap=False, align=PP_ALIGN.RIGHT)
    _text(slide, _px(1356), _px(86), _px(500), _px(30), period, size=22, color=GRAY_900,
          bold=True, tight=True, wrap=False, align=PP_ALIGN.RIGHT)

    # 왼쪽: 사진(자르지 않고 전체)
    _media_photo(slide, left, body_top, photo_w, body_h, item.get("thumbnail_url"))

    # 오른쪽 위: 매체 설명(배경·제목 없이, 자르지 않고 전부) + 매체 정보 사양표(2열).
    # 설명이 길면 표가 내려가고 아래 지도·금액 칸이 380 → 최소 260 까지 줄어든다.
    # 그래도 모자라면 설명 글자를 18 → 16 → 14 로 줄인다. 짧아도 3줄 높이는 차지한다.
    facts = _media_facts(item, plan)
    table_h = 25 + 14 + -(-len(facts) // 2) * 64  # 제목 + 사양표
    line_spacing = 1.45  # 화면(1.6)보다 조금 좁게 — PPT 글꼴에 따라 줄 높이가 커져 아래 제목에 붙지 않게
    desc = (item.get("description") or "").strip()
    desc_size, desc_h = 18, 87.0
    for size in (18, 16, 14):
        desc_size = size
        lines = max(3, _wrap_lines(desc, right_w, size)) if desc else 3
        desc_h = max(87.0, lines * size * line_spacing)
        if body_h - 24 - (desc_h + 32 + table_h) >= 260:
            break
    bottom_h = int(min(380, max(260, body_h - 24 - (desc_h + 32 + table_h))))
    top = body_top
    if desc:
        _text(slide, _px(right_l), _px(top), _px(right_w), _px(desc_h), desc, size=desc_size,
              color=GRAY_600, tight=True, line_spacing=line_spacing)
    top += desc_h + 32
    _card_title(slide, right_l, top, right_w, "매체 정보")
    top += 25 + 14
    col_w = (right_w - 40) / 2
    for i, (label, value) in enumerate(facts):
        row, col = divmod(i, 2)
        _spec_row(slide, right_l + col * (col_w + 40), top + row * 64, col_w, label, value,
                  first_row=row == 0)

    # 오른쪽 아래: 지도 + 금액
    half = (right_w - 24) / 2
    bottom_top = body_top + body_h - bottom_h
    settings = get_settings()
    lat, lng = item.get("latitude"), item.get("longitude")
    map_url = None
    if lat is not None and lng is not None and settings.geoapify_api_key:
        map_url = (
            "https://maps.geoapify.com/v1/staticmap"
            f"?style=osm-bright&width={int(half)}&height={bottom_h}&scaleFactor=2"
            f"&center=lonlat:{lng},{lat}&zoom=16"
            f"&marker=lonlat:{lng},{lat};color:%237a3fe0;size:medium"
            f"&apiKey={settings.geoapify_api_key}"
        )
    _map_box(slide, right_l, bottom_top, half, bottom_h, map_url,
             "이동 매체 · 고정 위치 없음" if moving else "위치 정보 없음")
    _price_card(slide, right_l + half + 24, bottom_top, half, bottom_h, item)

    _watermark(slide)


def generate_proposal_ppt(detail: dict, out_path: str) -> int:
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    build_cover(prs, detail)
    build_summary_pages(prs, detail)
    for item in detail.get("items", []):
        build_media(prs, item)
    build_thanks(prs)
    prs.save(out_path)
    return len(prs.slides._sldIdLst)
