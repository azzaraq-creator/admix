"use client";

import {
  Avatar,
  Button,
  Card,
  Description,
  Form,
  Label,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { TOAST_TIMEOUT } from "@/hooks/useSonner";
import { kstStamp } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { previewActions, usePreviewState } from "./previewStore";
import { PageHead, PanelCard, PartnerOnly } from "./workspaceUi";

/*
 * /partners/messages — admix와의 대화(프로토타입의 "대화" 흉내).
 * 보낸 글은 이 탭(예시 상태)에만 남고 외부로 전달되지 않는다.
 */

function Messages() {
  const state = usePreviewState();
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    previewActions.sendMessage(value);
    setText("");
    toast("대화 예시를 추가했어요. 실제로 전달되지는 않아요.", {
      timeout: TOAST_TIMEOUT,
    });
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <PageHead
        title="대화"
        description="협약 내용이나 운영 조건에 대한 질문을 이곳에서 이어가요."
      />
      <ul className="flex flex-col gap-[12px]">
        {state.messages.map((m) => {
          const mine = m.author === "cafe";
          return (
            <li
              key={m.id}
              className={cn(
                "flex gap-[8px]",
                mine ? "flex-row-reverse" : "flex-row",
              )}
            >
              <Avatar size="sm" className="shrink-0">
                <Avatar.Fallback
                  className={cn(
                    "text-[12px] font-bold",
                    mine
                      ? "bg-primary-100 text-primary-600"
                      : "bg-gray-900 text-white dark:bg-gray-300 dark:text-gray-900",
                  )}
                >
                  {mine ? "나" : "A"}
                </Avatar.Fallback>
              </Avatar>
              <div
                className={cn(
                  "flex max-w-[560px] flex-col gap-[4px]",
                  mine ? "items-end" : "items-start",
                )}
              >
                <div className="flex items-center gap-[6px] text-[12px] text-gray-500">
                  <b className="font-semibold text-gray-700">{m.name}</b>
                  <time>{kstStamp(m.at)}</time>
                </div>
                <Card
                  className={cn(
                    "rounded-[20px] px-[16px] py-[12px] text-[14px] leading-[1.6] break-keep whitespace-pre-wrap shadow-none",
                    mine
                      ? "bg-primary-500 text-white"
                      : "border border-gray-200 bg-surface text-gray-800",
                  )}
                >
                  {m.text}
                </Card>
              </div>
            </li>
          );
        })}
      </ul>
      <PanelCard className="p-[16px]">
        <Form onSubmit={submit} className="flex flex-col gap-[10px]">
          <TextField
            value={text}
            onChange={setText}
            maxLength={3000}
            className="flex flex-col gap-[6px]"
          >
            <Label className="text-[13px] font-semibold text-gray-700">
              메시지
            </Label>
            <TextArea
              rows={3}
              placeholder="문의하거나 바꾸고 싶은 내용을 적어 주세요."
              className="resize-none"
            />
            <Description className="text-[12px] text-gray-400">
              대화 내용은 계약의 최종 동의를 대신하지 않아요.
            </Description>
          </TextField>
          <Button
            type="submit"
            isDisabled={!text.trim()}
            className="h-[42px] self-end rounded-[18px] px-[18px] font-bold"
          >
            보내기
            <Send className="size-[15px]" />
          </Button>
        </Form>
      </PanelCard>
    </div>
  );
}

export function PartnerMessages() {
  return (
    <PartnerOnly>
      <Messages />
    </PartnerOnly>
  );
}
