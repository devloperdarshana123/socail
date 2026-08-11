// The common interface every entity repository extends. Defines the
// generic CRUD/query surface (Milestone 3, Step 3) once; domain-specific
// interfaces (UserRepository, CompanyRepository, …) extend this and add
// their own specialized lookups (findByEmail, findByOwnerId, …) — so the
// shared methods are never redeclared per entity.
//
// Every method here throws by default — a concrete Prisma/Mongo subclass
// must override what it actually supports. This IS the "interface": in
// plain JS there's no `interface` keyword, so an abstract base class with
// throwing stubs is the enforcement mechanism (a method left unoverridden
// fails loudly at call time, not silently).
export class BaseRepository {
  /** @param {string} id */
  async findById(id, _options) {
    throw new Error(`${this.constructor.name}.findById() not implemented`);
  }

  /** @param {object} data */
  async create(data, _options) {
    throw new Error(`${this.constructor.name}.create() not implemented`);
  }

  /** @param {string} id @param {object} data */
  async update(id, data, _options) {
    throw new Error(`${this.constructor.name}.update() not implemented`);
  }

  /** @param {string} id */
  async delete(id, _options) {
    throw new Error(`${this.constructor.name}.delete() not implemented`);
  }

  /** @param {object} filter @param {object} queryOptions — pagination/sort/projection */
  async findMany(filter, queryOptions, _options) {
    throw new Error(`${this.constructor.name}.findMany() not implemented`);
  }

  /** @param {object} filter */
  async exists(filter, _options) {
    throw new Error(`${this.constructor.name}.exists() not implemented`);
  }

  /** @param {object} filter */
  async count(filter, _options) {
    throw new Error(`${this.constructor.name}.count() not implemented`);
  }

  /** @param {string} term @param {object} queryOptions */
  async search(term, queryOptions, _options) {
    throw new Error(`${this.constructor.name}.search() not implemented`);
  }
}
