
import mongoose from "mongoose";
import Message from "../src/models/message.model.js";
import { encryptMessage } from "../src/utils/encryption.js";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const messages = await Message.find({ 
  isDeleted: false, 
  text: { $ne: "" } 
});

console.log(`📦 ${messages.length} messages milے — encrypt ho rahe hain...`);

let success = 0, skipped = 0;

for (const msg of messages) {
  if (msg.text.includes(":")) {
    skipped++;
    continue;
  }

  // ✅ save() ki jagah updateOne use karo — validation bypass hoga
  await Message.updateOne(
    { _id: msg._id },
    { $set: { text: encryptMessage(msg.text) } }
  );
  success++;
}

console.log(`✅ Done! Encrypted: ${success}, Skipped: ${skipped}`);
await mongoose.disconnect();