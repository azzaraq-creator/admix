import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type AccountType = "마스터 계정" | "관리자 계정";
export type AccountStatus = "활성" | "비활성";

export type Account = {
  id: string;
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

export const PERMISSION_KEYS: Record<string, string> = {
  대시보드: "dashboard",
  "광고 매체 관리": "media",
  "회원 관리": "member",
  "비즈니스 관리": "business",
  "FAQ 관리": "faq",
  "계정 관리": "account",
};

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PERMISSION_KEYS).map(([label, key]) => [key, label]),
);

export const accountColumnList: TableColumn<Account>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  { name: "name", label: "이름" },
  { name: "email", label: "이메일(ID)" },
  { name: "type", label: "계정 유형" },
  { name: "role", label: "부서/역할" },
  { name: "status", label: "상태" },
  { name: "createdAt", label: "생성일", className: "text-disabled" },
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
