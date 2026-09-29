export function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[16px] rounded-br-[4px] bg-[#f0f5f9] px-[16px] py-[10px] text-sm leading-[22px] text-black sm:text-base sm:leading-[24px]">
        {content}
      </div>
    </div>
  );
}
