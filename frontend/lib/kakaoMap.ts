const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
const SCRIPT_ID = "kakao-maps-sdk";

export function loadKakaoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao Maps SDK requires a browser environment"));
      return;
    }
    if (window.kakao?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Kakao Maps SDK load failed")),
      );
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Kakao Maps SDK load failed")),
    );
    document.head.appendChild(script);
  });
}
