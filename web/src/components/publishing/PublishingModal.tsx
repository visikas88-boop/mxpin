import { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Alert } from 'antd';
import {
  CloudUploadOutlined,
  DollarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import PlatformSelector from './PlatformSelector';
import { createPublishingTask } from '@/services/api/publishing';
import type { CreatePublishingTaskForm } from '@/types/publishing';
import { useTranslation } from 'react-i18next';

interface PublishingModalProps {
  open: boolean;
  onClose: () => void;
  defaultVideoUrl?: string;
  onSuccess?: () => void;
}

export function PublishingModal({
  open,
  onClose,
  defaultVideoUrl: initialVideoUrl,
  onSuccess
}: PublishingModalProps) {
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [userBalance, setUserBalance] = useState(0);

  useEffect(() => {
    if (open) {
      loadUserBalance();
      if (initialVideoUrl) {
        form.setFieldValue('videoUrl', initialVideoUrl);
      }
    } else {
      form.resetFields();
      setTotalCost(0);
    }
  }, [open, initialVideoUrl]);

  async function loadUserBalance() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserBalance(data.data?.balancePoints || data.data?.balance_points || 0);
      }
    } catch (error) {
      console.error('Load balance error:', error);
    }
  }

  async function handleSubmit(values: CreatePublishingTaskForm) {
    if (totalCost > userBalance) {
      message.error(t('publishing.insufficientBalance') || '积分余额不足，请先充值');
      return;
    }

    if (!values.targetPlatforms || values.targetPlatforms.length === 0) {
      message.error(t('publishing.selectPlatform') || '请选择至少一个发布平台');
      return;
    }

    setLoading(true);
    try {
      const res = await createPublishingTask({
        videoUrl: values.videoUrl,
        videoTitle: values.videoTitle,
        videoDescription: values.videoDescription,
        videoThumbnailUrl: values.videoThumbnailUrl,
        targetPlatforms: values.targetPlatforms,
        platformSettings: {}
      });

      if (res.success) {
        message.success(t('publishing.taskCreated') || '发布任务创建成功，正在处理中...');
        form.resetFields();
        onClose();
        onSuccess?.();
      } else {
        message.error(res.message || t('publishing.taskCreateFailed') || '创建任务失败');
      }
    } catch (error: any) {
      console.error('Create task error:', error);
      message.error(error.response?.data?.message || t('publishing.taskCreateFailed') || '创建任务失败');
    } finally {
      setLoading(false);
    }
  }

  const isBalanceInsufficient = totalCost > userBalance;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CloudUploadOutlined className="text-purple-500" />
          <span>{t('publishing.publishToSocial') || '发布到社交平台'}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={900}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="mt-4"
      >
        {/* 视频URL */}
        <Form.Item
          label={t('publishing.videoUrl') || '视频URL'}
          name="videoUrl"
          rules={[
            { required: true, message: t('publishing.videoUrlRequired') || '请输入视频URL' },
            { type: 'url', message: t('publishing.videoUrlInvalid') || '请输入有效的URL' }
          ]}
        >
          <Input
            placeholder="https://cdn.example.com/video.mp4"
            prefix={<CloudUploadOutlined />}
          />
        </Form.Item>

        {/* 视频标题 */}
        <Form.Item
          label={t('publishing.videoTitle') || '视频标题'}
          name="videoTitle"
          rules={[{ required: true, message: t('publishing.videoTitleRequired') || '请输入视频标题' }]}
        >
          <Input
            placeholder={t('publishing.videoTitlePlaceholder') || '输入视频标题'}
            maxLength={100}
            showCount
          />
        </Form.Item>

        {/* 视频描述 */}
        <Form.Item
          label={t('publishing.videoDescription') || '视频描述'}
          name="videoDescription"
        >
          <Input.TextArea
            placeholder={t('publishing.videoDescriptionPlaceholder') || '输入视频描述（可选）'}
            rows={4}
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* 缩略图URL */}
        <Form.Item
          label={t('publishing.thumbnailUrl') || '缩略图URL（可选）'}
          name="videoThumbnailUrl"
          rules={[{ type: 'url', message: t('publishing.thumbnailUrlInvalid') || '请输入有效的URL' }]}
        >
          <Input placeholder="https://cdn.example.com/thumbnail.jpg" />
        </Form.Item>

        {/* 平台选择 */}
        <Form.Item
          label={t('publishing.selectPlatforms') || '选择发布平台'}
          name="targetPlatforms"
          rules={[{ required: true, message: t('publishing.selectPlatformRequired') || '请选择至少一个平台' }]}
        >
          <PlatformSelector onCostChange={setTotalCost} disabled={loading} />
        </Form.Item>

        {/* 费用信息 */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg mb-4 border border-purple-200">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 text-gray-700">
              <DollarOutlined />
              <span>{t('publishing.currentBalance') || '当前积分余额'}</span>
            </div>
            <span className="text-xl font-bold text-purple-600">
              {userBalance.toLocaleString()} {t('publishing.points') || '积分'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-gray-700">
              <ClockCircleOutlined />
              <span>{t('publishing.costForThisPublish') || '本次发布消耗'}</span>
            </div>
            <span className={`text-xl font-bold ${isBalanceInsufficient ? 'text-red-500' : 'text-green-600'}`}>
              {totalCost.toLocaleString()} {t('publishing.points') || '积分'}
            </span>
          </div>

          {isBalanceInsufficient && (
            <Alert
              message={t('publishing.insufficientBalanceDetails') || `积分不足，还需 ${(totalCost - userBalance).toLocaleString()} 积分`}
              type="error"
              showIcon
              className="mt-3"
            />
          )}

          {!isBalanceInsufficient && totalCost > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              {t('publishing.balanceAfter') || '发布后余额'}:{' '}
              <span className="font-semibold">{(userBalance - totalCost).toLocaleString()}</span>{' '}
              {t('publishing.points') || '积分'}
            </div>
          )}
        </div>

        {/* 温馨提示 */}
        <Alert
          message={t('publishing.tips') || '温馨提示'}
          description={
            <ul className="text-sm space-y-1 mt-2">
              <li>• {t('publishing.tip1') || '视频将异步发布到选定的平台，请稍后查看任务状态'}</li>
              <li>• {t('publishing.tip2') || '发布成功后积分不可退还'}</li>
              <li>• {t('publishing.tip3') || '请确保视频符合各平台的内容规范'}</li>
              <li>• {t('publishing.tip4') || '部分平台可能需要较长时间处理'}</li>
            </ul>
          }
          type="info"
          showIcon
          className="mb-4"
        />

        {/* 操作按钮 */}
        <Form.Item className="mb-0">
          <div className="flex gap-3 justify-end">
            <Button onClick={onClose} disabled={loading}>
              {t('common.cancel') || '取消'}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={isBalanceInsufficient || totalCost === 0}
              icon={<CloudUploadOutlined />}
              size="large"
            >
              {t('publishing.publishNow') || '立即发布'}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
