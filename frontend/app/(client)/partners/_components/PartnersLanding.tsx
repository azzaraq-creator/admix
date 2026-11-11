"use client";

import Link from "next/link";

import { PartnersIcon, LocationIcon } from "@/components/icons";
import { LOGIN_HREF } from "@/app/(client)/(main)/_components/useLoginModal";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "./workspace/workspaceUi";

/*
 * /partners 비회원 화면 — 매장에 보내는 가입 링크가 이 주소다.
 * 제휴사(콜라보)로 가입하면 무엇을 할 수 있는지 소개하고, 실제 화면 대신 예시(그림처럼 만든 카드)를 보여 준다.
 * 콜라보를 못 쓰는 회원(일반·대행사·매체사)도 ?intro=1 로 본다 — 그때는 가입 대신 회원 유형 바꾸기를 권한다(member).
 */

const SAMPLE_STORES = [
  {
    name: "오늘의 커피 성수점",
    address: "서울 성동구 연무장길 12",
    tags: ["감성인테리어", "포토존", "디저트맛집"],
    color: "from-amber-200 to-orange-300",
  },
  {
    name: "브루잉랩 합정",
    address: "서울 마포구 양화로 45",
    tags: ["로스터리", "커피맛집"],
    color: "from-stone-200 to-amber-400",
  },
  {
    name: "루프탑 하늘",
    address: "서울 용산구 이태원로 210",
    tags: ["루프탑", "뷰맛집", "넓은공간"],
    color: "from-sky-200 to-indigo-300",
  },
];

const BENEFITS = [
  {
    title: "매장 등록은 admix가",
    body: "기본협약을 맺으면 admix 담당자가 매장 사진 · 정보를 올리고 계정에 연결해 드려요.",
  },
  {
    title: "광고주에게 노출",
    body: "admix 매체 찾기 지도에 '콜라보'로 매장이 보여요.",
  },
  {
    title: "콜라보 기회",
    body: "광고주가 매장 사진 · 어필 포인트를 보고 콜라보할 매장를 찾아요.",
  },
];

export function PartnersLanding({ member = false }: { member?: boolean }) {
  // 회원은 이미 가입했으니 회원 정보에서 유형을 바꾸게 한다.
  const cta = member
    ? { href: "/profile", label: "회원 유형 바꾸기" }
    : { href: "/partners/join", label: "제휴사(콜라보)로 가입하기" };
  return (
    <div className="flex flex-col gap-[32px] sm:gap-[48px]">
      {/* 소개 */}
      <section className="flex flex-col items-center gap-[14px] pt-[16px] text-center sm:pt-[32px]">
        <span className="flex items-center gap-[6px] rounded-full bg-primary-50 px-[12px] py-[4px] text-[12px] font-semibold text-primary sm:text-[13px]">
          <PartnersIcon className="size-[14px]" />
          admix 콜라보
        </span>
        <h1 className="text-[26px] leading-[1.3] font-bold break-keep text-gray-900 sm:text-[40px]">
          매장과 광고주가
          <br className="sm:hidden" /> 함께 만드는 콜라보
        </h1>
        <p className="max-w-[560px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[16px]">
          매장은 공간을 등록해 광고주에게 알리고, 광고주는 기획안을 올려 함께할
          매장을 찾아요. admix 지도 위에서 서로를 찾고 콜라보를 시작해 보세요.
        </p>
        <div className="mt-[6px] flex flex-wrap justify-center gap-[8px]">
          <Link
            href={cta.href}
            className="flex h-[46px] items-center rounded-[20px] bg-primary px-[22px] text-[15px] font-bold text-white shadow-[0px_10px_20px_rgba(163,59,209,0.25)]"
          >
            {cta.label}
          </Link>
          {!member && (
            <Link
              href={LOGIN_HREF}
              className="flex h-[46px] items-center rounded-[20px] border border-gray-200 bg-surface px-[22px] text-[15px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              이미 회원이에요
            </Link>
          )}
        </div>
      </section>

      {/* 할 수 있는 것 */}
      <section className="grid gap-[12px] sm:grid-cols-3 sm:gap-[16px]">
        {BENEFITS.map((b, i) => (
          <div
            key={b.title}
            className={cn(
              "rounded-[20px] border p-[18px] sm:p-[22px]",
              GLASS_CARD,
            )}
          >
            <p className="text-[12px] font-bold text-primary">STEP {i + 1}</p>
            <p className="mt-[4px] text-[16px] font-bold text-gray-900">
              {b.title}
            </p>
            <p className="mt-[6px] text-[13px] leading-[1.6] break-keep text-gray-500">
              {b.body}
            </p>
          </div>
        ))}
      </section>

      {/* 예시 화면 */}
      <section className="flex flex-col gap-[16px]">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900 sm:text-[22px]">
            이렇게 보여요
          </h2>
          <p className="mt-[4px] text-[13px] text-gray-500 sm:text-[14px]">
            가입 후 쓰게 될 화면의 예시예요.
          </p>
        </div>
        <div className="grid gap-[16px] lg:grid-cols-2">
          <ExampleFrame label="예시 1 · 매장 대시보드">
            <div className="flex flex-col gap-[10px]">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-gray-900">내 매장</p>
                <span className="rounded-[11px] bg-primary px-[10px] py-[4px] text-[11px] font-semibold text-white">
                  + 매장 추가
                </span>
              </div>
              <div className="grid grid-cols-3 gap-[8px]">
                {[
                  ["등록 매장", "1곳"],
                  ["매체 찾기 노출", "공개 중"],
                  ["매장 사진", "8 / 9장"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[12px] bg-gray-50 p-[10px]">
                    <p className="text-[10px] text-gray-500">{k}</p>
                    <p className="mt-[2px] text-[13px] font-bold text-gray-900">
                      {v}
                    </p>
                  </div>
                ))}
              </div>
              <SampleCard store={SAMPLE_STORES[0]} wide />
            </div>
          </ExampleFrame>
          <ExampleFrame label="예시 2 · 매체 찾기 지도">
            <div className="relative h-full min-h-[220px] overflow-hidden rounded-[14px] bg-[linear-gradient(135deg,#eef2f7_25%,#e6ebf2_25%,#e6ebf2_50%,#eef2f7_50%,#eef2f7_75%,#e6ebf2_75%)] bg-[length:28px_28px]">
              <div className="absolute top-[12px] left-[12px] flex gap-[4px] text-[10px]">
                {["전체", "빌보드", "쉘터", "콜라보"].map((t) => (
                  <span
                    key={t}
                    className={cn(
                      "rounded-full px-[8px] py-[3px] font-semibold",
                      t === "콜라보"
                        ? "bg-gray-900 text-white dark:bg-gray-300 dark:text-gray-900"
                        : "bg-white text-gray-600 dark:bg-surface",
                    )}
                  >
                    {t}
                  </span>
                ))}
              </div>
              {[
                ["32%", "45%"],
                ["60%", "30%"],
                ["70%", "65%"],
              ].map(([left, top]) => (
                <span
                  key={left}
                  className="absolute flex size-[28px] items-center justify-center rounded-full bg-amber-700/80 text-white shadow"
                  style={{ left, top }}
                >
                  <PartnersIcon className="size-[15px]" />
                </span>
              ))}
              <div className="absolute right-[12px] bottom-[12px] left-[12px] flex items-center gap-[10px] rounded-[14px] bg-white p-[10px] shadow-lg sm:left-auto sm:w-[260px]">
                <span
                  className={cn(
                    "size-[48px] shrink-0 rounded-[10px] bg-gradient-to-br",
                    SAMPLE_STORES[1].color,
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-gray-900">
                    {SAMPLE_STORES[1].name}
                  </p>
                  <p className="flex items-center gap-[2px] truncate text-[11px] text-gray-500">
                    <LocationIcon className="size-[10px]" />
                    {SAMPLE_STORES[1].address}
                  </p>
                  <p className="text-[11px] font-semibold text-primary">
                    #로스터리 #커피맛집
                  </p>
                </div>
              </div>
            </div>
          </ExampleFrame>
          <ExampleFrame
            label="예시 3 · 광고주가 보는 콜라보 매장 목록"
            className="lg:col-span-2"
          >
            <div className="grid gap-[10px] sm:grid-cols-3">
              {SAMPLE_STORES.map((s) => (
                <SampleCard key={s.name} store={s} />
              ))}
            </div>
          </ExampleFrame>
        </div>
      </section>

      <section className="flex flex-col items-center gap-[10px] rounded-[24px] bg-gray-900 px-[20px] py-[28px] text-center sm:py-[36px] dark:bg-gray-100">
        <p className="text-[18px] font-bold text-white sm:text-[22px]">
          지금 제휴사로 함께해 보세요
        </p>
        <p className="text-[13px] text-white/70 sm:text-[14px]">
          {member
            ? "회원 유형을 제휴사(콜라보)로 바꾸고 기본협약을 맺으면 담당자가 매장을 연결해 드려요."
            : "가입하고 사업자등록증 · 기본협약을 마치면 담당자가 매장을 연결해 드려요."}
        </p>
        <Link
          href={cta.href}
          className="mt-[6px] flex h-[44px] items-center rounded-[19px] bg-primary px-[22px] text-[14px] font-bold text-white"
        >
          {cta.label}
        </Link>
      </section>
    </div>
  );
}

function ExampleFrame({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "flex flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-surface",
        className,
      )}
    >
      <div className="flex items-center gap-[6px] border-b border-gray-100 bg-gray-50 px-[14px] py-[8px]">
        <span className="size-[8px] rounded-full bg-red-300" />
        <span className="size-[8px] rounded-full bg-amber-300" />
        <span className="size-[8px] rounded-full bg-green-300" />
        <figcaption className="ml-[6px] text-[12px] font-semibold text-gray-500">
          {label}
        </figcaption>
      </div>
      {/* 예시라 누르지 않게 한다. */}
      <div
        aria-hidden
        className="pointer-events-none flex-1 p-[14px] select-none"
      >
        {children}
      </div>
    </figure>
  );
}

function SampleCard({
  store,
  wide = false,
}: {
  store: (typeof SAMPLE_STORES)[number];
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-gray-200",
        wide && "flex",
      )}
    >
      <div
        className={cn(
          "bg-gradient-to-br",
          store.color,
          wide ? "w-[110px] shrink-0" : "aspect-[2/1] sm:aspect-[4/3]",
        )}
      />
      <div className="flex min-w-0 flex-col gap-[4px] p-[10px]">
        <p className="truncate text-[13px] font-bold text-gray-900">
          {store.name}
        </p>
        <p className="truncate text-[11px] text-gray-500">{store.address}</p>
        <div className="flex flex-wrap gap-[3px]">
          {store.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-primary-50 px-[6px] py-[1px] text-[10px] font-semibold text-primary"
            >
              #{t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
