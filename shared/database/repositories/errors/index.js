// Erovians — normalized repository errors
//
// Every repository, Prisma-backed or Mongo-backed, throws ONE of these
// instead of a driver-specific error (PrismaClientKnownRequestError,
// MongoServerError, mongoose.Error.ValidationError, …). Callers — and,
// eventually, controllers in a later milestone — check `instanceof`
// against these classes and never need to know which database answered.

export class RepositoryError extends Error {
  constructor(message, { cause, code } = {}) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    if (cause) this.cause = cause;
  }
}

export class NotFoundError extends RepositoryError {
  constructor(message = "Record not found", opts) {
    super(message, opts);
    this.name = "NotFoundError";
  }
}

export class DuplicateKeyError extends RepositoryError {
  constructor(message = "A record with this value already exists", opts) {
    super(message, opts);
    this.name = "DuplicateKeyError";
  }
}

export class ValidationError extends RepositoryError {
  constructor(message = "Validation failed", opts) {
    super(message, opts);
    this.name = "ValidationError";
  }
}

export class ConflictError extends RepositoryError {
  constructor(message = "The record was modified by another operation", opts) {
    super(message, opts);
    this.name = "ConflictError";
  }
}

export class ForeignReferenceError extends RepositoryError {
  constructor(message = "Referenced record does not exist", opts) {
    super(message, opts);
    this.name = "ForeignReferenceError";
  }
}

export class TransactionError extends RepositoryError {
  // When the wrapped failure is itself a normalized RepositoryError (e.g. a
  // NotFoundError thrown by a repository call inside the transaction
  // callback), preserve its `.code`/`.name` alongside the transaction's own
  // message — callers that branch on a Prisma-style code (like
  // globalErrorHandler's P2025/P2002 checks) keep working after the error
  // crosses a transaction boundary, exactly as `.message` was already
  // preserved for existing message-based catch logic.
  constructor(message = "Transaction failed", opts = {}) {
    super(message, opts);
    this.name = opts.cause instanceof RepositoryError ? opts.cause.name : "TransactionError";
    if (this.code === undefined && opts.cause?.code !== undefined) {
      this.code = opts.cause.code;
    }
  }
}

// ─────────────────────────────────────────────
//  Normalizers — one per driver, called from inside each repository
//  method's catch block. Re-throws the normalized error; never mutates
//  or exposes the raw driver error to callers.
// ─────────────────────────────────────────────

/** @param {unknown} err — a Prisma error (duck-typed: has `.code` like "P2002") */
export function normalizePrismaError(err) {
  const code = err?.code;
  if (code === "P2002") {
    return new DuplicateKeyError(
      `Duplicate value for unique field(s): ${err.meta?.target ?? "unknown"}`,
      { cause: err, code }
    );
  }
  if (code === "P2025") {
    return new NotFoundError(err.meta?.cause ?? "Record not found", { cause: err, code });
  }
  if (code === "P2003") {
    return new ForeignReferenceError(
      `Foreign key constraint failed on field: ${err.meta?.field_name ?? "unknown"}`,
      { cause: err, code }
    );
  }
  if (code?.startsWith?.("P2")) {
    return new ValidationError(err.message, { cause: err, code });
  }
  return new RepositoryError(err?.message ?? "Unknown Prisma error", { cause: err, code });
}

/** @param {unknown} err — a Mongo/Mongoose error */
export function normalizeMongoError(err) {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {}).join(", ") || "unknown";
    return new DuplicateKeyError(`Duplicate value for unique field(s): ${field}`, {
      cause: err,
      code: 11000,
    });
  }
  if (err?.name === "ValidationError" || err?.name === "CastError") {
    return new ValidationError(err.message, { cause: err });
  }
  if (err?.name === "VersionError") {
    return new ConflictError(err.message, { cause: err });
  }
  return new RepositoryError(err?.message ?? "Unknown MongoDB error", { cause: err });
}
