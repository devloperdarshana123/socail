// import express from "express";

// const router = express.Router();

// router.get("/reverse", async (req, res) => {
//   const { lat, lon } = req.query;
//   try {
//     const response = await fetch(
//       `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
//       { headers: { "User-Agent": "EroviansApp/1.0 (erovians.com)" } }
//     );
//     const data = await response.json();
    
//     // Better address extraction
//     const addr = data.address;
//     const parts = [
//       addr?.suburb || addr?.neighbourhood || addr?.village,
//       addr?.city || addr?.town || addr?.county,
//       addr?.state,
//     ].filter(Boolean);
    
//     const location = parts.length > 0 
//       ? parts.join(", ") 
//       : data.display_name?.split(",").slice(0, 3).join(", ");
    
//     res.json({ location });
//   } catch (err) {
//     res.status(500).json({ error: "Location nahi mili" });
//   }
// });
// export default router;


import express from "express";

const router = express.Router();

// GET /api/location/reverse?lat=..&lon=..
router.get("/reverse", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) return res.status(400).json({ error: "lat aur lon do" });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
      { headers: { "User-Agent": "EroviansApp/1.0 (erovians.com)" } }
    );

    if (!response.ok) throw new Error("Nominatim error");

    const data = await response.json();
    const addr = data.address;

    const parts = [
      addr?.suburb || addr?.neighbourhood || addr?.village,
      addr?.city   || addr?.town          || addr?.county,
      addr?.state,
    ].filter(Boolean);

    const location = parts.length > 0
      ? parts.join(", ")
      : data.display_name?.split(",").slice(0, 3).join(", ");

    return res.json({ location });
  } catch (err) {
    console.error("Reverse geocode error:", err);
    return res.status(500).json({ error: "Location nahi mili" });
  }
});

export default router;