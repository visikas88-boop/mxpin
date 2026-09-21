/**
import { apiFetch } from "@/utils/api-config";
 * API 配置 - 自动适配开发/生产环境
 */

// 获取 API Base URL
export const getApiBaseUrl = (): string => {
  // 生产环境：使用相对路径，通过 Nginx 代理
  if (import.meta.env.PROD) {
    return '/api';
  }

  // 开发环境：使用环境变量或默认值
  return import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
};

// 导出配置
export const API_BASE_URL = getApiBaseUrl();

// API 请求辅助函数
export const apiUrl = (path: string): string => {
  const base = API_BASE_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

// Fetch 封装
export const apiFetch = async (
  path: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = apiUrl(path);

  // 默认配置
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // 合并配置
  const finalOptions = { ...defaultOptions, ...options };

  return fetch(url, finalOptions);
};
