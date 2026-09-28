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
        "min-w-0 text-base leading-[24px] break-words text-black",
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
            <ul className="mt-[6px] list-disc space-y-[2px] pl-[20px] first:mt-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-[6px] list-decimal space-y-[2px] pl-[20px] first:mt-0">
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
            <code className="rounded-[4px] bg-black-100 px-[4px] text-[0.9em]">
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
