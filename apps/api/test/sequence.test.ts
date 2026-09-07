import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';

describe('Sequence Service & Concurrency', () => {
  let sequenceService: SequenceService;

  beforeAll(async () => {
    await setupTestDatabase();
    sequenceService = new SequenceService();
    await clearTestDatabase();
  }, 30000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('generates sequential numbers', async () => {
    const s1 = await sequenceService.getNextSequence('test_seq');
    const s2 = await sequenceService.getNextSequence('test_seq');
    const s3 = await sequenceService.getNextSequence('test_seq');
    expect(s1).toBe(1);
    expect(s2).toBe(2);
    expect(s3).toBe(3);
  });

  it('preserves formats properly', () => {
    const std = sequenceService.formatStandardSequence('HMS', 145);
    expect(std).toMatch(/^HMS-\d{4}-000145$/);

    const ts = sequenceService.formatTimestampSequence('ADM', 15);
    expect(ts).toMatch(/^ADM-\d+-15$/);
  });

  it('handles highly concurrent generation safely', async () => {
    const promises = Array.from({ length: 100 }).map(() =>
      sequenceService.getNextSequence('concurrent_test')
    );
    const results = await Promise.allSettled(promises);
    const sequences = results
      .map(r => (r.status === 'fulfilled' ? r.value : null))
      .filter(v => v !== null) as number[];

    expect(sequences.length).toBe(100);
    const unique = new Set(sequences);
    expect(unique.size).toBe(100);
    expect(Math.max(...sequences)).toBe(100);
  });

  it('does not reuse sequences after deletion', async () => {
    const s1 = await sequenceService.getNextSequence('deletion_test');
    await PatientModel.deleteOne({}); // emulate deletion of business entity (sequence isn't touched)
    const s2 = await sequenceService.getNextSequence('deletion_test');
    expect(s2).toBe(s1 + 1); // Sequence advances regardless of deleted business logic
  });
});
