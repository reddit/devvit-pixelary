// Types
export type T1 = `t1_${string}`;
export type T2 = `t2_${string}`;
export type T3 = `t3_${string}`;
export type T4 = `t4_${string}`;
export type T5 = `t5_${string}`;

// Type guards
export function isT1(id: string): id is T1 {
  return id.startsWith('t1_');
}
export function isT2(id: string): id is T2 {
  return id.startsWith('t2_');
}

export function isT3(id: string): id is T3 {
  return id.startsWith('t3_');
}

export function isT4(id: string): id is T4 {
  return id.startsWith('t4_');
}

export function isT5(id: string): id is T5 {
  return id.startsWith('t5_');
}

// Assertions
export function assertT1(id: string): asserts id is T1 {
  if (!isT1(id)) throw new Error('Invalid ID: ' + id);
}

export function assertT2(id: string): asserts id is T2 {
  if (!isT2(id)) throw new Error('Invalid ID: ' + id);
}

export function assertT3(id: string): asserts id is T3 {
  if (!isT3(id)) throw new Error('Invalid ID: ' + id);
}

export function assertT4(id: string): asserts id is T4 {
  if (!isT4(id)) throw new Error('Invalid ID: ' + id);
}

export function assertT5(id: string): asserts id is T5 {
  if (!isT5(id)) throw new Error('Invalid ID: ' + id);
}

// Parsing
export function parseT1(id: string): T1 {
  assertT1(id);
  return id as T1;
}

export function parseT2(id: string): T2 {
  assertT2(id);
  return id as T2;
}

export function parseT3(id: string): T3 {
  assertT3(id);
  return id as T3;
}

export function parseT4(id: string): T4 {
  assertT4(id);
  return id as T4;
}

export function parseT5(id: string): T5 {
  assertT5(id);
  return id as T5;
}

/*
 * Color types
 */

export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type HEX = `#${string}`;

/**
 * Progression system
 */

export type Level = {
  rank: number;
  name: string;
  min: number;
  max: number;
  extraTime: number;
};
