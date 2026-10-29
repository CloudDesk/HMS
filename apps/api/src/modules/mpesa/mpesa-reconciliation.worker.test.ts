import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMpesaReconciliationConfiguration } from '../../config/mpesa.js';
import { MpesaReconciliationWorker } from './mpesa-reconciliation.worker.js';
import { reconciliationDelay } from './mpesa-reconciliation.policy.js';

describe('M-PESA reconciliation worker lifecycle', () => {
  afterEach(() => vi.useRealTimers());
  const report = { processed: 0, resolved: 0, unresolved: 0, conflicts: 0 };
  const config = { enabled: true, intervalMs: 1000, batchSize: 3 };

  it('is disabled by default and rejects unsafe or malformed configuration', () => {
    expect(parseMpesaReconciliationConfiguration({})).toEqual({ enabled: false, intervalMs: 30000, batchSize: 10 });
    for (const values of [
      { MPESA_RECONCILIATION_ENABLED: 'true' }, { MPESA_RECONCILIATION_ENABLED: 'yes' },
      { MPESA_RECONCILIATION_INTERVAL_MS: '0' }, { MPESA_RECONCILIATION_BATCH_SIZE: '51' },
    ]) expect(() => parseMpesaReconciliationConfiguration(values)).toThrow('M-PESA reconciliation');
    expect(parseMpesaReconciliationConfiguration({ MPESA_STK_ENABLED: 'true', MPESA_RECONCILIATION_ENABLED: 'true' }).enabled).toBe(true);
  });

  it('does not process anything when disabled', async () => {
    vi.useFakeTimers();
    const service = { reconcileEligible: vi.fn().mockResolvedValue(report) };
    const worker = new MpesaReconciliationWorker(service, { ...config, enabled: false }, vi.fn());
    worker.start();
    await vi.advanceTimersByTimeAsync(5000);
    await worker.runOnce();
    await worker.stop();
    expect(service.reconcileEligible).not.toHaveBeenCalled();
  });

  it('starts only one timer and submits bounded batches without staff impersonation', async () => {
    vi.useFakeTimers();
    const service = { reconcileEligible: vi.fn().mockResolvedValue(report) };
    const worker = new MpesaReconciliationWorker(service, config, vi.fn());
    worker.start(); worker.start();
    await vi.advanceTimersByTimeAsync(2100);
    expect(service.reconcileEligible).toHaveBeenCalledTimes(2);
    expect(service.reconcileEligible).toHaveBeenCalledWith({ limit: 3 }, undefined, expect.any(AbortSignal));
    await worker.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.reconcileEligible).toHaveBeenCalledTimes(2);
  });

  it('never overlaps sweeps, cancels between attempts and drains in-flight work on stop', async () => {
    vi.useFakeTimers();
    let finish: () => void = () => { throw new Error('Deferred sweep not initialized'); };
    const pending = new Promise<typeof report>((resolve) => { finish = () => resolve(report); });
    const service = { reconcileEligible: vi.fn().mockReturnValue(pending) };
    const worker = new MpesaReconciliationWorker(service, config, vi.fn());
    worker.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.reconcileEligible).toHaveBeenCalledOnce();
    let stopped = false;
    const stop = worker.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    expect(service.reconcileEligible.mock.calls[0][2].aborted).toBe(true);
    finish(); await stop;
    await vi.advanceTimersByTimeAsync(5000);
    expect(service.reconcileEligible).toHaveBeenCalledOnce();
  });

  it('reports failures without exposing raw errors and continues on the next interval', async () => {
    vi.useFakeTimers();
    const service = { reconcileEligible: vi.fn().mockRejectedValueOnce(new Error('synthetic-secret')).mockResolvedValue(report) };
    const onError = vi.fn();
    const worker = new MpesaReconciliationWorker(service, config, onError);
    worker.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onError).toHaveBeenCalledWith();
    expect(service.reconcileEligible).toHaveBeenCalledTimes(2);
    await worker.stop();
  });

  it('caps exponential retry delays', () => {
    expect([1, 2, 3, 4, 5].map(reconciliationDelay)).toEqual([30000, 60000, 120000, 240000, 300000]);
  });
});
