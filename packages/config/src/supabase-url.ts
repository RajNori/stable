import { ApplicationError } from "@stable/contracts";
import type { AppEnv } from "@stable/contracts";

export type ClientTarget = "web" | "mobile";

const NAMED_LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const IPV4_OCTET = "(?:0|[1-9]\\d?|1\\d{2}|2[0-4]\\d|25[0-5])";
const IPV4_HOST = new RegExp(
  `^(${IPV4_OCTET})\\.(${IPV4_OCTET})\\.(${IPV4_OCTET})\\.(${IPV4_OCTET})$`,
);

function unwrapHost(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]") && host.length > 2) {
    return host.slice(1, -1);
  }
  return host;
}

function ipv4Octets(
  hostname: string,
): readonly [number, number, number, number] | null {
  const match = IPV4_HOST.exec(hostname);
  if (match === null) {
    return null;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = Number(match[3]);
  const fourth = Number(match[4]);
  if (
    Number.isNaN(first) ||
    Number.isNaN(second) ||
    Number.isNaN(third) ||
    Number.isNaN(fourth)
  ) {
    return null;
  }

  return [first, second, third, fourth];
}

function isNamedLoopback(hostname: string): boolean {
  return NAMED_LOOPBACK_HOSTS.has(unwrapHost(hostname));
}

function isLoopbackRange(hostname: string): boolean {
  if (isNamedLoopback(hostname)) {
    return true;
  }

  const octets = ipv4Octets(unwrapHost(hostname));
  if (octets === null) {
    return false;
  }

  return octets[0] === 127;
}

function isRfc1918(hostname: string): boolean {
  const octets = ipv4Octets(unwrapHost(hostname));
  if (octets === null) {
    return false;
  }

  const [first, second] = octets;
  if (first === 10) {
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }

  return false;
}

function isSupabaseHost(hostname: string): boolean {
  return unwrapHost(hostname).includes("supabase.co");
}

/**
 * Mobile APP_ENV=local allowlist.
 * There is no extra environment variable for a LAN host. This allowlist is
 * the configuration: loopback (localhost, 127.0.0.1, ::1), the Android
 * emulator host 10.0.2.2, and RFC1918 (10.0.0.0/8, 172.16.0.0/12,
 * 192.168.0.0/16). 10.0.2.2 is allowed because it is inside 10.0.0.0/8.
 */
function isMobileLocalHost(hostname: string): boolean {
  return isNamedLoopback(hostname) || isRfc1918(hostname);
}

function httpHostname(url: string): string {
  const trimmed = url.trim();
  const httpMatch =
    /^(https?):\/\/(\[[^\]]+\]|[^/?#:]+)(?::\d+)?(?:[/?#]|$)/i.exec(trimmed);
  if (httpMatch === null) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        "Supabase URL must use http or https.",
      );
    }

    throw new ApplicationError(
      "VALIDATION_FAILED",
      "Supabase URL is not a valid absolute URL.",
    );
  }

  const hostname = httpMatch[2];
  if (hostname === undefined || hostname.length === 0) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      "Supabase URL is not a valid absolute URL.",
    );
  }

  return hostname;
}

/**
 * Local auth bootstrap is development tooling. It accepts the mobile local
 * allowlist and rejects hosted Supabase projects before any Admin API call.
 */
export function assertLocalDevelopmentSupabaseUrl(url: string): void {
  try {
    assertSupabaseUrl(url, "local", "mobile");
  } catch (error: unknown) {
    const reason =
      error instanceof Error ? error.message : "The URL is invalid.";
    throw new Error(
      `Refusing to bootstrap auth because this script is local-development tooling only. ${reason}`,
      { cause: error },
    );
  }
}

export function assertSupabaseUrl(
  url: string,
  appEnv: AppEnv,
  target: ClientTarget,
): void {
  const hostname = unwrapHost(httpHostname(url));

  if (appEnv === "local") {
    if (isSupabaseHost(hostname)) {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        "Local Supabase URL must not use a supabase.co host.",
      );
    }

    if (target === "web") {
      if (!isNamedLoopback(hostname)) {
        throw new ApplicationError(
          "VALIDATION_FAILED",
          "Web local Supabase URL must be loopback (localhost, 127.0.0.1, or ::1).",
        );
      }
      return;
    }

    if (!isMobileLocalHost(hostname)) {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        "Mobile local Supabase URL must be loopback or an RFC1918 LAN host.",
      );
    }
    return;
  }

  if (isLoopbackRange(hostname) || isRfc1918(hostname)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      "Staging and production Supabase URLs must not use loopback or private LAN hosts.",
    );
  }
}
