import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "./apis";
import { dashboardKeys } from "./keys";

export const useDashboard = () =>
  useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: dashboardApi.get,
    staleTime: 30 * 1000,
  });
