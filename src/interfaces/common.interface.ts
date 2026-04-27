export interface CustomExceptionResponse {
  message?: string;
  error_code?: string | number;
  [key: string]: any;
}

export interface ResponseFormat<T> {
  success: boolean;
  status_code: number;
  message: string;
  data: T | null;
}
