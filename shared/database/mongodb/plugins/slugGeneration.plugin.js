// Auto-generates a URL-safe `slug` from a source field (default `name`) on
// save, if one isn't already set. Applied to `categories` — the one
// collection in the approved design with a `slug` field.
function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugGenerationPlugin(schema, { sourceField = "name", slugField = "slug" } = {}) {
  schema.pre("validate", function slugGenerationPreValidate() {
    if (!this[slugField] && this[sourceField]) {
      this[slugField] = slugify(this[sourceField]);
    }
  });
}

export { slugify };
