import mongoose from "mongoose";

import { userSchema, profileSchema, sessionSchema, otpSchema } from "../schemas/identity.schemas.js";
import {
  companySchema,
  companyMemberSchema,
  roleSchema,
  permissionSchema,
} from "../schemas/companies.schemas.js";
import {
  verificationCaseSchema,
  verificationDocumentSchema,
  locationSchema,
} from "../schemas/verificationLocations.schemas.js";
import {
  socialPostSchema,
  commentSchema,
  likeSchema,
  followSchema,
  savedSchema,
  blockSchema,
  storySchema,
  storyViewSchema,
  postViewSchema,
  highlightSchema,
  hashtagSchema,
} from "../schemas/social.schemas.js";
import {
  conversationSchema,
  conversationParticipantSchema,
  messageSchema,
  messageReceiptSchema,
  notificationSchema,
} from "../schemas/messaging.schemas.js";
import {
  categorySchema,
  marketplaceListingSchema,
  quoteSchema,
  orderSchema,
  contractSchema,
  paymentSchema,
} from "../schemas/marketplace.schemas.js";
import {
  reportSchema,
  suspensionHistorySchema,
  auditLogSchema,
  consentSchema,
} from "../schemas/compliance.schemas.js";

// `mongoose.models.X ?? mongoose.model("X", schema)` guards against
// OverwriteModelError if this module is ever imported twice into the same
// process (e.g. by a test runner's module cache behaving unexpectedly) —
// compiling a model twice against the same connection throws otherwise.
function compile(name, schema) {
  return mongoose.models[name] ?? mongoose.model(name, schema);
}

// ── Identity & Access ──
export const User = compile("User", userSchema);
export const Profile = compile("Profile", profileSchema);
export const Session = compile("Session", sessionSchema);
export const Otp = compile("Otp", otpSchema);

// ── Companies & Organizational Roles ──
export const Company = compile("Company", companySchema);
export const CompanyMember = compile("CompanyMember", companyMemberSchema);
export const Role = compile("Role", roleSchema);
export const Permission = compile("Permission", permissionSchema);

// ── Verification & Locations ──
export const VerificationCase = compile("VerificationCase", verificationCaseSchema);
export const VerificationDocument = compile("VerificationDocument", verificationDocumentSchema);
export const Location = compile("Location", locationSchema);

// ── Social Graph & Content ──
export const SocialPost = compile("SocialPost", socialPostSchema);
export const Comment = compile("Comment", commentSchema);
export const Like = compile("Like", likeSchema);
export const Follow = compile("Follow", followSchema);
export const Saved = compile("Saved", savedSchema);
export const Block = compile("Block", blockSchema);
export const Story = compile("Story", storySchema);
export const StoryView = compile("StoryView", storyViewSchema);
export const PostView = compile("PostView", postViewSchema);
export const Highlight = compile("Highlight", highlightSchema);
export const Hashtag = compile("Hashtag", hashtagSchema);

// ── Messaging & Notifications ──
export const Conversation = compile("Conversation", conversationSchema);
export const ConversationParticipant = compile("ConversationParticipant", conversationParticipantSchema);
export const Message = compile("Message", messageSchema);
export const MessageReceipt = compile("MessageReceipt", messageReceiptSchema);
export const Notification = compile("Notification", notificationSchema);

// ── Marketplace ──
export const Category = compile("Category", categorySchema);
export const MarketplaceListing = compile("MarketplaceListing", marketplaceListingSchema);
export const Quote = compile("Quote", quoteSchema);
export const Order = compile("Order", orderSchema);
export const Contract = compile("Contract", contractSchema);
export const Payment = compile("Payment", paymentSchema);

// ── Trust, Moderation & Compliance ──
export const Report = compile("Report", reportSchema);
export const SuspensionHistory = compile("SuspensionHistory", suspensionHistorySchema);
export const AuditLog = compile("AuditLog", auditLogSchema);
export const Consent = compile("Consent", consentSchema);
