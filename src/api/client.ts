import axios, { type AxiosInstance } from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import { fromAxiosError } from './errors';
import { attachToken } from './interceptors/attachToken';
import { installRefreshOn401 } from './interceptors/refreshOn401';

function create(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use(attachToken);
  installRefreshOn401(instance);

  instance.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(fromAxiosError(error))
  );

  return instance;
}

export const apiClient: AxiosInstance = create();
