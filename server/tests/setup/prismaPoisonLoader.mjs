// An ESM resolve hook that makes ANY attempt to load Prisma an immediate,
// unmistakable failure.
//
// Used by tests/integration/mongoBootstrap.test.js to prove a claim that
// static inspection cannot: that booting with DATABASE_PROVIDER=mongo never
// touches `@prisma/client`. A grep can show there is no static import; only
// running the real module graph with Prisma poisoned shows that no dynamic
// import reaches it either.
//
// It is also the negative control. On the prisma path the very same command
// MUST fail here — if it did not, the hook would not be proving anything.

export async function resolve(specifier, context, next) {
  if (specifier === "@prisma/client" || /config[\\/]prisma\.js$/.test(specifier)) {
    throw new Error(`BOOT_TOUCHED_PRISMA:${specifier}`);
  }
  return next(specifier, context);
}
