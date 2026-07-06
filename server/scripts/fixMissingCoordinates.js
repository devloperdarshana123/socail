import prisma from "../src/config/prisma.js";

const run = async () => {
  const users = await prisma.user.findMany({
    where: { location: { not: null } },
    select: { id: true, location: true, fullName: true },
  });

  for (const user of users) {
    const loc = user.location;
    if (!loc || loc.coordinates?.coordinates) continue; // already has coords, skip

   const tryQueries = [
      [loc.city, loc.state, loc.country].filter(Boolean).join(", "),
      [loc.city, loc.country].filter(Boolean).join(", "),
      [loc.state, loc.country].filter(Boolean).join(", "),
      loc.country,
    ].filter(Boolean);

    let geoData = null;
    let usedQuery = null;

    try {
      for (const q of tryQueries) {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
          { headers: { "User-Agent": "Erovians/1.0" } }
        );
        const result = await geoRes.json();
        if (result?.[0]) {
          geoData = result;
          usedQuery = q;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000)); // rate-limit between retries
      }

      if (geoData?.[0]) {
        const updatedLocation = {
          ...loc,
          coordinates: {
            type: "Point",
            coordinates: [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)],
          },
        };

        await prisma.user.update({
          where: { id: user.id },
          data: { location: updatedLocation },
        });

      console.log(`✅ Fixed: ${user.fullName} (matched: ${usedQuery})`);
      } else {
        console.log(`⚠️ No match found: ${user.fullName} (tried: ${tryQueries.join(" | ")})`);
      }

      await new Promise((r) => setTimeout(r, 1000)); // Nominatim rate-limit: 1 req/sec
    } catch (err) {
      console.log(`❌ Failed for ${user.fullName}:`, err.message);
    }
  }

  console.log("Done!");
  process.exit(0);
};

run();