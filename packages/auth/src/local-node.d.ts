declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string): string;
}

declare const process: {
  env: Record<string, string | undefined>;
};

declare class URL {
  constructor(url: string, base?: string);
  toString(): string;
}

declare function setTimeout(callback: () => void, ms: number): unknown;

declare function fetch(
  input: string,
  init?: { redirect?: "manual"; method?: "DELETE" },
): Promise<{
  ok: boolean;
  json(): Promise<unknown>;
  headers: { get(name: string): string | null };
}>;

interface ImportMeta {
  readonly url: string;
}
