import { HelpView } from "./_components/HelpView";

// 탭을 주소(?tab=)에서 읽으므로 요청마다 그린다(정적 생성 시 useSearchParams가 비어 첫 화면이 어긋난다).
export const dynamic = "force-dynamic";

export default function HelpPage() {
  return <HelpView />;
}
