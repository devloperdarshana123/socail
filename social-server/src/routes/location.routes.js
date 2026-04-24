import express from "express";

const router = express.Router();

router.get("/reverse", async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
      { headers: { "User-Agent": "EroviansApp/1.0 (erovians.com)" } }
    );
    const data = await response.json();
    
    // Better address extraction
    const addr = data.address;
    const parts = [
      addr?.suburb || addr?.neighbourhood || addr?.village,
      addr?.city || addr?.town || addr?.county,
      addr?.state,
    ].filter(Boolean);
    
    const location = parts.length > 0 
      ? parts.join(", ") 
      : data.display_name?.split(",").slice(0, 3).join(", ");
    
    res.json({ location });
  } catch (err) {
    res.status(500).json({ error: "Location nahi mili" });
  }
});
export default router;