import { Schema } from "mongoose";
import {
  mediaSchema,
  specificationSchema,
  pricingSchema,
  locationSummarySchema,
  moneySchema,
  timelineEventSchema,
  signatureSchema,
  addressFields,
} from "./subdocuments/index.js";
import {
  timestampsPlugin,
  jsonTransformPlugin,
  softDeletePlugin,
  paginationPlugin,
  slugGenerationPlugin,
  searchNormalizationPlugin,
} from "../plugins/index.js";
import {
  MARKETPLACE_LISTING_STATUS,
  QUOTE_STATUS,
  ORDER_STATUS,
  CONTRACT_STATUS,
  PAYMENT_STATUS,
} from "../constants/index.js";
import { applyMarketplaceIndexes } from "../indexes/marketplace.indexes.js";

// ─────────────────────────────────────────────
//  categories — materialized path for the category tree (no recursive
//  join in MongoDB, so ancestor/descendant queries are a prefix match).
// ─────────────────────────────────────────────
export const categorySchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Category" },
    path: { type: String }, // e.g. "/stone/marble/carrara"
    icon: { type: String },
    isActive: { type: Boolean, default: true },
  }
);
categorySchema.plugin(timestampsPlugin);
categorySchema.plugin(jsonTransformPlugin);
categorySchema.plugin(slugGenerationPlugin, { sourceField: "name" });
categorySchema.plugin(searchNormalizationPlugin, { sourceField: "name" });
applyMarketplaceIndexes.category(categorySchema);

// ─────────────────────────────────────────────
//  marketplaceListings — zero precedent in the current schema. Mirrors
//  socialPosts' embed/reference pattern deliberately, for structural
//  consistency between the two content types.
// ─────────────────────────────────────────────
export const marketplaceListingSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    title: { type: String, required: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 5000 },
    media: [{ type: mediaSchema }],
    specifications: { type: specificationSchema },
    pricing: { type: pricingSchema, required: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    locationSummary: { type: locationSummarySchema },
    status: { type: String, enum: MARKETPLACE_LISTING_STATUS, default: "draft" },
    stats: {
      viewsCount: { type: Number, default: 0, min: 0 },
      inquiriesCount: { type: Number, default: 0, min: 0 },
    },
  }
);
marketplaceListingSchema.plugin(timestampsPlugin);
marketplaceListingSchema.plugin(jsonTransformPlugin);
marketplaceListingSchema.plugin(softDeletePlugin);
marketplaceListingSchema.plugin(paginationPlugin);
applyMarketplaceIndexes.marketplaceListing(marketplaceListingSchema);

// ─────────────────────────────────────────────
//  quotes — a distinct lifecycle from orders (can expire/be rejected
//  without ever becoming one). quotedPrice uses Money — the original
//  Phase 2 sketch had a bare Number with no currency field, an oversight
//  this corrects rather than a redesign.
// ─────────────────────────────────────────────
export const quoteSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "MarketplaceListing", required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    requestedQuantity: { type: Number, required: true, min: 0 },
    message: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: QUOTE_STATUS, default: "requested" },
    quotedPrice: { type: moneySchema },
    quotedAt: { type: Date },
    expiresAt: { type: Date },
    respondedBy: { type: Schema.Types.ObjectId, ref: "User" },
  }
);
quoteSchema.plugin(timestampsPlugin);
quoteSchema.plugin(jsonTransformPlugin);
applyMarketplaceIndexes.quote(quoteSchema);

// ─────────────────────────────────────────────
//  orders — listingSnapshot/shippingAddress are frozen copies, not live
//  references: an order must stay accurate to what was agreed even if the
//  listing or address changes later (see Phase 2, Group 6).
// ─────────────────────────────────────────────
export const orderSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "MarketplaceListing", required: true },
    listingSnapshot: {
      title: { type: String },
      price: { type: moneySchema },
    },
    quoteId: { type: Schema.Types.ObjectId, ref: "Quote" },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", uppercase: true, minlength: 3, maxlength: 3 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUS, default: "pending" },
    // Nested snapshot of a locations doc at order time — reuses the same
    // Address field-set as ../verificationLocations.schemas.js's
    // `locations` collection, just nested under one key instead of flat.
    shippingAddress: new Schema(addressFields(), { _id: false }),
    timeline: [{ type: timelineEventSchema }],
  }
);
orderSchema.virtual("payments", {
  ref: "Payment",
  localField: "_id",
  foreignField: "orderId",
});
orderSchema.plugin(timestampsPlugin);
orderSchema.plugin(jsonTransformPlugin);
orderSchema.plugin(paginationPlugin);
applyMarketplaceIndexes.order(orderSchema);

// ─────────────────────────────────────────────
//  contracts — same snapshot reasoning as orders: named parties must stay
//  accurate for the life of the agreement.
// ─────────────────────────────────────────────
export const contractSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order" }, // null for standalone/recurring B2B agreements
    parties: {
      buyer: {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        companyId: { type: Schema.Types.ObjectId, ref: "Company" },
        name: { type: String },
      },
      seller: {
        companyId: { type: Schema.Types.ObjectId, ref: "Company" },
        name: { type: String },
      },
    },
    terms: {
      paymentTerms: { type: String },
      deliveryTerms: { type: String },
      validityPeriod: { type: String },
    },
    documentUrl: { type: String },
    status: { type: String, enum: CONTRACT_STATUS, default: "draft" },
    signatures: [{ type: signatureSchema }],
  }
);
contractSchema.plugin(timestampsPlugin);
contractSchema.plugin(jsonTransformPlugin);
applyMarketplaceIndexes.contract(contractSchema);

// ─────────────────────────────────────────────
//  payments — never embedded in orders: an order can have more than one
//  payment (deposit + balance, payment + refund), and financial records
//  need an independent, append-only audit trail (see Phase 2, Group 6).
// ─────────────────────────────────────────────
export const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    payerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    payeeId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", uppercase: true, minlength: 3, maxlength: 3 },
    method: { type: String },
    provider: { type: String },
    providerTransactionId: { type: String, required: true, unique: true },
    status: { type: String, enum: PAYMENT_STATUS, default: "pending" },
    fees: {
      platformFee: { type: Number, default: 0, min: 0 },
      processorFee: { type: Number, default: 0, min: 0 },
    },
  }
);
paymentSchema.plugin(timestampsPlugin);
paymentSchema.plugin(jsonTransformPlugin);
paymentSchema.plugin(paginationPlugin);
applyMarketplaceIndexes.payment(paymentSchema);
