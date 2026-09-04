import { geoLocationSchema } from "./geoLocation.schema.js";

// A plain field-definition FRAGMENT (not a nested Schema instance) meant to
// be spread into a parent schema's field map — used by `locations` (as
// flat top-level fields, matching the Phase 2 design exactly) and by
// `orders.shippingAddress` (nested under one key, also per Phase 2).
// Exported as a function so every consumer gets its own field-definition
// objects (Mongoose paths must not be shared by reference across schemas).
export function addressFields() {
  return {
    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    country: { type: String, required: true },
    countryCode: { type: String, uppercase: true, minlength: 2, maxlength: 2 },
    postalCode: { type: String },
    formattedAddress: { type: String },
    coordinates: { type: geoLocationSchema },
  };
}
