import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";
import { BizStatusBadge, type BizStatus } from "@/lib/bizStatus";
import { formatDateTime } from "@/lib/date";
import { MEMBER_CATEGORIES } from "@/lib/memberCategory";

export type { BizStatus };

export type MemberStatus = "정상" | "탈퇴" | "제재" | "휴면";

export type Member = {
  id: string;
  no: string;
  /** 회원 유형 한글값(광고주/광고 대행사/매체사/일반). */
  category: string;
  loginId: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  bizStatus: BizStatus;
  marketing: "동의" | "비동의";
  status: MemberStatus;
  joinedAt: string;
  /** 마지막 로그인(091) — ISO, 기록이 없으면 null. */
  lastLoginAt: string | null;
};

export const memberColumnList: TableColumn<Member>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  // 칸이 좁아져도 글자 중간에서 끊기지 않게(띄어쓰기에서만 줄바꿈).
  { name: "category", label: "회원 유형", className: "break-keep" },
  { name: "loginId", label: "가입 아이디" },
  { name: "name", label: "이름", className: "break-keep" },
  { name: "email", label: "연락받을 이메일" },
  { name: "phone", label: "전화번호" },
  { name: "company", label: "회사명" },
  {
    name: "bizStatus",
    label: "사업자 인증 상태",
    renderer: (item) => <BizStatusBadge status={item.bizStatus} />,
  },
  { name: "marketing", label: "마케팅 수신" },
  // 마지막 로그인 칸이 붙어 좁아져도 날짜가 두 줄로 갈리지 않게.
  {
    name: "joinedAt",
    label: "가입일",
    className: "whitespace-nowrap text-disabled",
  },
  {
    // 로그인 · 로그인 유지로 토큰을 새로 받은 마지막 시각(2026-11-16 사용자). 가입일과 같은 2026-11-16 꼴에 시각을 붙인다.
    name: "lastLoginAt",
    label: "마지막 로그인",
    className: "whitespace-nowrap text-disabled",
    renderer: (item) => formatDateTime(item.lastLoginAt).replaceAll(".", "-"),
  },
];

export const memberSearchOptionList: SearchOption[] = [
  { type: "dateRange", name: "period", label: "기간", row: 1 },
  {
    type: "select",
    name: "bizStatus",
    label: "사업자 인증 상태",
    row: 1,
    optionList: [
      { label: "미등록", value: "미등록" },
      { label: "검토 대기", value: "검토 대기" },
      { label: "임시 승인", value: "임시 승인" },
      { label: "검토 완료", value: "검토 완료" },
      { label: "인증 반려", value: "인증 반려" },
    ],
  },
  {
    type: "select",
    name: "status",
    label: "상태",
    row: 1,
    optionList: [
      { label: "정상", value: "정상" },
      { label: "탈퇴", value: "탈퇴" },
      { label: "제재", value: "제재" },
      { label: "휴면", value: "휴면" },
    ],
  },
  {
    type: "select",
    name: "category",
    label: "회원 유형",
    row: 2,
    optionList: MEMBER_CATEGORIES.map(({ label }) => ({ label, value: label })),
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "검색조건을 입력해주세요",
    row: 2,
  },
];

