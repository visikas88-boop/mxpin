/**
 * 图片压缩工具
 * - 检查图片尺寸
 * - 压缩大图片到2000x2000
 * - 转换为WebP格式
 * - 显示进度
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  quality?: number;
  outputFormat?: 'webp' | 'jpeg' | 'png';
  onProgress?: (progress: number) => void;
}

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  originalDimensions: { width: number; height: number };
  compressedDimensions: { width: number; height: number };
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 2000,
  maxHeight: 2000,
  minWidth: 300,
  minHeight: 300,
  quality: 0.85,
  outputFormat: 'webp',
  onProgress: () => {},
};

/**
 * 压缩单个图片文件
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = async () => {
        try {
          const { width: originalWidth, height: originalHeight } = img;

          // 检查最小尺寸
          if (originalWidth < opts.minWidth || originalHeight < opts.minHeight) {
            reject(new Error(`图片尺寸太小，最小要求 ${opts.minWidth}x${opts.minHeight}px，当前 ${originalWidth}x${originalHeight}px`));
            return;
          }

          opts.onProgress(10);

          // 计算新尺寸（保持宽高比）
          let newWidth = originalWidth;
          let newHeight = originalHeight;

          if (originalWidth > opts.maxWidth || originalHeight > opts.maxHeight) {
            const ratio = Math.min(
              opts.maxWidth / originalWidth,
              opts.maxHeight / originalHeight
            );
            newWidth = Math.round(originalWidth * ratio);
            newHeight = Math.round(originalHeight * ratio);
          }

          opts.onProgress(30);

          // 创建canvas并绘制
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('无法创建canvas上下文'));
            return;
          }

          // 使用高质量缩放
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          opts.onProgress(60);

          // 转换为Blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('图片压缩失败'));
                return;
              }

              opts.onProgress(90);

              // 创建新文件
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, `.${opts.outputFormat}`),
                { type: `image/${opts.outputFormat}` }
              );

              opts.onProgress(100);

              resolve({
                file: compressedFile,
                originalSize: file.size,
                compressedSize: blob.size,
                originalDimensions: { width: originalWidth, height: originalHeight },
                compressedDimensions: { width: newWidth, height: newHeight },
              });
            },
            `image/${opts.outputFormat}`,
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 批量压缩图片
 */
export async function compressImages(
  files: File[],
  options: CompressOptions = {}
): Promise<CompressResult[]> {
  const results: CompressResult[] = [];
  const totalFiles = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // 为每个文件创建独立的进度回调
    const fileProgress = (progress: number) => {
      const overallProgress = ((i + progress / 100) / totalFiles) * 100;
      options.onProgress?.(overallProgress);
    };

    try {
      const result = await compressImage(file, {
        ...options,
        onProgress: fileProgress,
      });
      results.push(result);
    } catch (error) {
      // 如果某个图片压缩失败，继续处理其他图片
      console.error(`压缩图片 ${file.name} 失败:`, error);
      throw error; // 抛出错误让UI显示
    }
  }

  return results;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
