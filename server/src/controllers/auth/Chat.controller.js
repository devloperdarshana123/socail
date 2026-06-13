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
- Keep responses concise — max 3-4 sentences unless detail is needed

Platform usage guides:
- How to message someone: If you and the other user follow each other, they will automatically appear in your Messages page and you can start a conversation directly. If you don't follow each other, click on "Explore" in the top navigation bar, browse users listed there, click on a user to view their profile, and from there you can either follow them or send them a message.
- How to follow someone: Click on "Feed" in the top navigation bar, browse users listed there, click on a user to view their profile, and click the Follow button.
- How to find suppliers: Use the Explore page or AI search to filter by material type, location, or specialty.`;

export const chatWithAI = asyncHandler(async (req, res, next) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
  return next(new AppError("Message is required.", 400));
}

if (message.trim().length > 1000) {
  return next(new AppError("Message cannot exceed 1000 characters.", 400));
}

if (!Array.isArray(history)) {
  return next(new AppError("History must be an array.", 400));
}

if (history.length > 50) {
  return next(new AppError("History too long.", 400));
}

  if (!process.env.GROQ_API_KEY) {
    return next(new AppError("AI service not configured.", 500));
  }

  // Build messages array for Groq
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
   
    ...history.slice(-10)
  .filter((msg) => msg?.text?.trim())
  .map((msg) => ({
    role: msg.from === "user" ? "user" : "assistant",
    content: String(msg.text).slice(0, 1000),
  })),
    { role: "user", content: message.trim() },
  ];

  // const groqRes = await fetch(GROQ_API_URL, {
  const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

const groqRes = await fetch(GROQ_API_URL, {
  signal: controller.signal,
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
    clearTimeout(timeout);
    const err = await groqRes.json().catch(() => ({}));
    return next(new AppError(err?.error?.message || "AI service error.", 502));
  }

  const data = await groqRes.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
   clearTimeout(timeout);

  if (!reply) {
    return next(new AppError("No response from AI.", 502));
  }

  res.status(200).json({
    success: true,
    message: "AI response generated.",
    data: { reply },
  });
});