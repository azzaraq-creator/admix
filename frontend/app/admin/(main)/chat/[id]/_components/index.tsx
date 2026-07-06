import type { TableColumn } from "@/components/common/Table/CommonTable";

export type ChatRecommendItem = {
  rank: number;
  name: string;
};

export type ChatMessageRow = {
  no: number;
  role: string;
  content: string;
  time: string;
  items?: ChatRecommendItem[];
  matchCount?: number;
};

export const messageColumnList: TableColumn<ChatMessageRow>[] = [
  { name: "no", label: "순번", className: "text-disabled" },
  { name: "role", label: "역할" },
  {
    name: "content",
    label: "대화 내용",
    className: "text-left",
    renderer: (m) => (
      <div
        className={`flex w-full max-w-[520px] flex-col gap-[8px] whitespace-normal break-words text-left${
          m.role === "AI" ? " py-[8px]" : ""
        }`}
      >
        {m.content && <span className="whitespace-pre-line">{m.content}</span>}
        {m.items && m.items.length > 0 && (
          <div className="rounded-[8px] border border-stroke bg-[#f9fafc] p-[10px] text-xs leading-[18px]">
            <span className="font-medium text-disabled">
              추천 매체 {m.matchCount ?? m.items.length}건
              {m.matchCount && m.matchCount > m.items.length
                ? ` 중 ${m.items.length}건 노출`
                : ""}
              :{" "}
            </span>
            <span className="text-black">
              {m.items.map((it) => `${it.rank}. ${it.name}`).join(" / ")}
            </span>
          </div>
        )}
      </div>
    ),
  },
  { name: "time", label: "시간", className: "text-disabled" },
];
