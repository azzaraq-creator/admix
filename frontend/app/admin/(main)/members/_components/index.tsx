import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type MemberType = "기업" | "일반";
export type BizStatus = "미등록" | "검토 대기" | "검토 완료" | "인증 반려";

export type Member = {
  no: string;
  type: MemberType;
  company: string;
  name: string;
  email: string;
  phone: string;
  bizStatus: BizStatus;
  marketing: "동의" | "비동의";
  joinedAt: string;
};

const BIZ_STATUS_CLASS: Record<BizStatus, string> = {
  미등록: "bg-[#f1f5f9] text-[#64748b]",
  "검토 대기": "bg-[#fdf6e3] text-[#c99a2e]",
  "검토 완료": "bg-[#e5f6f6] text-[#007571]",
  "인증 반려": "bg-[#fef2f2] text-[#ef4444]",
};

export function BizStatusBadge({ status }: { status: BizStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] ${BIZ_STATUS_CLASS[status]}`}
    >
      {status}
    </span>
  );
}

export const memberColumnList: TableColumn<Member>[] = [
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "type", label: "회원 유형" },
  { name: "company", label: "회사명" },
  { name: "name", label: "이름" },
  { name: "email", label: "이메일" },
  { name: "phone", label: "전화번호" },
  {
    name: "bizStatus",
    label: "사업자 인증 상태",
    renderer: (item) => <BizStatusBadge status={item.bizStatus} />,
  },
  { name: "marketing", label: "마케팅 수신" },
  { name: "joinedAt", label: "가입일", className: "text-[#737586]" },
];

export const memberSearchOptionList: SearchOption[] = [
  { type: "dateRange", name: "period", label: "기간", row: 1 },
  {
    type: "select",
    name: "bizStatus",
    label: "사업자 인증 상태",
    row: 1,
    optionList: [
      { label: "미인증", value: "미인증" },
      { label: "검토 대기", value: "검토 대기" },
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
    ],
  },
  {
    type: "select",
    name: "type",
    label: "유형",
    row: 2,
    optionList: [
      { label: "일반", value: "일반" },
      { label: "기업", value: "기업" },
    ],
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "검색조건을 입력해주세요",
    row: 2,
  },
];

const BIZ_STATUS_CYCLE: BizStatus[] = [
  "미등록",
  "미등록",
  "검토 대기",
  "검토 대기",
  "검토 완료",
  "검토 완료",
  "인증 반려",
  "인증 반려",
  "인증 반려",
  "검토 완료",
];

export const MEMBER_LIST: Member[] = Array.from({ length: 100 }, (_, i) => {
  const isCompany = i % 10 < 5;
  return {
    no: String(12345 + i),
    type: isCompany ? "기업" : "일반",
    company: isCompany ? "ADMIX" : "-",
    name: "홍길동",
    email: "hong@naver.com",
    phone: "01012345678",
    bizStatus: BIZ_STATUS_CYCLE[i % BIZ_STATUS_CYCLE.length],
    marketing: i % 2 === 0 ? "동의" : "비동의",
    joinedAt: "2025-01-01",
  };
});
