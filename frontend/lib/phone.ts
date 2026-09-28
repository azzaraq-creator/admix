// 전화번호 공통 유틸. 02(서울 국번) 포함을 위해 '-' 없는 9~11자리 숫자를 허용한다.
// - 02 지역: 02-XXX-XXXX(9) / 02-XXXX-XXXX(10)
// - 그 외 지역/휴대폰: 0XX-XXX-XXXX(10) / 0XX-XXXX-XXXX(11)

export const PHONE_PATTERN = /^\d{9,11}$/;

export const PHONE_MAX_LENGTH = 11;

/** '-'가 들어간 입력칸 길이 — 숫자 11자리 + '-' 2개. */
export const PHONE_INPUT_MAX_LENGTH = PHONE_MAX_LENGTH + 2;

export const PHONE_ERROR_MESSAGE =
  "전화번호는 '-' 없이 9~11자리 숫자로 입력해 주세요.";

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value);
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("02")) {
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  } else {
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
  }

  return phone;
}

/**
 * 입력 중인 전화번호에 '-'를 넣는다(완성 전에도 자릿수에 맞춰 바로 나눔).
 * 값은 숫자만 받고, 11자리를 넘는 숫자는 버린다.
 * - 02 지역: 02 / 02-XXX / 02-XXX-XXXX(9) / 02-XXXX-XXXX(10)
 * - 그 외: 010 / 010-XXX / 010-XXX-XXXX(10) / 010-XXXX-XXXX(11)
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, PHONE_MAX_LENGTH);

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10)
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
