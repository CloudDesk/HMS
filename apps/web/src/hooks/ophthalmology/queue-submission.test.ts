import { describe, expect, it } from 'vitest';
import { queueCommandSchema } from '../../api/ophthalmology-queue';
import { queueActionDefinitions } from './queue-actions';
describe('approved test submission action', () => {
  it('requires exact completed status and version and is separate from finalization/review', () => {
    const command = { action: 'submit-for-review', task_id: '111111111111111111111111', body: { expected_status: 'COMPLETED', expected_version: 4 } };
    expect(queueCommandSchema.parse(command)).toEqual(command);
    expect(queueCommandSchema.safeParse({ ...command, body: { ...command.body, expected_status: 'DRAFT' } }).success).toBe(false);
    expect(queueActionDefinitions.find((a) => a.action === 'submit-for-review')).toMatchObject({ permission: 'Complete', statuses: ['COMPLETED'] });
  });
});
