import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const consentSchema = new Schema(
  {
    // User model ke same pattern se — sparse index, null allowed
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
      sparse: true,
    },

    // Guest users ke liye — frontend se UUID generate karke bheja jayega
    sessionId: {
      type: String,
      required: [true, "SessionId is required"],
      index: true,
    },

    // Essential hamesha true — user change nahi kar sakta
    essential: {
      type: Boolean,
      default: true,
    },

    analytics: {
      type: Boolean,
      default: false,
    },

    marketing: {
      type: Boolean,
      default: false,
    },

    // Policy version track karo — jab "1.0" se "1.1" ho, dobara consent lena
    policyVersion: {
      type: String,
      required: true,
      default: "1.0",
    },

    // Legal proof ke liye (Erovians PDF §3.6)
    ipAddress: {
      type: String,
      default: null,
    },

    // User agent — browser/device info
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index — ek user ka ek hi record
consentSchema.index({ sessionId: 1, policyVersion: 1 });

const Consent = models.Consent || model("Consent", consentSchema);
export default Consent;