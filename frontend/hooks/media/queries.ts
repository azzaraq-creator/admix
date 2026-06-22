import { useQuery } from "@tanstack/react-query";

import { mediaApi } from "./apis";
import { mediaKeys } from "./keys";

export const useMediaList = () =>
  useQuery({
    queryKey: mediaKeys.list(),
    queryFn: mediaApi.list,
    staleTime: 60 * 1000,
  });

export const useMovingMediaList = () =>
  useQuery({
    queryKey: mediaKeys.movingList(),
    queryFn: mediaApi.movingList,
    staleTime: 60 * 1000,
  });

export const useMediaDetail = (id: string | null) =>
  useQuery({
    queryKey: mediaKeys.detail(id ?? ""),
    queryFn: () => mediaApi.detail(id as string),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
