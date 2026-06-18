import { useQuery } from "@tanstack/react-query";

import { mediaApi } from "./apis";
import { mediaKeys } from "./keys";

export const useMediaList = () =>
  useQuery({
    queryKey: mediaKeys.list(),
    queryFn: mediaApi.list,
    staleTime: 60 * 1000,
  });
