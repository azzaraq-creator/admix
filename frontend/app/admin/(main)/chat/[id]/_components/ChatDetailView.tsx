"use client";

import { Avatar, Button, Card, Chip, ListBox, Switch } from "@heroui/react";
import { ArrowLeft, FolderPlus, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { MixieMarkdown } from "@/app/(client)/(main)/fixed/_components/chat/MixieMarkdown";
import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import type { AdMessageOut, AdSessionDetail } from "@/hooks/adSessions";
import {
  type AdUserSession,
  useAdminChatSession,
  useAdminChatUser,
} from "@/hooks/adminChat";
import { formatAdFee } from "@/lib/media";
import { cn } from "@/lib/utils";

import {
  formatChatDateTime,
  formatChatTime,
  MEMBERSHIP_LABEL,
} from "../../_components/chatFormat";

/** 믹시가 추천한 매체 한 개 — 대화 기록(payload.items)에 남은 값. */
type RecommendItem = {
  media_id?: string;
  name?: string;
  address?: string;
  category_large?: string;
  category_small?: string;
  thumbnail_url?: string;
  min_advertisement_fee_krw?: number | null;
};

type Payload = {
  type?: "list" | "chat" | "proposal" | "proposal_choices";
  items?: RecommendItem[];
  match_count?: number;
  proposal?: { id: string; name: string };
  added_media_names?: string[];
  picked?: { id: string; name: string } | null;
};

export function ChatDetailView() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const key =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";
  const kind = searchParams.get("kind") === "member" ? "member" : "guest";

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex items-center gap-[12px]">
        <Button
          isIconOnly
          variant="tertiary"
          aria-label="목록으로"
          onPress={() => router.push("/admin/chat")}
        >
          <ArrowLeft className="size-[18px]" />
        </Button>
        <h1 className="text-2xl font-bold leading-[32px] text-black">
          AI 채팅 상세
        </h1>
      </div>

      {kind === "member" ? (
        <MemberDetail userId={key} />
      ) : (
        <GuestDetail sessionId={key} />
      )}
    </div>
  );
}

/** 맨 위 사람 카드 — 이름·구분·이메일과 대화방·메시지 수. */
function ProfileCard({
  name,
  member,
  membership,
  email,
  stats,
}: {
  name: string;
  member: boolean;
  membership?: string | null;
  email?: string | null;
  stats: { label: string; value: number }[];
}) {
  return (
    <Card className="flex-row items-center gap-[20px] border border-stroke px-[24px] py-[20px] shadow-none">
      <Avatar className="size-[56px] shrink-0">
        <Avatar.Fallback className="bg-[#f3f4f8]">
          <UserRound className="size-[26px] text-[#767676]" />
        </Avatar.Fallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
        <div className="flex items-center gap-[8px]">
          <p className="truncate text-[20px] font-semibold leading-[28px] text-black">
            {name}
          </p>
          <Chip size="sm" color={member ? "accent" : "default"}>
            {member ? "회원" : "비회원"}
          </Chip>
          {membership && (
            <Chip size="sm">{MEMBERSHIP_LABEL[membership] ?? membership}</Chip>
          )}
        </div>
        {email && <p className="text-sm text-[#555b73]">{email}</p>}
      </div>
      <div className="flex shrink-0 gap-[28px]">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-end gap-[2px]">
            <span className="text-xs text-disabled">{s.label}</span>
            <span className="text-[20px] font-bold tabular-nums text-black">
              {s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GuestDetail({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useAdminChatSession(sessionId);
  const count = data?.messages.length ?? 0;
  return (
    <>
      <ProfileCard
        name="비회원"
        member={false}
        stats={[{ label: "메시지", value: count }]}
      />
      <Transcript detail={data} isLoading={isLoading} />
    </>
  );
}

function MemberDetail({ userId }: { userId: string }) {
  const { data, isLoading } = useAdminChatUser(userId);
  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shown = hideEmpty
    ? sessions.filter((s) => s.message_count > 0)
    : sessions;
  // 처음엔 메시지가 있는 가장 최근 대화를 연다(빈 "새 추천"이 먼저 열리지 않게).
  const activeId =
    selectedId ??
    sessions.find((s) => s.message_count > 0)?.id ??
    sessions[0]?.id ??
    null;
  const { data: detail, isLoading: detailLoading } =
    useAdminChatSession(activeId);
  const totalMessages = sessions.reduce((n, s) => n + s.message_count, 0);
  const emptyCount =
    sessions.length - sessions.filter((s) => s.message_count > 0).length;

  return (
    <>
      <ProfileCard
        name={data?.name ?? (isLoading ? "불러오는 중…" : "회원")}
        member
        membership={data?.membership}
        email={data?.email}
        stats={[
          { label: "대화방", value: sessions.length },
          { label: "메시지", value: totalMessages },
        ]}
      />

      <div className="flex items-start gap-[20px]">
        <Card className="sticky top-[24px] w-[320px] shrink-0 gap-0 border border-stroke p-0 shadow-none">
          <div className="flex flex-col gap-[10px] border-b border-stroke px-[20px] py-[16px]">
            <p className="text-base font-semibold text-black">
              대화 목록{" "}
              <span className="tabular-nums text-disabled">{shown.length}</span>
            </p>
            {emptyCount > 0 && (
              <Switch
                size="sm"
                className="[--switch-control-bg-checked:var(--color-primary)] [--switch-control-bg-checked-hover:var(--color-primary-600)]"
                isSelected={hideEmpty}
                onChange={setHideEmpty}
              >
                <Switch.Content>
                  <Switch.Control>
                    {/* 켜져도 손잡이는 흰색 — 테마 기본은 진한 색이라 검게 보인다. */}
                    <Switch.Thumb className="bg-white!" />
                  </Switch.Control>
                  <span className="text-xs text-[#555b73]">
                    메시지 없는 대화 숨기기 ({emptyCount})
                  </span>
                </Switch.Content>
              </Switch>
            )}
          </div>
          <div className="max-h-[calc(100dvh-320px)] min-h-[200px] overflow-y-auto p-[8px]">
            <ListBox
              aria-label="대화 목록"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={activeId ? [activeId] : []}
              onSelectionChange={(keys) => {
                const [next] = keys === "all" ? [] : [...keys];
                if (next != null) setSelectedId(String(next));
              }}
              items={shown}
              renderEmptyState={() => (
                <p className="px-[12px] py-[10px] text-sm text-disabled">
                  {isLoading ? "불러오는 중…" : "대화 내역이 없습니다."}
                </p>
              )}
            >
              {(s) => <SessionItem session={s} />}
            </ListBox>
          </div>
        </Card>

        <div className="min-w-0 flex-1">
          <Transcript detail={detail} isLoading={detailLoading} />
        </div>
      </div>
    </>
  );
}

function SessionItem({ session }: { session: AdUserSession }) {
  const empty = session.message_count === 0;
  return (
    <ListBox.Item
      id={session.id}
      textValue={session.title || "제목 없음"}
      className="flex-col items-start gap-[4px] rounded-[10px] px-[12px] py-[12px] data-[selected=true]:bg-primary-50"
    >
      <p
        className={cn(
          "w-full truncate text-sm font-semibold leading-[20px]",
          empty ? "text-disabled" : "text-black",
        )}
      >
        {session.title || "제목 없음"}
      </p>
      <p className="text-xs leading-[16px] text-disabled tabular-nums">
        {formatChatDateTime(session.updated_at)} · 메시지{" "}
        {session.message_count}
      </p>
    </ListBox.Item>
  );
}

/** 대화 내용 — 사용자는 오른쪽, 믹시는 왼쪽 말풍선. 추천 매체는 카드로. */
function Transcript({
  detail,
  isLoading,
}: {
  detail?: AdSessionDetail;
  isLoading: boolean;
}) {
  const messages = detail?.messages ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  // 다른 대화를 열면 맨 위로.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [detail?.id]);

  return (
    <Card className="gap-0 border border-stroke p-0 shadow-none">
      <div className="flex items-center justify-between gap-[12px] border-b border-stroke px-[24px] py-[16px]">
        <p className="min-w-0 truncate text-base font-semibold text-black">
          {detail?.title || (isLoading ? "불러오는 중…" : "대화")}
        </p>
        {detail && (
          <p className="shrink-0 text-xs text-disabled tabular-nums">
            {formatChatDateTime(detail.created_at)} 시작 · 메시지{" "}
            {messages.length}
          </p>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex max-h-[calc(100dvh-260px)] min-h-[320px] flex-col gap-[18px] overflow-y-auto bg-[#fafafc] px-[24px] py-[24px]"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {messages.length === 0 && (
          <p className="m-auto text-sm text-disabled">
            {isLoading ? "불러오는 중…" : "메시지가 없습니다."}
          </p>
        )}
      </div>
    </Card>
  );
}

// 추천 매체는 처음에 이만큼만 보이고 나머지는 [나머지 보기]로 편다(대화가 너무 길어지지 않게).
const RECOMMEND_PREVIEW = 6;

function MessageBubble({ message }: { message: AdMessageOut }) {
  const payload = (message.payload ?? {}) as Payload;
  const time = formatChatTime(message.created_at);
  const [showAll, setShowAll] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-[4px]">
        <div className="max-w-[70%] whitespace-pre-line break-words rounded-[16px] rounded-br-[4px] bg-primary px-[14px] py-[10px] text-sm leading-[20px] text-white">
          {message.content || "-"}
        </div>
        <span className="text-[11px] text-disabled tabular-nums">{time}</span>
      </div>
    );
  }

  const items = payload.items ?? [];
  return (
    <div className="flex gap-[10px]">
      <Avatar size="sm" className="size-[32px] shrink-0">
        <Avatar.Fallback className="bg-primary-50">
          <Sparkles className="size-[16px] text-primary" />
        </Avatar.Fallback>
      </Avatar>
      <div className="flex min-w-0 max-w-[85%] flex-col gap-[6px]">
        <span className="text-xs font-semibold text-[#555b73]">믹시</span>
        {message.content && (
          <div className="rounded-[16px] rounded-tl-[4px] border border-stroke bg-white px-[14px] py-[10px]">
            <MixieMarkdown className="text-sm leading-[20px] sm:text-sm sm:leading-[20px]">
              {message.content}
            </MixieMarkdown>
          </div>
        )}
        {items.length > 0 && (
          <div className="flex flex-col gap-[6px]">
            <span className="text-xs text-disabled">
              추천 매체 {(payload.match_count ?? items.length).toLocaleString()}
              건
              {payload.match_count && payload.match_count > items.length
                ? ` 중 ${items.length}건 보여 줌`
                : ""}
            </span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[8px]">
              {(showAll ? items : items.slice(0, RECOMMEND_PREVIEW)).map(
                (it, i) => (
                  <RecommendCard
                    key={`${it.media_id}-${i}`}
                    rank={i + 1}
                    item={it}
                  />
                ),
              )}
            </div>
            {items.length > RECOMMEND_PREVIEW && (
              <Button
                size="sm"
                variant="tertiary"
                className="w-fit"
                onPress={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? "접기"
                  : `나머지 ${items.length - RECOMMEND_PREVIEW}개 보기`}
              </Button>
            )}
          </div>
        )}
        {payload.type === "proposal" && payload.proposal && (
          <ProposalTag
            id={payload.proposal.id}
            text={`기획안 '${payload.proposal.name}'에 담음${
              payload.added_media_names?.length
                ? ` · ${payload.added_media_names.join(", ")}`
                : ""
            }`}
          />
        )}
        {payload.type === "proposal_choices" && payload.picked && (
          <ProposalTag
            id={payload.picked.id}
            text={`기획안 '${payload.picked.name}' 선택`}
          />
        )}
        <span className="text-[11px] text-disabled tabular-nums">{time}</span>
      </div>
    </div>
  );
}

function RecommendCard({ rank, item }: { rank: number; item: RecommendItem }) {
  const category = [item.category_large, item.category_small]
    .filter(Boolean)
    .join(" › ");
  const body = (
    <Card className="flex-row items-center gap-[10px] border border-stroke p-[8px] shadow-none transition-colors hover:border-primary">
      <MediaThumbnail
        src={item.thumbnail_url ?? undefined}
        sizes="56px"
        className="size-[56px] shrink-0 rounded-[8px]"
      />
      <div className="flex min-w-0 flex-col gap-[2px]">
        <p className="truncate text-sm font-semibold text-black">
          <span className="mr-[4px] text-primary tabular-nums">{rank}</span>
          {item.name ?? "(매체명 없음)"}
        </p>
        {category && (
          <p className="truncate text-xs text-[#555b73]">{category}</p>
        )}
        <p className="truncate text-xs text-disabled">
          {formatAdFee(item.min_advertisement_fee_krw ?? null)}
          {item.address ? ` · ${item.address}` : ""}
        </p>
      </div>
    </Card>
  );
  return item.media_id ? (
    <Link href={`/admin/media/${item.media_id}`} title="어드민 매체 상세 열기">
      {body}
    </Link>
  ) : (
    body
  );
}

function ProposalTag({ id, text }: { id: string; text: string }) {
  return (
    <Link href={`/admin/proposals/${id}`} className="w-fit hover:opacity-80">
      <Chip color="accent" variant="soft" className="gap-[6px] font-semibold">
        <FolderPlus className="size-[14px]" />
        {text}
      </Chip>
    </Link>
  );
}
