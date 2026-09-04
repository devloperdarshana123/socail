# Erovians — Shared Repository Layer

Milestones 3–4 of the MongoDB migration. This is the persistence
abstraction between application code and the database — **not wired into
`server/` or `chat-server/` yet**. `DATABASE_PROVIDER=prisma` (the default)
means production keeps using Prisma/Postgres exactly as it does today; the
Mongo implementations are complete and tested but inactive until a later
milestone flips that switch.

**Coverage is now complete: every one of the 37 collections in the
approved Phase 2 architecture has a repository.**

## Folder layout

```
shared/database/repositories/
├── index.js               # top-level barrel
├── factory.js              # ★ RepositoryFactory — the only place DATABASE_PROVIDER is read
├── provider.js              # ★ RepositoryProvider — builds the whole repository tree at once
├── errors/index.js          # 7 normalized error classes + per-driver normalizers
├── queryHelpers/             # 9 reusable helpers (pagination, sorting, filtering, …)
├── transactions/             # PrismaTransaction, MongoTransaction, common factory
├── base/
│   ├── BaseRepository.js               # the common CRUD interface every entity extends
│   └── NotSupportedByPrismaRepository.js  # shared stub for greenfield entities
└── auth/ users/ profiles/ companies/ roles/ verification/ locations/
    social/ messaging/ marketplace/ notifications/ audit/ compliance/ moderation/
        <Entity>Repository.js   # abstract interface + Prisma<Entity>Repository + Mongo<Entity>Repository, one file
        index.js                 # barrel
```

Each entity's three classes live in one file (not three) — `UserRepository`
(abstract), `PrismaUserRepository`, `MongoUserRepository` — a deliberate
efficiency choice given 37 entities × dual backend; the class names and
interface shape are exactly what was asked for, just co-located.
`compliance/` and `moderation/` are two domain folders added in Milestone 4
(Consent; Report + SuspensionHistory) — the original 12-domain list had no
slot for these, so they got their own, matching the Phase 2 architecture
doc's "Trust, Moderation & Compliance" grouping (`auditLogs` stays in the
already-built `audit/` folder rather than moving, to avoid churn on
already-approved work).

## Repository count

**37 entity repositories** — full coverage. See the table below for every
collection.

## Repository coverage table

| Collection | Repository | Backend |
|---|---|---|
| users | UserRepository | dual |
| profiles | ProfileRepository | dual |
| sessions | SessionRepository | dual |
| otps | OtpRepository | dual |
| companies | CompanyRepository | Mongo-only |
| companyMembers | CompanyMemberRepository | Mongo-only |
| roles | RoleRepository | Mongo-only |
| permissions | PermissionRepository | Mongo-only |
| verificationCases | VerificationCaseRepository | Mongo-only |
| verificationDocuments | VerificationDocumentRepository | Mongo-only |
| locations | LocationRepository | Mongo-only |
| socialPosts | SocialPostRepository | dual |
| comments | CommentRepository | dual |
| likes | LikeRepository | dual |
| follows | FollowRepository | dual |
| saved | SavedRepository | dual |
| blocks | BlockRepository | dual |
| stories | StoryRepository | dual |
| storyViews | StoryViewRepository | dual |
| postViews | PostViewRepository | dual |
| highlights | HighlightRepository | dual |
| hashtags | HashtagRepository | dual |
| conversations | ConversationRepository | dual |
| messages | MessageRepository | dual |
| conversationParticipants | ConversationParticipantRepository | dual |
| messageReceipts | MessageReceiptRepository | dual |
| notifications | NotificationRepository | dual |
| marketplaceListings | MarketplaceListingRepository | Mongo-only |
| categories | CategoryRepository | Mongo-only |
| quotes | QuoteRepository | Mongo-only |
| orders | OrderRepository | Mongo-only |
| contracts | ContractRepository | Mongo-only |
| payments | PaymentRepository | Mongo-only |
| auditLogs | AuditLogRepository | dual |
| consents | ConsentRepository | dual |
| reports | ReportRepository | dual |
| suspensionHistory | SuspensionHistoryRepository | dual |

23 dual-backed, 14 Mongo-only (greenfield — Phase 1 confirmed zero
Postgres precedent for any of these 14).

## The Prisma/Mongo asymmetries, named honestly

Several things do **not** look symmetric between backends, on purpose —
each is a real shape difference the interface bridges rather than hides:

- **The 14 greenfield entities** (companies, companyMembers, roles,
  permissions, verificationCases, verificationDocuments, locations,
  marketplaceListings, categories, quotes, orders, contracts, payments)
  have no Prisma-backed class with real logic. Their `PrismaXRepository`
  extends `NotSupportedByPrismaRepository`, which throws a clear,
  consistent error on every method. The factory routes these to Mongo
  unconditionally, regardless of `DATABASE_PROVIDER`.
- **`profiles`** — Postgres has no separate Profile table (it's fields on
  User); `PrismaProfileRepository` operates on `prisma.user` projected to
  the profile fields. `findById(id)` means "by user id" on Prisma, "by the
  profile document's own `_id`" on Mongo — use `findByUserId()` when you
  specifically mean the user.
- **`users.search()`** — Mongo's User has no `fullName` (moved to Profile
  in Milestone 2); Mongo-side search only matches `username`.
- **`likes`** — Postgres's Like has three nullable FKs
  (postId/commentId/storyId); Mongo's has one `{targetType, targetId}`
  pair. `LikeRepository.findByTarget()`/`findByUserAndTarget()` hide that
  behind one interface — the Prisma side maps `targetType` to the right
  column internally.
- **`stories`** — Postgres's Story has isDeleted/deletedAt; Mongo's
  deliberately doesn't (Milestone 2 gave it a TTL index instead, since
  time-based expiry is the actual product behavior). `delete()` therefore
  soft-deletes on Prisma but hard-deletes on Mongo — leaning on the TTL
  sweep for a user-triggered delete would leave it visible for up to a
  minute.
- **`highlights`** — Postgres keeps its story list in the separate
  HighlightStory join table (a `stories` relation); Mongo embeds it
  directly as `storyRefs[]` (Milestone 2 absorbed the join table).
  `PrismaHighlightRepository.findById()` includes the relation so the
  caller gets an equivalent shape.
- **`reports`** — Postgres's discriminator field is named `targetModel`;
  Mongo's is `targetType` (renamed for naming consistency across the new
  schema per the Milestone 2 migration plan — same concept).

## Shared helpers (`queryHelpers/`)

Pagination, cursor pagination, sorting, filtering, projection, search,
soft-delete filtering, geo queries, aggregation — 9 total, each a pair of
`toPrisma*`/`toMongo*` functions (or Mongo-only, for geo, which Postgres
has no native support for). Every repository builds its queries through
these rather than hand-rolling `where`/filter objects inline — reused
across all 37, never duplicated.

One real constraint worth knowing if you extend `marketplace`:
`MarketplaceListingRepository.search()` cannot combine MongoDB's `$text`
and `$near` in one query — MongoDB doesn't allow it. When a geo filter is
present, it runs a `$geoNear` aggregation with a regex `$match` instead of
`$text`, rather than silently building a query that would throw at
runtime.

Another: `ReportRepository.findQueue()` filters by `priority` but doesn't
sort by it — `priority` is a string enum ("low"/"medium"/"high"), and
sorting it alphabetically doesn't produce severity order. Ranking priority
levels for display is a business-rule decision left to a later layer.

## Error classes (`errors/`)

`RepositoryError` (base), `NotFoundError`, `DuplicateKeyError`,
`ValidationError`, `ConflictError`, `ForeignReferenceError`,
`TransactionError` — every repository method's catch block normalizes the
raw driver error into one of these before re-throwing. No caller ever
needs an `instanceof` check against a driver-specific error type.

## Transactions (`transactions/`)

`PrismaTransaction.run(cb)` wraps `prisma.$transaction()`; `cb` receives
the `tx` client — pass it as `{ tx }` to any repository method's options.
`MongoTransaction.run(cb)` opens a real session (`mongoose.startSession()`
+ `session.withTransaction()`) — this is why Milestone 1 configured the
local MongoDB as a replica set. `cb` receives the `session` — pass it as
`{ session }`. `createTransaction({ provider, prismaClient })` picks the
right one via the same `DATABASE_PROVIDER` convention as the repository
factory.

## Factory & Provider

`factory.js` exports one `create<Entity>Repository({ provider,
prismaClient })` function per entity (37 total) — the only place
`DATABASE_PROVIDER` is read. `provider.js`'s `createRepositoryProvider
({ prismaClient })` builds the entire tree at once, organized by domain
(`repositories.social.posts`, `repositories.moderation.reports`, …) — this
is what application code in a later milestone will actually import.

## How to add a new repository (for any future collection)

1. Create `<domain>/<Entity>Repository.js`: an abstract class extending
   `BaseRepository` (or `NotSupportedByPrismaRepository` for the Prisma
   side, if it's a greenfield entity) with any specialized finder methods
   stubbed, then `Prisma<Entity>Repository`/`Mongo<Entity>Repository`
   implementing them — copy the shape of an existing file in the same
   domain folder.
2. Re-export from that domain's `index.js`.
3. Add a `create<Entity>Repository` to `factory.js` (via `dualBacked(...)`
   or `mongoOnly(...)`) and wire it into `provider.js`'s tree.
4. Nothing else needs to change — `shared/database/repositories/index.js`
   and the provider automatically pick it up.

## Verification performed

Every repository (all 37) compiles; every dual-backed pair (23 total)
exposes byte-identical method sets between Prisma and Mongo, checked
programmatically; every greenfield Prisma stub (14 total) exposes all 8
base methods; the factory returns the correct class for both
`provider: "prisma"` and `provider: "mongo"`, and every greenfield entity
returns Mongo regardless of the requested provider; the full
`RepositoryProvider` tree builds without error and has the expected entity
count per domain; error normalizers produce the correct class for known
Prisma/Mongo error shapes; `server/`'s real, unmodified Prisma client
wires into both the Milestone 3 and Milestone 4 repositories correctly
(import + instantiation only — no live query). **Not verified**: live CRUD
execution against a real database — this sandbox has neither a running
Postgres nor a running Docker daemon (see Milestone 1's README). No
controller, route, or middleware file was touched to make any of this
possible.
