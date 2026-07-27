import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";
import { BizStatusBadge, type BizStatus } from "@/lib/bizStatus";

export type { BizStatus };

export type MemberType = "기업" | "일반";
export type MemberStatus = "정상" | "탈퇴" | "제재" | "휴면";

export type Member = {
  id: string;
  no: string;
  type: MemberType;
  loginId: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  bizStatus: BizStatus;
  marketing: "동의" | "비동의";
  status: MemberStatus;
  joinedAt: string;
};

export const memberColumnList: TableColumn<Member>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  { name: "type", label: "회원 유형" },
  { name: "loginId", label: "가입 아이디" },
  { name: "name", label: "이름" },
  { name: "email", label: "연락받을 이메일" },
  { name: "phone", label: "전화번호" },
  { name: "company", label: "회사명" },
  {
    name: "bizStatus",
    label: "사업자 인증 상태",
    renderer: (item) => <BizStatusBadge status={item.bizStatus} />,
  },
  { name: "marketing", label: "마케팅 수신" },
  { name: "joinedAt", label: "가입일", className: "text-disabled" },
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

