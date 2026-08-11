export const applyMessagingIndexes = {
  conversation(schema) {
    // participantsKey is already unique+sparse via the field definition.
    schema.index({ participantIds: 1 }); // "my conversations"
  },

  conversationParticipant(schema) {
    schema.index({ conversationId: 1, userId: 1 }, { unique: true });
    schema.index({ userId: 1, isArchived: 1 }); // inbox list
  },

  message(schema) {
    schema.index({ conversationId: 1, createdAt: -1 }); // message-history pagination — highest-volume query
  },

  messageReceipt(schema) {
    schema.index({ messageId: 1, userId: 1 }, { unique: true });
    schema.index({ conversationId: 1, userId: 1 }); // bulk seen-status queries
  },

  notification(schema) {
    schema.index({ receiverId: 1, isRead: 1, createdAt: -1 }); // inbox read pattern
    schema.index({ audience: 1, isRead: 1, createdAt: -1 });
    schema.index({ ttlExpiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
  },
};
