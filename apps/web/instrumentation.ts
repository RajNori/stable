export async function register(): Promise<void> {
  const { loadWebBootEnv } = await import("./lib/boot-env.server");
  loadWebBootEnv();
}
