// Basic format check for User.email. Existence/uniqueness are handled by
// `required`/`unique` on the field itself — this only checks shape.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  if (value === undefined || value === null || value === "") return true;
  return EMAIL_PATTERN.test(value);
}

export const emailValidator = {
  validator: isValidEmail,
  message: (props) => `${props.path} must be a valid email address`,
};
