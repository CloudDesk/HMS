import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';

describe('Sequence Service & Concurrency', () => {
  let sequenceService: SequenceService;

  before(async () => {
    await setupTestDatabase();
    sequenceService = new SequenceService();
    await clearTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('generates sequential numbers', async () => {
    const s1 = await sequenceService.getNextSequence('test_seq');
    const s2 = await sequenceService.getNextSequence('test_seq');
    const s3 = await sequenceService.getNextSequence('test_seq');
    assert.strictEqual(s1, 1);
    assert.strictEqual(s2, 2);
    assert.strictEqual(s3, 3);
  });

  it('preserves formats properly', () => {
    const std = sequenceService.formatStandardSequence('HMS', 145);
    assert.match(std, /^HMS-\d{4}-000145$/);

    const ts = sequenceService.formatTimestampSequence('ADM', 15);
    assert.match(ts, /^ADM-\d+-15$/);
  });

  it('handles highly concurrent generation safely', async () => {
    const promises = Array.from({ length: 100 }).map(() =>
      sequenceService.getNextSequence('concurrent_test')
    );
    const results = await Promise.allSettled(promises);
    const sequences = results
      .map(r => (r.status === 'fulfilled' ? r.value : null))
      .filter(v => v !== null) as number[];

    assert.strictEqual(sequences.length, 100);
    const unique = new Set(sequences);
    assert.strictEqual(unique.size, 100);
    assert.strictEqual(Math.max(...sequences), 100);
  });

  it('does not reuse sequences after deletion', async () => {
    const s1 = await sequenceService.getNextSequence('deletion_test');
    await PatientModel.deleteOne({}); // emulate deletion of business entity (sequence isn't touched)
    const s2 = await sequenceService.getNextSequence('deletion_test');
    assert.strictEqual(s2, s1 + 1); // Sequence advances regardless of deleted business logic
  });
});
