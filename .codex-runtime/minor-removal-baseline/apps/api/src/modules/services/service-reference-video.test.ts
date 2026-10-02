import { describe, expect, it } from 'vitest';
import { ServiceModel } from './service.model.js';
import { createServiceBodySchema, updateServiceBodySchema } from './service.schemas.js';

describe('Service Catalogue procedure reference video', () => {
  it('stores reference video metadata on the service model', () => {
    expect(ServiceModel.schema.path('referenceVideoUrl')).toBeDefined();
    expect(ServiceModel.schema.path('referenceVideoTitle')).toBeDefined();
  });

  it('accepts reference video fields in create and edit request schemas', () => {
    expect(createServiceBodySchema.properties.reference_video_url).toEqual(
      expect.objectContaining({ pattern: '^https?://' }),
    );
    expect(updateServiceBodySchema.properties.reference_video_title).toEqual(
      expect.objectContaining({ maxLength: 200 }),
    );
  });
});
