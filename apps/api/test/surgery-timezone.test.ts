import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { AppError } from '../src/shared/errors/app-error.js';

test('SurgeryService - Timezone Handling', async (t) => {
  const createMockService = (tz: string) => {
    const mockRepo = {
      hasAppointmentOverlap: mock.fn(async () => false),
      hasDoctorOverlap: mock.fn(async () => false),
      countServiceOverlap: mock.fn(async () => 0),
    } as unknown as ConstructorParameters<typeof SurgeryService>[0];
    const mockDoctors = {
      getById: mock.fn(async (id) => ({
        id: id.toString(),
        status: 'ACTIVE',
        availability: [
          { day_of_week: 'MONDAY', is_available: true, working_blocks: [{ start_time: '09:00', end_time: '17:00' }] },
          { day_of_week: 'TUESDAY', is_available: true, working_blocks: [{ start_time: '09:00', end_time: '17:00' }] }
        ]
      })),
      hasActiveLeave: mock.fn(async () => false),
      getExceptionByDate: mock.fn(async () => null),
    } as unknown as ConstructorParameters<typeof SurgeryService>[1];
    const mockSettingsRepo = {
      get: async () => ({ localization: { timezone: tz } })
    } as unknown as ConstructorParameters<typeof SurgeryService>[8];

    return new SurgeryService(
      mockRepo, mockDoctors, {} as unknown as ConstructorParameters<typeof SurgeryService>[2], {} as unknown as ConstructorParameters<typeof SurgeryService>[3], {} as unknown as ConstructorParameters<typeof SurgeryService>[4], {} as unknown as ConstructorParameters<typeof SurgeryService>[5], {} as unknown as ConstructorParameters<typeof SurgeryService>[6], {} as unknown as ConstructorParameters<typeof SurgeryService>[7], mockSettingsRepo
    );
  };

  t.afterEach(() => {
    mock.restoreAll();
  });

  await t.test('Test A - Local positive case (Non-UTC timezone, booking inside local working hours)', async () => {
    const service = createMockService('Asia/Kolkata');
    // Monday 10:00 AM IST is Monday 04:30 AM UTC
    const start = new Date('2028-10-09T04:30:00Z'); // 2028-10-09 is a Monday
    const end = new Date('2028-10-09T05:30:00Z'); // Monday 11:00 AM IST

    await assert.doesNotReject(async () => {
      // call private validateSchedule using any cast
      await (service as unknown as { validateSchedule: (...args: unknown[]) => Promise<void> }).validateSchedule('doc1', start, end, 'srv1', 1);
    });
  });

  await t.test('Test B - Local negative case (Non-UTC timezone, booking outside local working hours)', async () => {
    const service = createMockService('Asia/Kolkata');
    // Monday 18:00 IST is Monday 12:30 UTC
    const start = new Date('2028-10-09T12:30:00Z');
    const end = new Date('2028-10-09T13:30:00Z');

    await assert.rejects(
      async () => {
        await (service as unknown as { validateSchedule: (...args: unknown[]) => Promise<void> }).validateSchedule('doc1', start, end, 'srv1', 1);
      },
      (err: unknown) => err instanceof AppError && err.code === 'DOCTOR_NOT_AVAILABLE'
    );
  });

  await t.test('Test C - UTC/local weekday boundary (UTC date and local date differ)', async () => {
    // Sunday 23:30 UTC is Monday 05:00 IST
    // Monday 09:00 IST is Sunday 03:30 UTC next day? No, Sunday 23:30 UTC + 5:30 = Monday 05:00 IST.
    // Let's use Monday 09:00 IST -> Sunday 03:30 AM UTC (24h clock, so 27:30 UTC prev day)
    // 2028-10-08 is Sunday.
    // Sunday 2028-10-08T23:30:00Z = Monday 2028-10-09 05:00 AM IST. (Not in working hours)
    // Sunday 2028-10-08T03:30:00Z = Sunday 2028-10-08 09:00 AM IST. (Sunday, not available)
    
    // We want a time where UTC is Sunday, but Local is Monday inside working hours.
    // Monday 09:00 IST = 09:00 - 05:30 = 03:30 UTC on Monday.
    // Wait, Monday 03:30 UTC is Monday in UTC too.
    
    // How about timezone America/New_York (UTC-4 or UTC-5)
    // Monday 09:00 EST = Monday 14:00 UTC. (Same day)
    // Wait, if Local is Monday 09:00, UTC could be Sunday? No, UTC is ahead of Americas, so if America is Monday 09:00, UTC is Monday 14:00.
    // If we use Asia/Tokyo (UTC+9), Monday 09:00 JST is Sunday 00:00 UTC! (Midnight UTC).
    // Let's use Sunday 2028-10-08T23:30:00Z (Sunday in UTC).
    // In JST (UTC+9), it is Monday 08:30 JST.
    
    // Sunday 2028-10-08T23:30:00Z + 9 hours = Monday 08:30 JST (outside working hours).
    // Sunday 2028-10-08T23:59:00Z + 9 hours = Monday 08:59 JST.
    // Monday 2028-10-09T00:30:00Z = Monday 09:30 JST. This is Monday in UTC as well.
    // To make UTC Sunday and Local Monday inside working hours (09:00 - 17:00):
    // Pacific/Auckland is UTC+13.
    // Sunday 2028-10-08T22:00:00Z + 13 hours = Monday 11:00 NZDT.
    // 2028-10-08T22:00:00Z is SUNDAY in UTC. It is MONDAY in Auckland.
    const serviceAuckland = createMockService('Pacific/Auckland');
    const start = new Date('2028-10-08T22:00:00Z'); // Sunday in UTC
    const end = new Date('2028-10-08T23:00:00Z'); // Sunday in UTC

    await assert.doesNotReject(async () => {
      await (serviceAuckland as unknown as { validateSchedule: (...args: unknown[]) => Promise<void> }).validateSchedule('doc1', start, end, 'srv1', 1);
    });
  });

  await t.test('Test D - DST (DST-aware timezone correctly adjusts local clock time)', async () => {
    const service = createMockService('America/New_York');
    
    // In NY, EDT (UTC-4) is active in August. EST (UTC-5) is active in December.
    // EDT: Monday 2028-08-07 10:00 AM EDT = 14:00 UTC
    const startEDT = new Date('2028-08-07T14:00:00Z');
    const endEDT = new Date('2028-08-07T15:00:00Z');
    
    // EST: Monday 2028-12-04 10:00 AM EST = 15:00 UTC
    const startEST = new Date('2028-12-04T15:00:00Z');
    const endEST = new Date('2028-12-04T16:00:00Z');

    // Both should pass because they represent 10:00 AM local time in NY.
    await assert.doesNotReject(async () => {
      await (service as unknown as { validateSchedule: (...args: unknown[]) => Promise<void> }).validateSchedule('doc1', startEDT, endEDT, 'srv1', 1);
    });

    await assert.doesNotReject(async () => {
      await (service as unknown as { validateSchedule: (...args: unknown[]) => Promise<void> }).validateSchedule('doc1', startEST, endEST, 'srv1', 1);
    });
  });

  await t.test('Test E - UTC (UTC timezone preserves existing behavior)', async () => {
    const service = createMockService('UTC');
    // Monday 10:00 UTC
    const start = new Date('2028-10-09T10:00:00Z');
    const end = new Date('2028-10-09T11:00:00Z');

    await assert.doesNotReject(async () => {
      await (service as unknown as { validateSchedule: (...args: unknown[]) => Promise<void> }).validateSchedule('doc1', start, end, 'srv1', 1);
    });
  });
});
