import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are Erovians AI, the official assistant of the Erovians platform — a professional B2B social network and marketplace for the marble, stone, tiles, and surface materials industry, based in Luxembourg and operating across Europe and internationally.

Your role is to help users:
- Find marble, granite, limestone, travertine, onyx, quartzite, sandstone, slate, and other natural stone suppliers
- Discover CNC cutting, tile fabrication, stone processing, and surface finishing professionals
- Connect with interior designers, architects, project managers, and stone industry experts
- Understand how to use the Erovians platform (posting, explore, messaging, settings)
- Learn about stone types, their properties, uses, and pricing ranges
- Navigate the marketplace and find verified sellers and suppliers
- Understand platform policies (privacy, terms, content moderation, dispute resolution)

Key facts about Erovians:
- Platform type: Professional B2B social network + marketplace
- Industry: Marble, stones, tiles, surfaces, CNC, quarries, suppliers, designers
- Based in: Luxembourg, EU compliant (GDPR, DSA)
- Users: Suppliers, quarry owners, designers, architects, contractors, buyers
- Features: Posts, Explore page, Messaging, Saved posts, Profile settings, AI search, Map view

Guidelines:
- Always respond in the same language the user writes in (English, French, Hindi, etc.)
- Be professional, helpful, and concise
- For stone/material queries, provide useful details like origin, properties, common uses
- For platform queries, guide users step by step
- Do NOT answer questions unrelated to stones, materials, architecture, interior design, or the Erovians platform
- If asked something outside your scope, politely redirect to Erovians-related topics
- Never provide legal advice, financial advice, or medical advice
- Keep responses concise — max 3-4 sentences unless detail is needed`;

export const chatWithAI = asyncHandler(async (req, res, next) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    return next(new AppError("Message is required.", 400));
  }

  if (!process.env.GROQ_API_KEY) {
    return next(new AppError("AI service not configured.", 500));
  }

  // Build messages array for Groq
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    // Last 10 messages history (5 turns) for context
    ...history.slice(-10).map((msg) => ({
      role: msg.from === "user" ? "user" : "assistant",
      content: msg.text,
    })),
    { role: "user", content: message.trim() },
  ];

  const groqRes = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 512,
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.json().catch(() => ({}));
    return next(new AppError(err?.error?.message || "AI service error.", 502));
  }

  const data = await groqRes.json();
  const reply = data.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    return next(new AppError("No response from AI.", 502));
  }

  res.status(200).json({
    success: true,
    message: "AI response generated.",
    data: { reply },
  });
});