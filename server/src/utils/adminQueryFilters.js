/**
 * Roles jo admin-only hain — dashboard stats mein count nahi honge.
 * Agar future mein naya admin role aaye toh sirf yahan add karo.
 */
export const ADMIN_ROLES = Object.freeze(["super_admin", "admin", "moderator"]);

/**
 * Reusable Mongoose filter — sirf regular users count karo.
 * Har dashboard query mein spread karo: { ...REGULAR_USER_FILTER, ... }
 */
export const REGULAR_USER_FILTER = Object.freeze({
  role: { $nin: ADMIN_ROLES },
});