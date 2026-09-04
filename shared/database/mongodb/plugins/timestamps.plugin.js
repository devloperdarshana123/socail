// Applies Mongoose's built-in timestamps behavior consistently across
// every schema — createdAt/updatedAt, matching the field names every
// Prisma model already used, so nothing shifts for existing consumers.
export function timestampsPlugin(schema) {
  schema.set("timestamps", { createdAt: "createdAt", updatedAt: "updatedAt" });
}
