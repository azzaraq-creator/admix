/**
 * 올리기 전에 브라우저에서 사진을 줄인다 — 긴 변이 maxSide 보다 크면 canvas 로 줄여 JPEG 로 다시 만든다.
 * 서버도 같은 크기로 한 번 더 줄이지만(partners_service.upload_image), 휴대폰 원본(5~10MB)을 그대로 보내지 않게 한다.
 * 작은 사진 · GIF · 읽지 못하는 파일은 그대로 돌려준다.
 */
export async function shrinkImage(
  file: File,
  {
    maxSide = 2000,
    quality = 0.85,
  }: { maxSide?: number; quality?: number } = {},
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= maxSide && file.size <= 1.5 * 1024 * 1024) return file;
    const scale = Math.min(1, maxSide / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // 투명 PNG 는 흰 바탕으로(JPEG 는 투명을 못 담는다).
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
