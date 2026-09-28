"use client";

import { Label, Switch } from "@heroui/react";

import { cn } from "@/lib/utils";

type SimpleViewToggleProps = {
  simple: boolean;
  onChange: (simple: boolean) => void;
  className?: string;
};

export function SimpleViewToggle({
  simple,
  onChange,
  className,
}: SimpleViewToggleProps) {
  return (
    <Switch
      size="sm"
      isSelected={simple}
      onChange={onChange}
      className={cn("group flex", className)}
    >
      {/* 라벨까지 눌러도 켜고 꺼진다(Switch.Content가 라벨+컨트롤을 한 버튼으로 묶는다). */}
      <Switch.Content className="flex-row-reverse gap-[6px]">
        {/* 켜짐 손잡이 색(accent-foreground)이 globals.css에서 shadcn 진보라(#4a146b)로
            덮여 있어 흰색으로 되돌린다. 꺼짐 트랙은 회색 바탕(지도 팝업) 위에서도 보이게 진하게. */}
        <Switch.Control className="bg-[#d4d4d8]! group-data-[selected=true]:bg-primary!">
          <Switch.Thumb className="bg-white!" />
        </Switch.Control>
        <Label className="text-sm leading-[20px] font-medium text-grey-500">
          간략히 보기
        </Label>
      </Switch.Content>
    </Switch>
  );
}
