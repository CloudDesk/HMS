import { AppError } from '../../shared/errors/app-error.js';
import type { DeviceRepository } from './device.repository.js';
import type { MobileDevice, RegisterDeviceDTO, RefreshPushTokenDTO, UnregisterDeviceDTO } from './device.types.js';

export class DeviceService {
  constructor(private readonly repository: DeviceRepository) {}

  async registerDevice(userId: string, data: RegisterDeviceDTO): Promise<MobileDevice> {
    if (!data.installationId?.trim()) {
      throw new AppError('Installation ID is required', 400, 'VALIDATION_ERROR');
    }
    if (!data.pushToken?.trim()) {
      throw new AppError('Push token is required', 400, 'VALIDATION_ERROR');
    }
    if (data.platform !== 'android' && data.platform !== 'ios') {
      throw new AppError('Platform must be android or ios', 400, 'VALIDATION_ERROR');
    }

    return this.repository.registerDevice(userId, data);
  }

  async unregisterDevice(userId: string, data: UnregisterDeviceDTO): Promise<{ success: boolean; unregisteredCount: number }> {
    if (!data.installationId?.trim() && !data.pushToken?.trim()) {
      throw new AppError('Installation ID or push token is required', 400, 'VALIDATION_ERROR');
    }
    const count = await this.repository.unregisterDevice(userId, data.installationId, data.pushToken);
    return { success: true, unregisteredCount: count };
  }

  async refreshPushToken(userId: string, data: RefreshPushTokenDTO): Promise<{ success: boolean }> {
    if (!data.installationId?.trim() || !data.pushToken?.trim()) {
      throw new AppError('Installation ID and push token are required', 400, 'VALIDATION_ERROR');
    }
    const updated = await this.repository.updatePushToken(userId, data);
    return { success: updated };
  }

  async getActiveDevicesForUser(userId: string): Promise<MobileDevice[]> {
    return this.repository.getActiveDevicesForUser(userId);
  }

  async getActiveDevicesForUsers(userIds: string[]): Promise<MobileDevice[]> {
    return this.repository.getActiveDevicesForUsers(userIds);
  }

  async markTokensInactive(pushTokens: string[]): Promise<number> {
    return this.repository.markTokensInactive(pushTokens);
  }
}
