// notifications.meta and auditLogs.targetMeta are intentionally
// polymorphic — their shape varies by `type`/`category` (order info, post
// info, moderation context, …). A fixed-shape subdocument would be wrong
// here; a fixed *type* with a structural guard is what's reusable instead.
export function metadataGuard(value) {
  if (value === undefined || value === null) return true;
  return typeof value === "object" && !Array.isArray(value);
}

export const metadataValidator = {
  validator: metadataGuard,
  message: (props) => `${props.path} must be a plain object, not an array or primitive`,
};

// Usage in a schema: `meta: { type: Schema.Types.Mixed, validate: metadataValidator }`
