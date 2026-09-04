import { BaseRepository } from "./BaseRepository.js";
import { RepositoryError } from "../errors/index.js";

// Shared stub for the domains Phase 1 confirmed have zero Postgres
// precedent (companies, roles, verification, locations, marketplace) — a
// literal "PrismaCompanyRepository" has nothing to wrap, since no Company
// table exists. Rather than silently omitting the Prisma class (breaking
// the "identical interface regardless of backend" requirement) or
// pretending data exists that doesn't, every method throws the same clear,
// consistent error. Extended by e.g. PrismaCompanyRepository — see
// ../companies/CompanyRepository.js for how it's used.
export class NotSupportedByPrismaRepository extends BaseRepository {
  constructor(entityName) {
    super();
    this._entityName = entityName;
    const unsupported = () => {
      throw new RepositoryError(
        `${entityName} has no Prisma-backed implementation — this domain is greenfield ` +
          `(zero Postgres precedent per the Phase 1 audit). Use the Mongo repository directly, ` +
          `or set DATABASE_PROVIDER=mongo.`
      );
    };
    for (const method of ["findById", "create", "update", "delete", "findMany", "exists", "count", "search"]) {
      this[method] = unsupported;
    }
  }
}
