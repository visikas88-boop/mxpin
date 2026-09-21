// 社交账号相关类型
export interface SocialAccount {
  id: number;
  user_id: string;
  platform: string;
  account_name: string;
  account_id: string;
  profile_picture_url?: string;
  is_active: boolean;
  token_expires_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  platform_display_name?: string;
  platform_icon?: string;
  platform_points_cost?: number;
}

// 平台定价配置
export interface PlatformPricing {
  id: number;
  platform: string;
  display_name: string;
  display_name_en?: string;
  icon_url?: string;
  points_cost: number;
  is_enabled: boolean;
  sort_order: number;
  description?: string;
  description_en?: string;
  max_video_size_mb?: number;
  max_video_duration_sec?: number;
  supported_formats?: string[];
  features?: Record<string, any>;
  is_connected?: boolean;
  connected_accounts?: number;
}

// 发布任务
export interface PublishingTask {
  id: number;
  task_uuid: string;
  user_id: string;
  video_id?: number;
  video_url: string;
  video_title: string;
  video_description?: string;
  video_thumbnail_url?: string;
  video_duration?: number;
  video_size_bytes?: number;
  target_platforms: string[];
  platform_settings?: Record<string, any>;
  status: TaskStatus;
  points_cost: number;
  points_deducted: boolean;
  results?: PublishingResult[];
  error_message?: string;
  retry_count: number;
  max_retries: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  success_count?: number;
  failed_count?: number;
  username?: string; // 管理端使用
  email?: string; // 管理端使用
}

export type TaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'partial_success'
  | 'failed'
  | 'cancelled'
  | 'scheduled';

export interface PublishingResult {
  platform: string;
  status: 'success' | 'failed';
  postUrl?: string;
  postId?: string;
  error?: string;
  errorCode?: string;
}

// 发布日志
export interface PublishingLog {
  id: number;
  task_id: number;
  platform: string;
  status: string;
  post_url?: string;
  platform_post_id?: string;
  response_data?: Record<string, any>;
  error_code?: string;
  error_message?: string;
  attempt_number: number;
  processing_time_ms?: number;
  created_at: string;
  platform_display_name?: string;
  platform_icon?: string;
}

// 发布统计
export interface PublishingStats {
  overall: {
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    processing_tasks: number;
    partial_success_tasks: number;
    total_points_consumed: number;
    active_users: number;
  };
  platforms: PlatformStats[];
  dailyTrend: DailyTrendData[];
  topUsers: TopUserData[];
}

export interface PlatformStats {
  platform: string;
  display_name: string;
  total_publishes: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  avg_processing_time_ms: number;
}

export interface DailyTrendData {
  date: string;
  task_count: number;
  completed_count: number;
  points_consumed: number;
}

export interface TopUserData {
  id: string;
  username: string;
  email: string;
  task_count: number;
  total_points_spent: number;
  successful_tasks: number;
}

// Upload-Post配置
export interface UploadPostConfig {
  id: number;
  api_url: string;
  webhook_url?: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  timeout_seconds: number;
  retry_enabled: boolean;
  api_key_preview?: string;
  created_at: string;
  updated_at: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  tasks?: T[];
  total: number;
  limit: number;
  offset: number;
}

// 表单数据类型
export interface CreatePublishingTaskForm {
  videoUrl: string;
  videoTitle: string;
  videoDescription?: string;
  videoThumbnailUrl?: string;
  targetPlatforms: string[];
  platformSettings?: Record<string, any>;
  scheduledAt?: string;
}

export interface CostCalculation {
  platforms: Array<{
    platform: string;
    display_name: string;
    points_cost: number;
  }>;
  totalCost: number;
  breakdown: Array<{
    platform: string;
    name: string;
    cost: number;
  }>;
}
