import type { TableColumn } from "@/components/common/Table/CommonTable";

export type ChatRecommendItem = {
  rank: number;
  name: string;
  price: string;
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
  { name: "no", label: "순번", className: "text-[#737586]" },
  { name: "role", label: "역할" },
  {
    name: "content",
    label: "대화 내용",
    className: "text-left",
    renderer: (m) => (
      <div className="flex flex-col gap-[8px]">
        {m.content && <span className="whitespace-pre-line">{m.content}</span>}
        {m.items && m.items.length > 0 && (
          <div className="flex flex-col gap-[4px] rounded-[8px] border border-stroke bg-[#f9fafc] p-[10px]">
            <span className="text-xs font-medium text-[#737586]">
              추천 매체 {m.matchCount ?? m.items.length}건
              {m.matchCount && m.matchCount > m.items.length
                ? ` 중 ${m.items.length}건 노출`
                : ""}
            </span>
            {m.items.map((it) => (
              <div
                key={it.rank}
                className="flex items-center justify-between gap-[12px] text-xs"
              >
                <span className="min-w-0 truncate text-black">
                  {it.rank}. {it.name}
                </span>
                <span className="shrink-0 tabular-nums text-[#737586]">
                  {it.price}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
  },
  { name: "time", label: "시간", className: "text-[#737586]" },
];
