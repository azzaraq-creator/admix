/**
 * 글자를 클립보드에 복사한다.
 * navigator.clipboard 는 안전한 주소(https · localhost)에서만 있어, 사내망 주소(http://192.168.x.x)로 열면 없다
 * (11-17 사용자: "복사 눌러도 복사하지 못했다고 떠"). 그럴 땐 숨긴 입력칸을 골라 execCommand("copy")로 복사한다.
 * 둘 다 안 되면 throw — 부르는 쪽이 "복사하지 못했어요"를 띄운다.
 */
export async function copyText(text: string): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 권한이 막혔으면 아래 옛 방식으로 한 번 더.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  // 화면 밖에 두고(스크롤 · 깜빡임 없게) 고른 뒤 복사한다.
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "-9999px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  const active = document.activeElement as HTMLElement | null;
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } finally {
    document.body.removeChild(area);
    active?.focus?.();
  }
  if (!ok) throw new Error("copy failed");
}
