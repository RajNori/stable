/**
 * Node's type stripper does not map workspace `.js` specifiers to `.ts`.
 * This hook is only for local scripts such as auth bootstrap.
 */
export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  if (relative && specifier.endsWith(".js")) {
    try {
      return await nextResolve(specifier.replace(/\.js$/, ".ts"), context);
    } catch {
      return nextResolve(specifier, context);
    }
  }

  return nextResolve(specifier, context);
}
