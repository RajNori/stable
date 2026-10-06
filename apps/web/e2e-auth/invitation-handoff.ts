import {
  expect,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

export function invitationTokenFromLink(link: string): string {
  const url = new URL(link);
  expect(url.searchParams.has("token")).toBe(false);
  expect(link.includes("?token=")).toBe(false);
  expect(url.pathname).toBe("/invitations/accept");
  const token = url.hash.startsWith("#") ? url.hash.slice(1) : "";
  expect(token).toMatch(/^[0-9a-f]{64}$/);
  return token;
}

export async function openInvitationAcceptance(
  page: Page,
  link: string,
): Promise<string> {
  const token = invitationTokenFromLink(link);
  const current = new URL(page.url());
  const expectsDocument =
    current.pathname !== "/invitations/accept" || current.search.length > 0;
  const requestUrls: string[] = [];
  const documents: Array<Promise<{ url: string; html: string }>> = [];
  const onRequest = (request: Request) => {
    requestUrls.push(request.url());
  };
  const onResponse = (response: Response) => {
    if (response.request().method() !== "GET") {
      return;
    }
    if (new URL(response.url()).pathname !== "/invitations/accept") {
      return;
    }
    documents.push(
      response.text().then((html) => ({ url: response.url(), html })),
    );
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Accept invitation" }),
  ).toBeVisible();
  const bodies = await Promise.all(documents);
  page.off("request", onRequest);
  page.off("response", onResponse);
  if (expectsDocument) {
    expect(bodies.length).toBeGreaterThan(0);
  }
  for (const body of bodies) {
    expect(body.url.includes(token)).toBe(false);
    expect(body.html.includes(token)).toBe(false);
  }
  expect(page.url().includes(token)).toBe(false);
  expect(page.url().includes("?token=")).toBe(false);
  expect(requestUrls.some((url) => url.includes(token))).toBe(false);
  const stored = await page.evaluate((secret) => {
    return [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage),
      document.cookie,
    ].some((value) => value.includes(secret));
  }, token);
  expect(stored).toBe(false);
  return token;
}

export function watchAcceptancePost(page: Page, token: string): () => void {
  let postContainedToken = false;
  const onRequest = (request: Request) => {
    if (request.method() !== "POST") {
      expect(request.url().includes(token)).toBe(false);
      return;
    }
    const body = request.postData() ?? "";
    if (body.includes(token)) {
      postContainedToken = true;
    }
    expect(request.url().includes(token)).toBe(false);
  };
  page.on("request", onRequest);
  return () => {
    page.off("request", onRequest);
    expect(postContainedToken).toBe(true);
    expect(page.url().includes(token)).toBe(false);
  };
}

const CLIENT_RUNTIME_MARKER = "__stableClientRuntime";

export async function markClientRuntime(page: Page): Promise<void> {
  await page.evaluate((marker) => {
    Reflect.set(window, marker, "open");
  }, CLIENT_RUNTIME_MARKER);
}

export async function clientRuntimeSurvived(page: Page): Promise<boolean> {
  return page.evaluate((marker) => {
    return Reflect.get(window, marker) === "open";
  }, CLIENT_RUNTIME_MARKER);
}

export async function pushClientRoute(page: Page, href: string): Promise<void> {
  await page.evaluate((path) => {
    const nextHost: unknown = Reflect.get(window, "next");
    if (
      typeof nextHost !== "object" ||
      nextHost === null ||
      !("router" in nextHost)
    ) {
      throw new Error("Expected client navigation.");
    }
    const router: unknown = Reflect.get(nextHost, "router");
    if (typeof router !== "object" || router === null || !("push" in router)) {
      throw new Error("Expected client navigation.");
    }
    const push: unknown = Reflect.get(router, "push");
    if (typeof push !== "function") {
      throw new Error("Expected client navigation.");
    }
    Reflect.apply(push, router, [path]);
  }, href);
}
