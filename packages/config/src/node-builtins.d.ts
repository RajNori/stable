declare const process: {
  env: Record<string, string | undefined>;
};

declare const URL: {
  new (path: string, base?: string | URL): URL;
};

interface URL {
  hash: string;
  hostname: string;
  href: string;
  origin: string;
  password: string;
  pathname: string;
  port: string;
  protocol: string;
  search: string;
  username: string;
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
