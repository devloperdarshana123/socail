import { Schema } from "mongoose";

// Pairs a real reference to `roles` with a denormalized cache of its `key`,
// so authorization checks don't need a populate() on every request. Reused
// by users (platform-scope role) and companyMembers (company-scope role).
export const roleReferenceSchema = new Schema(
  {
    roleId: { type: Schema.Types.ObjectId, ref: "Role" },
    roleKey: { type: String }, // denormalized cache of roles.key
  },
  { _id: false }
);
