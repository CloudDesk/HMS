import { Types } from 'mongoose';
import { MobileDeviceModel, type MobileDeviceDocument } from './device.model.js';
import type { MobileDevice, RegisterDeviceDTO, RefreshPushTokenDTO } from './device.types.js';

const toMobileDevice = (doc: MobileDeviceDocument): MobileDevice => ({
  id: doc._id.toString(),
  userId: doc.userId.toString(),
  installationId: doc.installationId,
  deviceId: doc.deviceId ?? undefined,
  platform: doc.platform,
  pushToken: doc.pushToken,
  appVersion: doc.appVersion ?? undefined,
  osVersion: doc.osVersion ?? undefined,
  isActive: doc.isActive,
  lastRegisteredAt: doc.lastRegisteredAt,
  lastSeenAt: doc.lastSeenAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export class DeviceRepository {
  async registerDevice(userId: string, data: RegisterDeviceDTO): Promise<MobileDevice> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    // If this installationId or pushToken was previously active for another user, deactivate it first (e.g. shared device switch)
    await MobileDeviceModel.updateMany(
      {
        $or: [
          { installationId: data.installationId, userId: { $ne: userObjectId } },
          { pushToken: data.pushToken, userId: { $ne: userObjectId } },
        ],
        isActive: true,
      },
      {
        $set: { isActive: false, updatedAt: now },
      }
    );

    // Upsert device for this user and installationId
    const doc = await MobileDeviceModel.findOneAndUpdate(
      { userId: userObjectId, installationId: data.installationId },
      {
        $set: {
          deviceId: data.deviceId ?? null,
          platform: data.platform,
          pushToken: data.pushToken,
          appVersion: data.appVersion ?? null,
          osVersion: data.osVersion ?? null,
          isActive: true,
          lastRegisteredAt: now,
          lastSeenAt: now,
        },
      },
      { upsert: true, new: true, returnDocument: 'after' }
    );

    if (!doc) {
      throw new Error('Device registration did not return a device record');
    }
    return toMobileDevice(doc);
  }

  async unregisterDevice(userId: string, installationId?: string, pushToken?: string): Promise<number> {
    const userObjectId = new Types.ObjectId(userId);
    const query: Record<string, unknown> = { userId: userObjectId, isActive: true };

    if (installationId) {
      query.installationId = installationId;
    } else if (pushToken) {
      query.pushToken = pushToken;
    }

    const result = await MobileDeviceModel.updateMany(query, {
      $set: { isActive: false, updatedAt: new Date() },
    });

    return result.modifiedCount;
  }

  async updatePushToken(userId: string, data: RefreshPushTokenDTO): Promise<boolean> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    // If another device had this pushToken, deactivate it
    await MobileDeviceModel.updateMany(
      { pushToken: data.pushToken, userId: { $ne: userObjectId }, isActive: true },
      { $set: { isActive: false, updatedAt: now } }
    );

    const result = await MobileDeviceModel.updateOne(
      { userId: userObjectId, installationId: data.installationId },
      {
        $set: {
          pushToken: data.pushToken,
          isActive: true,
          lastSeenAt: now,
          updatedAt: now,
        },
      }
    );

    return result.modifiedCount > 0;
  }

  async getActiveDevicesForUser(userId: string): Promise<MobileDevice[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const docs = await MobileDeviceModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    }).lean<MobileDeviceDocument[]>();

    return docs.map(toMobileDevice);
  }

  async getActiveDevicesForUsers(userIds: string[]): Promise<MobileDevice[]> {
    const validIds = userIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (!validIds.length) return [];

    const docs = await MobileDeviceModel.find({
      userId: { $in: validIds },
      isActive: true,
    }).lean<MobileDeviceDocument[]>();

    return docs.map(toMobileDevice);
  }

  async markTokensInactive(pushTokens: string[]): Promise<number> {
    if (!pushTokens.length) return 0;
    const result = await MobileDeviceModel.updateMany(
      { pushToken: { $in: pushTokens } },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return result.modifiedCount;
  }
}
