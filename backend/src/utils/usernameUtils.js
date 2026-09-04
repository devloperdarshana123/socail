// ─────────────────────────────────────────────
//  usernameUtils.js
//  Username suggestions generate karna — name + email se
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  Clean a string → lowercase, only a-z 0-9 dot underscore
// ─────────────────────────────────────────────
const cleanPart = (str = "") =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._]/g, ""); // sirf allowed chars

// ─────────────────────────────────────────────
//  Extract parts from fullName
//  "Rahul Sharma" → { first: "rahul", last: "sharma" }
// ─────────────────────────────────────────────
const getNameParts = (fullName = "") => {
  const parts = fullName.trim().split(/\s+/);
  const first = cleanPart(parts[0] || "");
  const last = cleanPart(parts[1] || "");
  return { first, last };
};

// ─────────────────────────────────────────────
//  Extract prefix from email
//  "rahul.sharma@gmail.com" → "rahul.sharma"
// ─────────────────────────────────────────────
const getEmailPrefix = (email = "") => {
  const prefix = email.split("@")[0] || "";
  return cleanPart(prefix);
};

// ─────────────────────────────────────────────
//  Random 2-digit suffix
// ─────────────────────────────────────────────
const randomSuffix = () => Math.floor(10 + Math.random() * 90).toString(); // 10–99

// ─────────────────────────────────────────────
//  Generate raw candidates from name + email
//  Returns array of strings (may have duplicates / empty)
// ─────────────────────────────────────────────
const generateCandidates = (fullName, email) => {
  const { first, last } = getNameParts(fullName);
  const emailPrefix = getEmailPrefix(email);

  const candidates = [];

  // ── Name based ──────────────────────────────
  if (first) {
    candidates.push(first); // rahul
    candidates.push(`${first}${randomSuffix()}`); // rahul42
    candidates.push(`${first}_${randomSuffix()}`); // rahul_42
  }

  if (first && last) {
    candidates.push(`${first}.${last}`); // rahul.sharma
    candidates.push(`${first}_${last}`); // rahul_sharma
    candidates.push(`${first}${last}`); // rahulsharma
    candidates.push(`${first}.${last}${randomSuffix()}`); // rahul.sharma23
    candidates.push(`${first[0]}${last}`); // rsharma
    candidates.push(`${first[0]}.${last}`); // r.sharma
    candidates.push(`${first}${last[0]}`); // rahuls
  }

  if (last) {
    candidates.push(`${last}${randomSuffix()}`); // sharma42
  }

  // ── Email based ─────────────────────────────
  if (emailPrefix) {
    candidates.push(emailPrefix); // rahul.sharma (from email)
    candidates.push(`${emailPrefix}${randomSuffix()}`); // rahul.sharma42
  }

  return candidates;
};

// ─────────────────────────────────────────────
//  Validate a single username
//  Rules same as user.model.js:
//    - 3–30 chars
//    - only a-z 0-9 . _
// ─────────────────────────────────────────────
export const isValidUsername = (username) => {
  if (!username || username.length < 3 || username.length > 30) return false;
  return /^[a-z0-9._]+$/.test(username);
};

// ─────────────────────────────────────────────
//  generateUsernameSuggestions
//
//  @param {string} fullName
//  @param {string} email
//  @param {Function} checkAvailability  — async (username) => boolean
//     true = available, false = taken
//  @param {number} count  — kitne suggestions chahiye (default 5)
//
//  @returns {string[]}  — available usernames
// ─────────────────────────────────────────────
export const generateUsernameSuggestions = async (
  fullName,
  email,
  checkAvailability,
  count = 5,
) => {
  // Generate multiple sets to have enough after filtering
  const allCandidates = new Set();

  // 3 rounds to get variety (random suffixes change each round)
  for (let i = 0; i < 3; i++) {
    const candidates = generateCandidates(fullName, email);
    candidates.forEach((c) => allCandidates.add(c));
  }

  // Filter: valid format only
  const valid = [...allCandidates].filter(isValidUsername);

  // Check availability in parallel — DB hit ek baar mein
  const results = await Promise.all(
    valid.map(async (username) => ({
      username,
      available: await checkAvailability(username),
    })),
  );

  const available = results
    .filter((r) => r.available)
    .map((r) => r.username)
    .slice(0, count);

  return available;
};
