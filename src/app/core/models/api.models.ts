/** Generic wrapper returned by every endpoint */
export interface ApiResult<T> {
  IsSuccess: boolean;
  Data: T;
  Error?: ApiError | null;
  ValidationErrors?: ValidationError[] | null;
}

export interface ValidationError {
  PropertyName: string;
  ErrorMessage: string;
}

export interface ApiError {
  message?: string;
  code?: string;
  Code?: number;
  MessageKey?: string;
}

/** Paginated list wrapper */
export interface PaginatedResult<T> {
  Items: T[];
  TotalCount: number;
  TotalPages: number;
  CurrentPage: number;
  PageSize: number;
  HasNext: boolean;
  HasPrevious: boolean;
}

/** Common query params for paginated endpoints */
export interface PageQuery {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDescending?: boolean;
}
