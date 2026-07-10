import { FileIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * 사업자등록증 파일 표시 단위 — 파일 아이콘 + 업로드한 원본 파일명 + 업로드 시각.
 * 회원가입/마이페이지/관리자 등 여러 화면에서 재사용한다.
 * 테두리·링크·우측 버튼 등 주변 요소는 호출부에서 감싼다.
 */
export function LicenseFileInfo({
  name,
  uploadedAt,
  className,
}: {
  name: string;
  uploadedAt?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-[16px]", className)}>
      <FileIcon className="size-[24px] shrink-0 text-black" />
      <div className="flex min-w-0 flex-col">
        <p className="truncate text-sm font-semibold leading-[20px] text-black">
          {name}
        </p>
        {uploadedAt && (
          <p className="text-xs font-normal leading-[16px] tracking-[0.0048px] text-grey-500">
            {formatDateTime(uploadedAt)}
          </p>
        )}
      </div>
    </div>
  );
}
