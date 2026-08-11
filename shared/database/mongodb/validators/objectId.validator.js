import mongoose from "mongoose";

// Reusable validator for fields typed as Schema.Types.Mixed or String that
// must nonetheless hold a valid ObjectId (e.g. a polymorphic refId next to
// a refType discriminator, where the referenced collection isn't knowable
// at schema-definition time). Fields with a fixed, known `ref` should use
// `Schema.Types.ObjectId` directly instead — Mongoose validates that shape
// natively and this validator is unnecessary there.
export function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

export const objectIdValidator = {
  validator: isValidObjectId,
  message: (props) => `${props.path} must be a valid ObjectId`,
};
