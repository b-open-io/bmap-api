export * from './core';
export declare const VERSION = "0.0.5";
export declare const API_VERSION = "v1";
export type ApiSuccessResponse<T> = {
    status: 'success';
    data: T;
};
export type ApiErrorResponse = {
    status: 'error';
    error: string;
    code?: string;
};
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
//# sourceMappingURL=index.d.ts.map