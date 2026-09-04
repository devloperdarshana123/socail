export { isValidGeoJSONCoordinates, geoPointValidator } from "./geoPoint.validator.js";
export { isValidObjectId, objectIdValidator } from "./objectId.validator.js";
export { isValidUrl, urlValidator } from "./url.validator.js";
export { isValidEmail, emailValidator } from "./email.validator.js";

// Business-rule validation that MongoDB/Mongoose cannot structurally
// enforce is intentionally NOT implemented here — per Milestone 2, Step 6,
// it's documented instead:
//
// - A company must keep at least one `company_owner` companyMember on
//   removal — enforced by the repository layer (Milestone 3+), not here.
// - marketplaceListings can only move to status "active" once the owning
//   company's verificationStatus is "verified" — same, repository layer.
// - Report/like/follow uniqueness-per-target is enforced via compound
//   unique indexes (see ../indexes), not application validators.
// - Cross-collection referential integrity (e.g. a socialPosts.authorId
//   pointing at a real users document) is NOT enforced by MongoDB and is
//   NOT implemented in this milestone — see the Phase 2 Risk Assessment's
//   "Referential integrity is no longer enforced by the database" entry.
//   This becomes the repository layer's responsibility in Milestone 3+.
// - Polymorphic owner/target fields (verificationCases.subjectType/
//   subjectId, locations.ownerType/ownerId, likes.targetType/targetId,
//   reports.targetType/targetId, notifications.refType/refId) store the
//   approved lowercase semantic type value, not a Mongoose model name, so
//   they intentionally do NOT use Mongoose's `refPath` dynamic-ref feature
//   (which requires an exact model-name match). Resolving these to the
//   right model for populate() is a repository-layer concern — e.g. a
//   small `{ post: "SocialPost", user: "User", ... }` lookup table used at
//   query time, not implemented in this schema layer.
