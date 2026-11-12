"use client";

import { usePress } from "react-aria";

/**
 * HeroUI Popover 바깥 틀(react-aria DialogTrigger)은 안에 "여는 버튼"이 있다고 보고, 없으면 개발 콘솔에
 * "A PressResponder was rendered without a pressable child" 경고를 낸다.
 * triggerRef 로 다른 곳 버튼에 붙여 isOpen 으로 여닫는 팝오버는 바깥 틀 안에 이걸 하나 둔다 —
 * 아무것도 그리지 않고 버튼 자리만 채운다(누르기 · 위치는 그대로 triggerRef 쪽 버튼).
 *
 * Modal · Drawer · AlertDialog 는 바깥 틀 없이 X.Backdrop 에 isOpen · onOpenChange 를 주면 된다.
 * Popover 는 바깥 틀이 모양(slots)을 넘겨줘서 빼면 생김새가 깨지므로 이 방법을 쓴다.
 */
export function ExternalTrigger() {
  usePress({});
  return null;
}
