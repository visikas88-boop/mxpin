import type {
  SocialAccount,
  ApiResponse,
  PlatformPricing,
  PublishingTask,
  PublishingLog,
  CreatePublishingTaskForm,
  CostCalculation,
  PaginatedResponse
} from '@/types/publishing';
import { apiFetch, apiUrl } from '@/utils/api-config';

// 获取token的辅助函数（支持多种token存储位置）
function getAuthHeaders() {
  const token = localStorage.getItem('auth_token')
    || localStorage.getItem('admin_token')
    || localStorage.getItem('token')
    || localStorage.getItem('user_token');

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// ==================== 社交账号管理 ====================

/**
 * 获取OAuth连接URL
 */
export async function getConnectUrl(platform: string): Promise<ApiResponse<{ connectUrl: string; sessionId: string; state: string }>> {
  const response = await fetch(apiUrl('/social-accounts/connect-url'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ platform })
  });
  return response.json();
}

/**
 * 验证连接
 */
export async function verifyConnection(data: {
  platform: string;
  code: string;
  state: string;
}): Promise<ApiResponse<SocialAccount>> {
  const response = await fetch(apiUrl('/social-accounts/verify-connection'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return response.json();
}

/**
 * 获取用户已连接的账号列表
 */
export async function getUserAccounts(): Promise<ApiResponse<SocialAccount[]>> {
  const response = await fetch(apiUrl('/social-accounts'), {
    headers: getAuthHeaders()
  });
  return response.json();
}

/**
 * 断开账号连接
 */
export async function disconnectAccount(id: number): Promise<ApiResponse> {
  const response = await fetch(apiUrl(`/social-accounts/${id}`), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return response.json();
}

/**
 * 启用/禁用账号
 */
export async function toggleAccount(id: number): Promise<ApiResponse<SocialAccount>> {
  const response = await fetch(apiUrl(`/social-accounts/${id}/toggle`), {
    method: 'PUT',
    headers: getAuthHeaders()
  });
  return response.json();
}

/**
 * 刷新账号信息
 */
export async function refreshAccountInfo(id: number): Promise<ApiResponse<SocialAccount>> {
  const response = await fetch(apiUrl(`/social-accounts/${id}/refresh`), {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return response.json();
}

// ==================== 视频发布 ====================

/**
 * 获取可用平台列表
 */
export async function getPlatforms(): Promise<ApiResponse<PlatformPricing[]>> {
  const response = await fetch(apiUrl('/publishing/platforms'), {
    headers: getAuthHeaders()
  });
  return response.json();
}

/**
 * 计算发布费用
 */
export async function calculateCost(platforms: string[]): Promise<ApiResponse<CostCalculation>> {
  const response = await fetch(apiUrl('/publishing/calculate-cost'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ platforms })
  });
  return response.json();
}

/**
 * 创建发布任务
 */
export async function createPublishingTask(data: CreatePublishingTaskForm): Promise<ApiResponse<PublishingTask>> {
  const response = await fetch(apiUrl('/publishing/create-task'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return response.json();
}

/**
 * 获取任务列表
 */
export async function getTasks(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<PaginatedResponse<PublishingTask>>> {
  const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
  const response = await fetch(apiUrl(`/publishing/tasks${queryString}`), {
    headers: getAuthHeaders()
  });
  return response.json();
}

/**
 * 获取任务详情
 */
export async function getTaskDetail(taskId: number): Promise<ApiResponse<{
  task: PublishingTask;
  logs: PublishingLog[];
}>> {
  const response = await fetch(apiUrl(`/publishing/tasks/${taskId}`), {
    headers: getAuthHeaders()
  });
  return response.json();
}

/**
 * 重试失败任务
 */
export async function retryTask(taskId: number): Promise<ApiResponse> {
  const response = await fetch(apiUrl(`/publishing/tasks/${taskId}/retry`), {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return response.json();
}

/**
 * 取消任务
 */
export async function cancelTask(taskId: number): Promise<ApiResponse<PublishingTask>> {
  const response = await fetch(apiUrl(`/publishing/tasks/${taskId}`), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return response.json();
}
