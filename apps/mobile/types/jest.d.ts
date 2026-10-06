interface MobileExpect {
  toBe(expected: unknown): void;
  toBeNull(): void;
  toBeTruthy(): void;
  toEqual(expected: unknown): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeDefined(): void;
  toContain(expected: string): void;
  toMatchObject(expected: Record<string, unknown>): void;
  toThrow(expected?: RegExp | string): void;
  not: MobileExpect;
  rejects: MobileExpect;
}

declare function describe(name: string, fn: () => void): void;

declare function it(name: string, fn: () => void | Promise<void>): void;

declare function afterEach(fn: () => void): void;

declare function expect(actual: unknown): MobileExpect;
