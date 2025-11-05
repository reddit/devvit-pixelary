import { z } from 'zod';

export { z };

export function parseForm<T>(schema: z.ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

export function safeParseForm<T>(
  schema: z.ZodType<T>,
  body: unknown
): ReturnType<typeof schema.safeParse> {
  return schema.safeParse(body);
}
