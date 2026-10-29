import type { MpesaAttemptService } from './mpesa-attempt.service.js';
import type { parseMpesaReconciliationConfiguration } from '../../config/mpesa.js';

export class MpesaReconciliationWorker {
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  private stopped = false;
  private readonly shutdown = new AbortController();

  constructor(
    private readonly service: Pick<MpesaAttemptService, 'reconcileEligible'>,
    private readonly config: ReturnType<typeof parseMpesaReconciliationConfiguration>,
    private readonly onError: () => void,
  ) {}

  start() {
    if (!this.config.enabled || this.stopped || this.timer) return;
    this.timer = setInterval(() => { void this.runOnce(); }, this.config.intervalMs);
    this.timer.unref();
  }

  runOnce(): Promise<void> {
    if (!this.config.enabled || this.stopped) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = Promise.resolve()
      .then(() => this.service.reconcileEligible({ limit: this.config.batchSize }, undefined, this.shutdown.signal))
      .then(() => undefined)
      .catch(() => { this.onError(); })
      .finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.shutdown.abort();
    await this.inFlight;
  }
}
