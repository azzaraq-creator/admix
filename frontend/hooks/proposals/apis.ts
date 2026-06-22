import { api } from "@/lib/api";

export interface ProposalRow {
  id: string;
  name: string;
  member: string;
  mediaCount: string;
  totalAmount: string;
  status: string;
  registeredAt: string;
}

export interface ProposalListResponse {
  total: number;
  items: ProposalRow[];
}

export const proposalsApi = {
  list: () =>
    api.get<ProposalListResponse>("/admin/proposals").then((r) => r.data),
};
