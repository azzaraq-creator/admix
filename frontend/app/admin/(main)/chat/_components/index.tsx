import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type ChatRow = {
  kind: "member" | "guest";
  key: string;
  no: number;
  name: string;
  email: string;
  roomCount: string;
  messageCount: string;
  lastUsedAt: string;
};

export const chatColumnList: TableColumn<ChatRow>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  { name: "name", label: "이름" },
  { name: "email", label: "이메일" },
  { name: "roomCount", label: "대화방 수" },
  { name: "messageCount", label: "메시지 수" },
  { name: "lastUsedAt", label: "마지막 사용일", className: "text-disabled" },
];

export const chatSearchOptionList: SearchOption[] = [
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "이름·이메일로 검색",
    row: 1,
  },
];
