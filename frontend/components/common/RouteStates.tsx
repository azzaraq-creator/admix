import { Button } from "@/components/common/buttons";

export function LoadingState() {
  return (
    <div className="flex min-h-[240px] w-full flex-1 items-center justify-center py-[80px]">
      <div className="size-[36px] animate-spin rounded-full border-[3px] border-grey-200 border-t-primary" />
    </div>
  );
}

export function ErrorState({
  message = "정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[240px] w-full flex-1 flex-col items-center justify-center gap-[16px] py-[80px] text-center">
      <p className="text-base font-medium leading-[24px] text-grey-500">
        {message}
      </p>
      {onRetry && (
        <Button variant="tertiary" size="md" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}
