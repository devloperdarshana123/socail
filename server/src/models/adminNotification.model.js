import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const ADMIN_NOTIFICATION_TYPES = ["admin_new_user", "admin_new_report" , "admin_new_comment"];

const LABEL_MAP = {
  admin_new_user:   "New user registered",
  admin_new_report: "New report submitted",
  admin_new_comment: "New comment posted",
};

const adminNotificationSchema = new Schema(
  {
    type: {
      type:     String,
      required: [true, "Notification type is required"],
      enum:     ADMIN_NOTIFICATION_TYPES,
      index:    true,
    },
    label: {
      type:    String,
      trim:    true,
      default: "",
    },
    meta: {
      type:    Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type:    Boolean,
      default: false,
      index:   true,
    },
    readAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Fetch latest first
adminNotificationSchema.index({ createdAt: -1 });

// Unread badge count query
adminNotificationSchema.index({ isRead: 1, createdAt: -1 });

// Auto-delete after 30 days
adminNotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

// Pre-save — label auto-set karo
adminNotificationSchema.pre("validate", function () {
  if (this.isNew && !this.label) {
    this.label = LABEL_MAP[this.type] || this.type;
  }
});

const AdminNotification =
  models.AdminNotification ||
  model("AdminNotification", adminNotificationSchema);

export default AdminNotification;
export { LABEL_MAP, ADMIN_NOTIFICATION_TYPES };