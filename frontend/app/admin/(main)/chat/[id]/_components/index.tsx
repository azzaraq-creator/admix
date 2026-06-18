import type { TableColumn } from "@/components/common/Table/CommonTable";

export type Conversation = {
  id: string;
  title: string;
  date: string;
};

export type ChatMessage = {
  no: number;
  role: "사용자" | "AI";
  content: string;
  time: string;
};

export const messageColumnList: TableColumn<ChatMessage>[] = [
  { name: "no", label: "순번", className: "text-[#737586]" },
  { name: "role", label: "역할" },
  { name: "content", label: "대화 내용" },
  { name: "time", label: "시간", className: "text-[#737586]" },
];

export const CONVERSATIONS: Conversation[] = Array.from(
  { length: 12 },
  (_, i) => ({
    id: String(i + 1),
    title: "홍대에서 광고 추천해줘",
    date: "2026.06.11 14:30",
  }),
);

export const MESSAGES: ChatMessage[] = Array.from({ length: 10 }, (_, i) => {
  const isUser = i % 2 === 0;
  return {
    no: i + 1,
    role: isUser ? "사용자" : "AI",
    content: isUser
      ? "강남역에서 화장품 광고 하고 싶어요"
      : "강남역 일대 추천 매체입니다.",
    time: "2026.06.11 14:32",
  };
});
