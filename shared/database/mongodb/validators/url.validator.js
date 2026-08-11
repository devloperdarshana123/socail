// Basic format check for fields storing a URL (website, fileUrl,
// documentUrl, linkUrl, …). Deliberately permissive — this is a structural
// sanity check, not a security boundary. Empty/undefined values are left to
// each field's own `required` setting, not this validator.
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

export function isValidUrl(value) {
  if (value === undefined || value === null || value === "") return true;
  return URL_PATTERN.test(value);
}

export const urlValidator = {
  validator: isValidUrl,
  message: (props) => `${props.path} must be a valid http(s) URL`,
};
