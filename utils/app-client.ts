import { ofetch } from 'ofetch';
import { ApiMessage } from '@/src/shared/types/api';

export type AppApiResponse<T> = {
  success: boolean;
  message: ApiMessage;
  data: T;
};

type Options = NonNullable<Parameters<typeof ofetch>[1]>

async function request<T>(url: string, options?: Options): Promise<AppApiResponse<T>> {
  return await ofetch<AppApiResponse<T>>(url, options)
}

export const appClient = {
  get<T>(url: string, options?: Options): Promise<AppApiResponse<T>> {
    return request<T>(url, {
      ...options,
      method: 'GET',
    });
  },
  post<T>(url: string, options: Options): Promise<AppApiResponse<T>> {
    return request<T>(url, {
      ...options,
      method: 'POST',
    });
  },
  put<T>(url: string, options: Options): Promise<AppApiResponse<T>> {
    return request<T>(url, {
      ...options,
      method: 'PUT',
    });
  },
  patch<T>(url: string, options: Options): Promise<AppApiResponse<T>> {
    return request<T>(url, {
      ...options,
      method: 'PATCH',
    });
  },
  delete<T>(url: string, options?: Options): Promise<AppApiResponse<T>> {
    return request<T>(url, {
      ...options,
      method: 'DELETE'
    });
  },
};
