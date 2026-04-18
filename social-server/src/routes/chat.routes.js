import express from "express";
import Groq from "groq-sdk";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post("/", protect, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are EroBot — the AI assistant for Erovians, a B2B social media platform for marble, stone, and tiles suppliers and buyers.
Help users with: finding products, connecting with suppliers, using the Erovians platform, and providing information about marble, stone, and tiles.
Be friendly, professional, and helpful. Always reply in English only, regardless of the language the user writes in.`,
        },
        ...history,
        { role: "user", content: message },
      ],
      max_tokens: 500,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error("Groq error:", err);
    res.status(500).json({ message: "Chatbot error!" });
  }
});

export default router;