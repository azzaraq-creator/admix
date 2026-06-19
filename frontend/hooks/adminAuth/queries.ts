import { useQuery } from "@tanstack/react-query";

import { adminAuthApi } from "./apis";
import { adminAuthKeys } from "./keys";

export const useAdminMe = (enabled = true) =>
  useQuery({
    queryKey: adminAuthKeys.me(),
    queryFn: adminAuthApi.me,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
