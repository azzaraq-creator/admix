// admin 목록 서버 사이드 필터/페이지네이션 공통 쿼리 파라미터.
// date_from/date_to 는 "YYYY.MM.DD" 또는 "YYYY-MM-DD" 모두 백엔드가 허용.
export type AdminListParams = {
  page?: number;
  page_size?: number;
  date_from?: string;
  date_to?: string;
  keyword?: string;
};
