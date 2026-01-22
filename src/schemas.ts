import { z } from 'zod';

export const PATTERN_CONFIG_SCHEMA = z.discriminatedUnion('sourceType', [
  z.object({
    pattern: z.string(),
    sourceType: z.literal('json'),
    jsonPath: z.string(),
  }),
  z.object({
    pattern: z.string(),
    sourceType: z.literal('html'),
    metaTag: z.string(),
}),
]);

export const URL_MAPPINGS_SCHEMA = z.record(z.string(), z.array(PATTERN_CONFIG_SCHEMA));

export const STORAGE_DATA_SCHEMA = z.object({
  urlMappings: URL_MAPPINGS_SCHEMA,
});

export type PatternConfig = z.infer<typeof PATTERN_CONFIG_SCHEMA>;
export type UrlMappings = z.infer<typeof URL_MAPPINGS_SCHEMA>;
export type StorageData = z.infer<typeof STORAGE_DATA_SCHEMA>;

export function parseUrlMappings(data: unknown): UrlMappings {
  const result = URL_MAPPINGS_SCHEMA.safeParse(data);
  return result.success ? result.data : {};
}

const DEFAULT: StorageData = { urlMappings: {} };

export function parseStorageData(data: unknown): StorageData {
  if (!data || typeof data !== 'object') {
    return DEFAULT;
  }

  const result = STORAGE_DATA_SCHEMA.safeParse(data);
  if (!result.success) {
    return DEFAULT;
  }

  return result.data;
}
