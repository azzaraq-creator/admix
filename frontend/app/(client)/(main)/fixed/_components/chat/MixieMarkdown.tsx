"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * 믹시 답변 본문. 답변이 마크다운(굵게·목록·링크 등)으로 오므로 그대로 렌더한다.
 * 이전엔 whitespace-pre-line으로 줄바꿈만 살렸는데, remark-breaks로 한 줄 바꿈도
 * 그대로 유지해 기존 답변 모양이 달라지지 않게 한다. 원본 HTML은 렌더하지 않는다(기본값).
 */
export function MixieMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 text-[16px] leading-[22px] break-words text-black sm:text-base sm:leading-[24px]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => (
            <p className="[&:not(:first-child)]:mt-[8px]">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="mt-[6px] list-disc space-y-[2px] pl-[20px] first:mt-0 max-sm:pl-[1.4em]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            // 번호("1.", "10.")는 목록 왼쪽 여백 안에 그려진다. 모바일은 글자(16px)가 커서 20px로는
            // 번호 앞이 잘리므로 글자 크기에 비례한 여백(두 자리 번호까지)을 준다.
            <ol className="mt-[6px] list-decimal space-y-[2px] pl-[20px] first:mt-0 max-sm:pl-[2em]">
              {children}
            </ol>
          ),
          h1: ({ children }) => (
            <p className="mt-[10px] font-semibold first:mt-0">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mt-[10px] font-semibold first:mt-0">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mt-[10px] font-semibold first:mt-0">{children}</p>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded-[4px] bg-gray-100 px-[4px] text-[0.9em]">
              {children}
            </code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
