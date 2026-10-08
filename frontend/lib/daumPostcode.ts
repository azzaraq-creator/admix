// 카카오(다음) 우편번호 서비스 — 주소 검색 팝업. 키 없이 쓰는 공개 스크립트다.
// https://postcode.map.daum.net/guide

const SCRIPT_ID = "daum-postcode-sdk";
const SCRIPT_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

/** 우편번호 서비스가 돌려주는 값 중 쓰는 것만. */
export interface DaumPostcodeResult {
  /** 도로명 주소 — "서울 강남구 강남대로 396" */
  roadAddress: string;
  /** 지번 주소 — "서울 강남구 역삼동 825" */
  jibunAddress: string;
  /** 지번 주소를 고르지 않았을 때 대신 주는 지번 주소 */
  autoJibunAddress: string;
  /** 사용자가 고른 주소 종류 — R(도로명)·J(지번) */
  userSelectedType: "R" | "J";
  /** 건물명 */
  buildingName: string;
  /** 법정동·법정리 이름 — "역삼동" */
  bname: string;
  /** 시·도 — "서울" */
  sido: string;
  /** 시·군·구 — "강남구" */
  sigungu: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeResult) => void;
      }) => { open: () => void };
    };
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.daum?.Postcode) {
      resolve();
      return;
    }
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("우편번호 서비스를 불러오지 못했습니다.")),
    );
  });
}

/** 주소 검색 팝업을 띄운다. 주소를 고르면 그 값으로, 닫으면 아무것도 하지 않는다. */
export async function openAddressSearch(
  onSelect: (data: DaumPostcodeResult) => void,
): Promise<void> {
  await loadScript();
  if (!window.daum?.Postcode) throw new Error("우편번호 서비스가 없습니다.");
  new window.daum.Postcode({ oncomplete: onSelect }).open();
}
