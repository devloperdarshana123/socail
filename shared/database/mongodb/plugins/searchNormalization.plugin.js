// Maintains a lowercased, trimmed `<field>Normalized` companion field in
// sync with a source text field, for consistent case-insensitive search
// alongside the text indexes defined in ../indexes. Applied to
// hashtags.name and categories.name.
export function searchNormalizationPlugin(schema, { sourceField = "name" } = {}) {
  const normalizedField = `${sourceField}Normalized`;

  schema.add({ [normalizedField]: { type: String } });

  schema.pre("validate", function searchNormalizationPreValidate() {
    if (this[sourceField]) {
      this[normalizedField] = String(this[sourceField]).trim().toLowerCase();
    }
  });
}
