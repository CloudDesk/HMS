import { describe, it, expect } from 'vitest';
import { appConfig } from './config';

describe('App configuration baseline test', () => {
  it('should have apiBaseUrl and staffWebUrl properties', () => {
    expect(appConfig).toHaveProperty('apiBaseUrl');
    expect(appConfig).toHaveProperty('staffWebUrl');
    expect(appConfig.apiBaseUrl).toBeTypeOf('string');
  });
});
