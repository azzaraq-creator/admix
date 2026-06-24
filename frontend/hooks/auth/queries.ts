import { useQuery } from "@tanstack/react-query";

import { getUserToken } from "@/lib/userToken";

import { authApi } from "./apis";
import { authKeys } from "./keys";

export const useMe = () =>
  useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.me,
    enabled: typeof document !== "undefined" && !!getUserToken(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
