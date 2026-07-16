import { api } from "@/lib/api";

export interface MediaRow {
  no: string;
  mediaType: "고정" | "이동";
  name: string;
  region: string;
  category: string;
  product: string;
  adCost: string;
  saleType: string;
  updatedAt: string;
  createdAt: string;
}

export interface MediaListResponse {
  total: number;
  items: MediaRow[];
}

export interface MediaCardRow {
  id: string;
  name: string;
  minAdvertisementFeeKrw: number | null;
  thumbnailUrl: string | null;
  images: string[];
  badge: "popular" | "new" | null;
  lat: number | null;
  lng: number | null;
}

export interface MediaCardListResponse {
  total: number;
  items: MediaCardRow[];
}

export interface MediaFeature {
  label: string;
  value: string;
}

export interface MediaPlanRow {
  planNo: number;
  title: string;
  subtitle: string | null;
}

export interface MediaAgeRatio {
  label: string;
  value: number;
  bound: "under" | "over" | null;
}

export interface MediaPopulation {
  sangwonName: string;
  monthlyFootTraffic: number;
  malePct: number;
  femalePct: number;
  ageRatios: MediaAgeRatio[];
}

export interface MediaDetail {
  id: string;
  name: string;
  badge: "popular" | "new" | null;
  minAdvertisementFeeKrw: number | null;
  maxAdvertisementFeeKrw: number | null;
  description: string | null;
  address: string | null;
  thumbnailUrl: string | null;
  imageUrls: string[];
  sizeText: string | null;
  features: MediaFeature[];
  plans: MediaPlanRow[];
  population: MediaPopulation | null;
}

export interface MediaFilterParams {
  category?: string[];
  oohType?: string[];
  exposureType?: string[];
  mediaShape?: string[];
  productMasterType?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  neLat?: number | null;
  swLat?: number | null;
  neLng?: number | null;
  swLng?: number | null;
}

export interface MapBounds {
  neLat: number;
  swLat: number;
  neLng: number;
  swLng: number;
  zoom: number;
}

export interface MediaMarkerDto {
  id: string;
  lat: number;
  lng: number;
  name: string;
  categoryLarge: string | null;
  minAdvertisementFeeKrw: number | null;
  thumbnailUrl: string | null;
  images: string[];
  badge: "popular" | "new" | null;
}

export interface MediaClusterDto {
  lat: number;
  lng: number;
  count: number;
}

export interface MediaClusterResponse {
  clusters: MediaClusterDto[];
  markers: MediaMarkerDto[];
}

export interface MediaFilterOptions {
  categories: string[];
  ooh_types: string[];
  exposure_types: string[];
  media_shapes: string[];
  product_master_types: string[];
  price_min: number | null;
  price_max: number | null;
  price_histogram: number[];
}

function appendFilters(q: URLSearchParams, f?: MediaFilterParams): void {
  f?.category?.forEach((v) => q.append("category", v));
  f?.oohType?.forEach((v) => q.append("ooh_type", v));
  f?.exposureType?.forEach((v) => q.append("exposure_type", v));
  f?.mediaShape?.forEach((v) => q.append("media_shape", v));
  f?.productMasterType?.forEach((v) => q.append("product_master_type", v));
  if (f?.priceMin != null) q.set("price_min", String(f.priceMin));
  if (f?.priceMax != null) q.set("price_max", String(f.priceMax));
}

function appendBounds(q: URLSearchParams, f?: MediaFilterParams): void {
  if (
    f?.neLat != null &&
    f?.swLat != null &&
    f?.neLng != null &&
    f?.swLng != null
  ) {
    q.set("north_east_latitude", String(f.neLat));
    q.set("south_west_latitude", String(f.swLat));
    q.set("north_east_longitude", String(f.neLng));
    q.set("south_west_longitude", String(f.swLng));
  }
}

function buildFixedQuery(
  limit: number,
  offset: number,
  f?: MediaFilterParams,
): string {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  appendFilters(q, f);
  appendBounds(q, f);
  return q.toString();
}

function buildMovingQuery(f?: MediaFilterParams): string {
  const q = new URLSearchParams();
  appendFilters(q, f);
  return q.toString();
}

function buildClusterQuery(bounds: MapBounds, f?: MediaFilterParams): string {
  const q = new URLSearchParams();
  q.set("north_east_latitude", String(bounds.neLat));
  q.set("south_west_latitude", String(bounds.swLat));
  q.set("north_east_longitude", String(bounds.neLng));
  q.set("south_west_longitude", String(bounds.swLng));
  q.set("zoom_level", String(bounds.zoom));
  appendFilters(q, f);
  return q.toString();
}

export const mediaApi = {
  list: () => api.get<MediaListResponse>("/admin/media").then((r) => r.data),
  exportExcel: () =>
    api
      .get<Blob>("/admin/media/export", { responseType: "blob" })
      .then((r) => r.data),
  downloadTemplate: () =>
    api
      .get<Blob>("/admin/media/template", { responseType: "blob" })
      .then((r) => r.data),
  movingList: (filters?: MediaFilterParams) => {
    const qs = buildMovingQuery(filters);
    return api
      .get<MediaCardListResponse>(`/media/moving${qs ? `?${qs}` : ""}`)
      .then((r) => r.data);
  },
  movingFilterOptions: () =>
    api
      .get<MediaFilterOptions>("/media/moving/filter-options")
      .then((r) => r.data),
  fixedList: (limit: number, offset: number, filters?: MediaFilterParams) =>
    api
      .get<MediaCardListResponse>(
        `/media/fixed?${buildFixedQuery(limit, offset, filters)}`,
      )
      .then((r) => r.data),
  fixedClusters: (bounds: MapBounds, filters?: MediaFilterParams) =>
    api
      .get<MediaClusterResponse>(
        `/media/fixed/clusters?${buildClusterQuery(bounds, filters)}`,
      )
      .then((r) => r.data),
  fixedFilterOptions: () =>
    api
      .get<MediaFilterOptions>("/media/fixed/filter-options")
      .then((r) => r.data),
  detail: (id: string) =>
    api.get<MediaDetail>(`/media/${id}`).then((r) => r.data),
};

// ===== admin 매체 상세/등록 (media 전 컬럼) =====

export interface MediaImageItem {
  id: string;
  image_url: string;
  sort_order: number;
  is_thumbnail: boolean;
}

export interface AdminMediaDetail {
  media_id: string;
  thumbnail_url: string | null;
  images: MediaImageItem[];
  [key: string]: unknown;
}

export type AdminMediaPayload = Record<string, unknown>;

export interface MediaImportError {
  row: number;
  media_id: string;
  reason: string;
}

export interface MediaImportResult {
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: MediaImportError[];
}

export const adminMediaApi = {
  get: (id: string) =>
    api.get<AdminMediaDetail>(`/admin/media/${id}`).then((r) => r.data),
  create: (payload: AdminMediaPayload) =>
    api.post<AdminMediaDetail>("/admin/media", payload).then((r) => r.data),
  update: (id: string, payload: AdminMediaPayload) =>
    api.patch<AdminMediaDetail>(`/admin/media/${id}`, payload).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/admin/media/${id}`).then(() => undefined),
  uploadImage: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post<AdminMediaDetail>(`/admin/media/${id}/images`, fd)
      .then((r) => r.data);
  },
  deleteImage: (id: string, imageId: string) =>
    api
      .delete<AdminMediaDetail>(`/admin/media/${id}/images/${imageId}`)
      .then((r) => r.data),
  bulkImport: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post<MediaImportResult>("/admin/media/import", fd)
      .then((r) => r.data);
  },
};
