import { Schema } from "mongoose";
import { DEFAULT_CURRENCY } from "../../constants/index.js";

// Reused wherever an amount is paired with a currency inside an already-
// embedded object: orders.listingSnapshot.price, marketplaceListings
// .pricing (internally), quotes.quotedPrice. Top-level flat amount/currency
// siblings designed in Phase 2 (payments.amount/currency,
// orders.unitPrice/currency/totalAmount) are left exactly as flat fields,
// unchanged — Money is for the nested cases, not a reshaping of those.
export const moneySchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY, uppercase: true, minlength: 3, maxlength: 3 },
  },
  { _id: false }
);
