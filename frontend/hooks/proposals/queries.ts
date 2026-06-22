import { useQuery } from "@tanstack/react-query";

import { proposalsApi } from "./apis";
import { proposalsKeys } from "./keys";

export const useAdminProposals = () =>
  useQuery({
    queryKey: proposalsKeys.list(),
    queryFn: proposalsApi.list,
    staleTime: 30 * 1000,
  });
