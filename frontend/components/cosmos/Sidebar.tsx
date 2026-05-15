"use client";

import { BookOpen, Megaphone } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  useAdSessions,
  useCreateAdSession,
  useDeleteAdSession,
} from "@/hooks/adSessions";

const NAV = [
  { href: "/ad-recommend", label: "광고 매체 추천", icon: Megaphone },
  { href: "/overview", label: "시스템 소개", icon: BookOpen },
];

function RecentSessions() {
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("id");
  const { data: sessions } = useAdSessions();
  const remove = useDeleteAdSession();

  if (!sessions || sessions.length === 0) {
    return (
      <p className="px-2 py-2 leading-relaxed text-[12px] text-[var(--text-quaternary)]">
        최근 추천이 없습니다.
        <br />
        새 대화를 시작해보세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-1">
      {sessions.map((s) => {
        const active = activeId === s.id;
        return (
          <div
            key={s.id}
            className={
              "group flex items-center gap-1 rounded-[8px] border border-transparent px-2 py-1.5 transition-all duration-150 " +
              (active
                ? "border-[rgba(165,180,252,0.16)] bg-[rgba(124,58,237,0.12)]"
                : "hover:bg-white/5")
            }
          >
            <button
              type="button"
              onClick={() => router.push(`/ad-recommend?id=${s.id}`)}
              className={
                "flex-1 truncate text-left text-[12px] " +
                (active
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")
              }
            >
              {s.title}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("삭제할까요?")) {
                  remove.mutate(s.id, {
                    onSuccess: () => {
                      if (active) router.push("/ad-recommend");
                    },
                  });
                }
              }}
              className="text-[10px] text-[var(--text-tertiary)] opacity-0 transition group-hover:opacity-100"
              aria-label="세션 삭제"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const createSession = useCreateAdSession();

  const onNewSession = () => {
    createSession.mutate(undefined, {
      onSuccess: (s) => router.push(`/ad-recommend?id=${s.id}`),
    });
  };

  return (
    <aside className="relative z-10 flex h-screen w-[260px] flex-col gap-4 border-r border-[var(--stroke-subtle)] bg-gradient-to-b from-[rgba(10,11,26,0.7)] to-[rgba(10,11,26,0.5)] px-3.5 py-4 backdrop-blur-xl">
      <Link
        href="/ad-recommend"
        className="flex items-center gap-3 px-2 py-1 text-[var(--text-primary)] no-underline"
      >
        <div className="grid h-8 w-8 place-items-center">
          <div className="orb h-[26px] w-[26px]" />
        </div>
        <div className="font-display text-[22px] font-normal tracking-wide">
          OOH<em className="not-italic text-[var(--accent-cosmos)]">·</em>Recommend
        </div>
      </Link>

      <div className="px-2.5 pt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        Workspace
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-2.5 rounded-[10px] border border-transparent px-3 py-2.5 text-[13px] no-underline transition-all duration-150 " +
                (active
                  ? "border-[rgba(165,180,252,0.16)] bg-[rgba(124,58,237,0.12)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]")
              }
            >
              <Icon
                size={16}
                className={
                  active
                    ? "text-[var(--accent-cosmos)]"
                    : "text-[var(--text-tertiary)]"
                }
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between px-2.5 pt-3">
        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Recent
        </div>
        <button
          type="button"
          onClick={onNewSession}
          disabled={createSession.isPending}
          className="text-[11px] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          + 새 대화
        </button>
      </div>
      <div className="cosmos-scroll min-h-0 flex-1 overflow-y-auto">
        <Suspense
          fallback={
            <p className="px-2 py-2 text-[12px] text-[var(--text-quaternary)]">
              로딩...
            </p>
          }
        >
          <RecentSessions />
        </Suspense>
      </div>
    </aside>
  );
}
