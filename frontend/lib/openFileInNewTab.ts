/**
 * 파일을 받아 새 탭에 띄운다 — 사진 · PDF 는 새 탭에, 그 밖은 탭을 닫고 내려받는다.
 * 누르는 순간 빈 탭부터 연다: 파일을 다 받은 뒤에 열면 브라우저가 팝업으로 막아 내려받기로 넘어가 버린다
 * (11-11 사용자 "다운로드가 아닌 새 탭으로"). 받지 못하면 탭을 닫고 오류를 그대로 던진다.
 * 어드민 · 광고주 화면이 같이 쓴다(기획안 첨부, 11-12).
 */
export async function openFileInNewTab(
  load: () => Promise<Blob>,
  filename: string,
) {
  const win = window.open("", "_blank");
  if (win) {
    win.document.title = filename;
    win.document.body.textContent = "불러오는 중…";
  }
  let blob: Blob;
  try {
    blob = await load();
  } catch (err) {
    win?.close();
    throw err;
  }
  const url = URL.createObjectURL(blob);
  const viewable =
    blob.type.startsWith("image/") || blob.type === "application/pdf";
  if (win && viewable) {
    win.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  win?.close();
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
