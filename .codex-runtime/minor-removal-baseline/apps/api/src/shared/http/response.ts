export type ApiResponse<T> = {
  data: T;
};

export const ok = <T>(data: T): ApiResponse<T> => ({
  data,
});
