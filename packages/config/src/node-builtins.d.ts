declare const process: {
  env: Record<string, string | undefined>;
};

declare const URL: {
  new (path: string, base?: string | URL): URL;
};

interface URL {
  href: string;
}

interface ImportMeta {
  url: string;
}

declare module "node:fs" {
  export function readFileSync(path: string | URL, encoding: "utf8"): string;
}

declare module "node:url" {
  export function fileURLToPath(url: URL): string;
}

declare module "node:child_process" {
  export function spawnSync(
    command: string,
    args: readonly string[],
    options: {
      cwd: string;
      encoding: "utf8";
      env: Record<string, string | undefined>;
    },
  ): {
    status: number | null;
    stdout: string;
    stderr: string;
  };
}
