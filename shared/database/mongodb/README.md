# Erovians — Shared MongoDB Data Layer

Milestone 2 of the MongoDB migration. This package is the **canonical
schema definition** for all 37 collections in the approved Phase 2
architecture — the fix for the Phase 1 audit's Critical finding (two
hand-maintained Prisma schema copies of the same database, already
drifted). `backend/` and `chat-server/` both import models from here;
neither defines its own copy of anything.

**Scope of this milestone:** schemas, models, indexes, and structural
validation only. No repositories, no controllers, no routes, no business
logic, no migration — see Milestone 3+ for those.

## Folder layout

```
shared/
├── package.json                  # own tiny package — declares mongoose, `npm install`d independently
└── database/mongodb/
    ├── index.js                   # ★ the single import surface — everything below is re-exported here
    ├── connection/
    │   └── index.js                # connectMongo/disconnectMongo — reusable, non-fatal, retry + graceful shutdown
    ├── constants/
    │   └── index.js                # every enum value list used across all schemas, in one place
    ├── validators/
    │   ├── geoPoint.validator.js    # GeoJSON coordinate-pair shape check
    │   ├── objectId.validator.js    # ObjectId shape check (for polymorphic ref fields — see below)
    │   ├── url.validator.js
    │   ├── email.validator.js
    │   └── index.js
    ├── plugins/
    │   ├── timestamps.plugin.js         # createdAt/updatedAt — applied to every schema
    │   ├── softDelete.plugin.js         # isDeleted/deletedAt + opt-in .notDeleted() query helper
    │   ├── auditFields.plugin.js        # createdBy/updatedBy — admin-managed reference data
    │   ├── jsonTransform.plugin.js      # _id→id, strips __v — applied to every schema
    │   ├── pagination.plugin.js         # Model.paginate(filter, {page, limit, sort})
    │   ├── slugGeneration.plugin.js     # auto-slug from a source field on save
    │   ├── searchNormalization.plugin.js # maintains a lowercase `<field>Normalized` companion
    │   └── index.js
    ├── schemas/
    │   ├── subdocuments/            # the 15 shared embedded schemas — see below
    │   ├── identity.schemas.js       # users, profiles, sessions, otps
    │   ├── companies.schemas.js      # companies, companyMembers, roles, permissions
    │   ├── verificationLocations.schemas.js  # verificationCases, verificationDocuments, locations
    │   ├── social.schemas.js         # socialPosts, comments, likes, follows, saved, blocks, stories, storyViews, postViews, highlights, hashtags
    │   ├── messaging.schemas.js      # conversations, conversationParticipants, messages, messageReceipts, notifications
    │   ├── marketplace.schemas.js    # categories, marketplaceListings, quotes, orders, contracts, payments
    │   └── compliance.schemas.js     # reports, suspensionHistory, auditLogs, consents
    ├── indexes/                     # one file per schema group, mirroring the names above —
    │                                  index STRATEGY kept separate from field shape so it can be
    │                                  reviewed/audited as one unit (Milestone 2, Step 5)
    └── models/
        └── index.js                 # imports every schema, compiles all 37 mongoose.model()s
```

## How backend/ and chat-server/ import this

Plain relative-path imports — no npm workspace, no root `package.json`.
`shared/` is its own small independent package (own `package.json`, own
`node_modules/mongoose`), exactly like `frontend/admin/`, `frontend/client/`, `chat-server/`
and `backend/` already each independently manage their own dependencies.
This is a deliberate, minimal-footprint choice for this milestone; a real
npm-workspaces setup could be introduced later during the Phase 4 folder
restructuring if desired, but that's out of scope here.

```js
// from anywhere in backend/src/... or chat-server/src/...
import { models, connectMongo, disconnectMongo } from "../../../shared/database/mongodb/index.js";

const post = await models.SocialPost.findById(id);
```

`backend/src/config/mongodb.js` is now a thin re-export of
`shared/database/mongodb/connection/index.js` (wrapped with server's own
winston logger) — see that file. `chat-server/` doesn't import anything
from this package yet; that starts when its repository layer is built.

## Naming conventions

- **Collection/model names** are PascalCase singular (`User`, `SocialPost`,
  `MarketplaceListing`) — the Mongoose model name, not the MongoDB
  collection name (Mongoose pluralizes/lowercases automatically:
  `SocialPost` → `socialposts`).
- **Files** are `camelCase.schema.js` / `camelCase.indexes.js` /
  `camelCase.plugin.js` / `camelCase.validator.js` — one word per concept,
  suffix says which layer it belongs to.
- **Group files** (`schemas/social.schemas.js`, `indexes/social.indexes.js`)
  are named after the Phase 2 architecture doc's own domain groupings
  (Identity & Access, Companies & Organizational Roles, Verification &
  Locations, Social Graph & Content, Messaging & Notifications,
  Marketplace, Trust/Moderation & Compliance) — if you're looking for a
  field, find its group in that doc first.

## Schema conventions

- Every schema applies `timestampsPlugin` and `jsonTransformPlugin` — no
  exceptions, applied last in the plugin call chain in each file (order
  doesn't matter for these two, but keeping them last is the convention).
- Enum values always come from `../constants/index.js` — never a literal
  array typed inline in a schema file. If a new enum value set doesn't
  exist yet, add it there first.
- Polymorphic fields (`likes.targetType/targetId`, `reports.targetType/
  targetId`, `notifications.refType/refId`, `verificationCases.subjectType/
  subjectId`, `locations.ownerType/ownerId`) intentionally do **not** use
  Mongoose's `refPath` — the stored type value is the approved lowercase
  semantic string (`"post"`, `"user"`), not a Mongoose model name, so
  dynamic `ref` resolution can't key off it directly. Resolving these to
  the right model for `populate()` is a repository-layer concern
  (Milestone 3+), not implemented here — see `validators/index.js`'s
  closing comment for the full list.
- Business-rule validation MongoDB/Mongoose can't structurally enforce
  (e.g. "a company must keep at least one owner", "a listing can't go
  active until its company is verified") is **documented, not
  implemented** — see the bottom of `validators/index.js`. What *is*
  implemented here: required fields, enums, min/max/length bounds, GeoJSON
  shape, email/URL format, and the small number of same-document
  invariants that don't need another collection (e.g. `followerId !=
  followingId`).

## Shared embedded subdocuments (`schemas/subdocuments/`)

15 reusable pieces, extracted so the same shape is never hand-typed twice:

| Subdocument | Shape | Used by |
|---|---|---|
| `mediaSchema` | `{url, publicId, type}` | socialPosts.media, stories.media, messages.image, marketplaceListings.media, profiles.avatar/coverPhoto, companies.logo/coverImage |
| `geoLocationSchema` | GeoJSON Point | locations.coordinates, locationSummarySchema |
| `addressFields()` | postal fields + optional coordinates — a **field-definition fragment** you spread, not a nested type | locations (flat), orders.shippingAddress (nested) |
| `moneySchema` | `{amount, currency}` | orders.listingSnapshot.price, quotes.quotedPrice — *not* the flat payments.amount/orders.unitPrice fields, which stay flat siblings exactly as designed |
| `roleReferenceSchema` | `{roleId, roleKey}` | users.role, companyMembers.role |
| `auditMetadataFields()` / `auditMetadataSchema` | `{ipAddress, userAgent}` | auditLogs, consents |
| `locationSummarySchema` | `{city, country, coordinates}` | companies.locationSummary, marketplaceListings.locationSummary |
| `metadataValidator` | structural guard for polymorphic `Mixed` fields | notifications.meta, auditLogs.targetMeta |
| `timelineEventSchema` | `{status, at, byId}` | orders.timeline[] |
| `attachmentSchema` | `{url, hash, mimeType, sizeBytes}` | verificationDocuments.file — distinct from Media (evidentiary file, not displayable content) |
| `reactionSchema` | `{userId, emoji}` | messages.reactions[] |
| `replyReferenceSchema` | `{messageId, textSnippet}` | messages.replyTo |
| `signatureSchema` | `{partyId, signedAt, ipAddress}` | contracts.signatures[] |
| `specificationSchema` | material/grade/finish/dimensions + open `extra` bag | marketplaceListings.specifications |
| `pricingSchema` | `{basePrice, currency, unit, minOrderQty, priceType}` | marketplaceListings.pricing |

## Plugin usage

| Plugin | Applied to | What it does |
|---|---|---|
| `timestampsPlugin` | all 37 | `createdAt`/`updatedAt`, matching Postgres's field names exactly |
| `jsonTransformPlugin` | all 37 | API-facing JSON shape: `_id`→`id`, strips `__v` |
| `softDeletePlugin` | socialPosts, comments, stories\*, highlights, conversationParticipants, marketplaceListings, messages, notifications | adds `isDeleted`/`deletedAt` + opt-in `.notDeleted()` query helper — **not** a default auto-filter; that's a repository-layer decision |
| `auditFieldsPlugin` | roles, permissions | `createdBy`/`updatedBy` — admin-managed reference data only |
| `paginationPlugin` | socialPosts, comments, marketplaceListings, orders, notifications, auditLogs, reports, payments | generic `Model.paginate(filter, options)` |
| `slugGenerationPlugin` | categories | auto-slug from `name` on save, if not already set |
| `searchNormalizationPlugin` | companies, categories | maintains `nameNormalized` alongside the display-cased `name` — *not* applied to hashtags, whose `name` is already lowercase at the field level |

\* `stories` doesn't use the soft-delete plugin — it TTL-expires instead (see indexes).

## Index strategy

Every index from the Phase 2 architecture doc's §6 is implemented, split
across `indexes/*.indexes.js` by domain group specifically so the whole
index surface can be read end-to-end for duplicates — which was checked
for this milestone: **no two indexes in the same file target an identical
field combination**, and no schema declares the same index both inline
(via `unique`/`sparse` on the field) and again in its `indexes/` file.
Covers: unique/sparse (on the field definition itself), compound, text,
2dsphere, and partial-filtered TTL (`quotes.expiresAt`, `consents
.guestExpiresAt`) — see the group files for exactly which index exists on
which collection and why.

## How to add a new model

1. Add any new enum values to `constants/index.js`.
2. If a field shape repeats across 2+ collections, check
   `schemas/subdocuments/` first — extract a new one there if it doesn't
   exist yet, rather than typing the same shape twice.
3. Add the schema to the appropriate `schemas/<group>.schemas.js` file (or
   create a new group file if it doesn't fit an existing one), applying at
   minimum `timestampsPlugin` and `jsonTransformPlugin`.
4. Add its index strategy to the matching `indexes/<group>.indexes.js`
   file — never inline `schema.index()` calls inside the schema file
   itself, so index strategy stays reviewable in one place per group.
5. Compile it in `models/index.js` via the `compile(name, schema)` helper.
6. It's now available through `shared/database/mongodb/index.js`'s
   `models` export — no other file needs to change.

## Docker / environment

This package has no relationship to Docker itself — it just needs
`MONGO_URI`/`MONGO_DB_NAME` in whichever process imports `connectMongo()`.
See `infrastructure/mongodb/README.md` for running the local MongoDB
Community Server this package connects to, and `backend/.env.example` for
the connection variables.
