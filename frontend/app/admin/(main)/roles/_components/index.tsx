import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type AccountType = "마스터 계정" | "관리자 계정";
export type AccountStatus = "활성" | "비활성";

export type Account = {
  no: string;
  name: string;
  email: string;
  type: AccountType;
  role: string;
  status: AccountStatus;
  createdAt: string;
};

export const ACCOUNT_TYPE_OPTIONS = [
  { label: "마스터 계정", value: "마스터 계정" },
  { label: "관리자 계정", value: "관리자 계정" },
];

export const ACCOUNT_STATUS_OPTIONS = [
  { label: "활성", value: "활성" },
  { label: "비활성", value: "비활성" },
];

export const PERMISSIONS = [
  "대시보드",
  "광고 매체 관리",
  "회원 관리",
  "비즈니스 관리",
  "FAQ 관리",
  "계정 관리",
];

export const accountColumnList: TableColumn<Account>[] = [
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "name", label: "이름" },
  { name: "email", label: "이메일(ID)" },
  { name: "type", label: "계정 유형" },
  { name: "role", label: "부서/역할" },
  { name: "status", label: "상태" },
  { name: "createdAt", label: "생성일", className: "text-[#737586]" },
];

export const accountSearchOptionList: SearchOption[] = [
  { type: "dateRange", name: "period", label: "기간", row: 1 },
  {
    type: "select",
    name: "type",
    label: "계정 유형",
    row: 1,
    optionList: ACCOUNT_TYPE_OPTIONS,
  },
  {
    type: "select",
    name: "status",
    label: "상태",
    row: 1,
    optionList: ACCOUNT_STATUS_OPTIONS,
  },
  {
    type: "select",
    name: "searchType",
    label: "검색어",
    row: 2,
    optionList: [
      { label: "이름", value: "이름" },
      { label: "이메일(ID)", value: "이메일(ID)" },
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

const TEMPLATES: Omit<Account, "no" | "createdAt">[] = [
  { name: "홍길동", email: "hong@gmail.com", type: "마스터 계정", role: "대표", status: "활성" },
  { name: "김유진", email: "yujin.kim@example.com", type: "관리자 계정", role: "팀장", status: "활성" },
  { name: "박서준", email: "seojun.park@example.com", type: "관리자 계정", role: "개발자", status: "비활성" },
  { name: "이민아", email: "mina.lee@example.com", type: "마스터 계정", role: "기획자", status: "활성" },
  { name: "최준호", email: "junho.choi@example.com", type: "관리자 계정", role: "디자이너", status: "활성" },
  { name: "한지민", email: "jimin.han@example.com", type: "관리자 계정", role: "마케팅", status: "비활성" },
  { name: "정우성", email: "woosung.jeong@example.com", type: "마스터 계정", role: "대표", status: "활성" },
  { name: "서지혜", email: "jihye.seo@example.com", type: "관리자 계정", role: "기획자", status: "활성" },
  { name: "강민호", email: "minho.kang@example.com", type: "관리자 계정", role: "개발자", status: "비활성" },
  { name: "윤서현", email: "seohyun.yoon@example.com", type: "마스터 계정", role: "디자이너", status: "활성" },
];
const DATES = [
  "2025-01-01", "2025-12-15", "2024-11-20", "2025-05-30", "2025-08-10",
  "2024-09-05", "2025-02-14", "2025-07-01", "2024-10-22", "2025-04-18",
];

export const ACCOUNT_LIST: Account[] = Array.from({ length: 100 }, (_, i) => ({
  no: String(12345 + i),
  ...TEMPLATES[i % TEMPLATES.length],
  createdAt: DATES[i % DATES.length],
}));
