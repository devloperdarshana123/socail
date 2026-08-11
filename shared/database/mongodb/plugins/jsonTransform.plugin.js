// Standardizes the API-facing JSON shape across every model: `_id` becomes
// `id` (string), `__v` is stripped. Applied to all 37 schemas so every
// consumer (REST responses, socket payloads) sees the same document shape
// regardless of which collection it came from. Sensitive fields (e.g.
// users.passwordHash) are hidden at the field level via `select: false` in
// their own schema definition, not here — this plugin only reshapes what's
// already been fetched.
export function jsonTransformPlugin(schema) {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id?.toString();
      delete ret._id;
      return ret;
    },
  });
}
