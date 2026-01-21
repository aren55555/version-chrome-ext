import { z } from 'zod';

const JsonPatternConfigSchema = z.object({
  pattern: z.string(),
  sourceType: z.literal('json'),
  jsonPath: z.string(),
});

const HtmlPatternConfigSchema = z.object({
  pattern: z.string(),
  sourceType: z.literal('html'),
  metaTag: z.string(),
});

export const PatternConfigSchema = z.discriminatedUnion('sourceType', [
  JsonPatternConfigSchema,
  HtmlPatternConfigSchema,
]);

export const UrlMappingsSchema = z.record(z.string(), z.array(PatternConfigSchema));

export const StorageDataSchema = z.object({
  urlMappings: UrlMappingsSchema,
});

export type PatternConfig = z.infer<typeof PatternConfigSchema>;
export type UrlMappings = z.infer<typeof UrlMappingsSchema>;
export type StorageData = z.infer<typeof StorageDataSchema>;

// Legacy format schemas for migration
const LegacyConfigSchema = z.object({
  repo: z.string().optional(),
  sourceType: z.enum(['json', 'html']).optional(),
  jsonPath: z.string().optional(),
  metaTag: z.string().optional(),
});

const LegacyMappingsSchema = z.record(z.string(), z.union([z.string(), LegacyConfigSchema]));

export type LegacyConfig = z.infer<typeof LegacyConfigSchema>;
export type LegacyMappings = z.infer<typeof LegacyMappingsSchema>;

function isLegacyFormat(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const values = Object.values(data);
  if (values.length === 0) return false;
  return !Array.isArray(values[0]);
}

function migrateLegacyMappings(legacy: LegacyMappings): UrlMappings {
  const result: UrlMappings = {};
  for (const [pattern, config] of Object.entries(legacy)) {
    const repo = typeof config === 'string' ? config : config.repo!;
    const sourceType = typeof config === 'object' ? (config.sourceType || 'json') : 'json';
    const jsonPath = typeof config === 'object' ? (config.jsonPath || '$.version') : '$.version';
    const metaTag = typeof config === 'object' ? (config.metaTag || '') : '';

    if (!result[repo]) {
      result[repo] = [];
    }

    if (sourceType === 'json') {
      result[repo].push({ pattern, sourceType: 'json', jsonPath });
    } else {
      result[repo].push({ pattern, sourceType: 'html', metaTag });
    }
  }
  return result;
}

export function parseUrlMappings(data: unknown): UrlMappings {
  if (!data || typeof data !== 'object') {
    return {};
  }

  if (isLegacyFormat(data)) {
    const legacy = LegacyMappingsSchema.parse(data);
    return migrateLegacyMappings(legacy);
  }

  return UrlMappingsSchema.parse(data);
}

export function parseStorageData(data: unknown): StorageData {
  if (!data || typeof data !== 'object') {
    return { urlMappings: {} };
  }

  const obj = data as Record<string, unknown>;
  return {
    urlMappings: parseUrlMappings(obj.urlMappings),
  };
}
