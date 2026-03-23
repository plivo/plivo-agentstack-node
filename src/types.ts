/** Pagination metadata for list responses. */
export interface Meta {
  limit: number;
  offset: number;
  totalCount: number;
  previous: string | null;
  next: string | null;
}

/** Common list query parameters. */
export interface ListParams {
  limit?: number;
  offset?: number;
}

/** API error response shape. */
export interface ErrorResponse {
  api_id?: string;
  error?: string;
  message?: string;
}
