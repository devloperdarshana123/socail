import crypto from "crypto";

const SECRET_KEY = process.env.ENCRYPTION_KEY || "your-32-character-secret-key-here!!";
const ALGORITHM = "aes-256-cbc";

export function encryptMessage(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SECRET_KEY, "salt", 32);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

// export function decryptMessage(encryptedText) {
//   const [ivHex, encrypted] = encryptedText.split(":");
//   const iv = Buffer.from(ivHex, "hex");
//   const key = crypto.scryptSync(SECRET_KEY, "salt", 32);

//   const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
//   let decrypted = decipher.update(encrypted, "hex", "utf8");
//   decrypted += decipher.final("utf8");

//   return decrypted;
// }


// encryption.js mein decryptMessage ko update karo
export function decryptMessage(encryptedText) {
  // ✅ Safety check — plain text hai toh seedha return karo
  if (!encryptedText.includes(":")) {
    return encryptedText;
  }

  try {
    const [ivHex, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(SECRET_KEY, "salt", 32);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    // Decrypt nahi hua toh plain text return karo
    return encryptedText;
  }
}