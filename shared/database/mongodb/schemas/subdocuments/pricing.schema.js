import { Schema } from "mongoose";
import { DEFAULT_CURRENCY, PRICE_TYPE } from "../../constants/index.js";

// marketplaceListings.pricing — composes the same amount+currency pair as
// Money, plus marketplace-specific fields (unit, minOrderQty, priceType).
// Kept as its own subdocument rather than nesting a literal `money` object
// inside it, since Phase 2's design shows `basePrice`/`currency` as direct
// siblings of `unit`/`minOrderQty`/`priceType` on one `pricing` object.
export const pricingSchema = new Schema(
  {
    basePrice: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      default: DEFAULT_CURRENCY,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    unit: { type: String, required: true }, // e.g. "per sq ft", "per slab", "per tonne"
    minOrderQty: { type: Number, min: 0, default: 1 },
    priceType: { type: String, enum: PRICE_TYPE, default: "fixed" },
  },
  { _id: false }
);
