import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type ChatUser = {
  no: string;
  name: string;
  email: string;
  roomCount: string;
  messageCount: string;
  lastUsedAt: string;
};

export const chatColumnList: TableColumn<ChatUser>[] = [
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "name", label: "이름" },
  { name: "email", label: "이메일" },
  { name: "roomCount", label: "대화방 수" },
  { name: "messageCount", label: "메시지 수" },
  { name: "lastUsedAt", label: "마지막 사용일", className: "text-[#737586]" },
];

export const chatSearchOptionList: SearchOption[] = [
  { type: "dateRange", name: "period", label: "기간", row: 1 },
  {
    type: "select",
    name: "searchType",
    label: "검색",
    row: 2,
    optionList: [
      { label: "아이디", value: "아이디" },
      { label: "이름", value: "이름" },
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

const COUNT_CYCLE = ["12", "342", "1,234", "1,234", "1,234"];

export const CHAT_LIST: ChatUser[] = Array.from({ length: 100 }, (_, i) => {
  const count = COUNT_CYCLE[i % COUNT_CYCLE.length];
  return {
    no: "12345",
    name: "홍길동",
    email: "hong@naver.com",
    roomCount: count,
    messageCount: count,
    lastUsedAt: "2025-01-01",
  };
});
