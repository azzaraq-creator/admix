export function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[16px] rounded-br-[4px] bg-[#f0f5f9] px-[16px] py-[10px] text-base leading-[24px] text-black">
        {content}
      </div>
    </div>
  );
}
