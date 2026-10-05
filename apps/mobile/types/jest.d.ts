interface MobileExpect {
  toBe(expected: unknown): void;
  toBeNull(): void;
  toBeTruthy(): void;
  toEqual(expected: unknown): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toThrow(expected?: RegExp | string): void;
}

declare function describe(name: string, fn: () => void): void;

declare function it(name: string, fn: () => void | Promise<void>): void;

declare function expect(actual: unknown): MobileExpect;
