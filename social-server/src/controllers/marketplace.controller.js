import SocialUser from "../models/User.model.js";

// ── Nearby Sellers ────────────────────────────────────────────────────────────
export const getNearbySellers = async (req, res) => {
  try {
    const { lng, lat, maxDistance = 500000, category } = req.query;
    const currentUserId = req.user._id;

    const currentUser = await SocialUser.findById(currentUserId).select("following");

    let query = {
      _id: { $ne: currentUserId },
      isSuspended: false,
      "location.coordinates": { $ne: [0, 0] },
    };

    if (category && category !== "all") {
      query.businessCategory = category;
    }

    // Agar lat/lng diya toh nearby filter
    if (lat && lng) {
      query["location"] = {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(maxDistance),
        },
      };
    }

    const sellers = await SocialUser.find(query)
      .select("_id name avatar designation businessCategory location followers followRequests following")
      .limit(50);

    const followingIds = currentUser.following.map(String);

    const result = sellers.map((u) => ({
      _id: u._id,
      name: u.name,
      avatar: u.avatar,
      designation: u.designation,
      businessCategory: u.businessCategory,
      city: u.location?.city || "",
      country: u.location?.country || "",
      coordinates: u.location?.coordinates || [0, 0],
      followersCount: u.followers?.length || 0,
      isFollowing: followingIds.includes(String(u._id)),
      isPending: u.followRequests?.map(String).includes(String(currentUserId)),
    }));

    res.json({ success: true, sellers: result });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Update Location ───────────────────────────────────────────────────────────
export const updateLocation = async (req, res) => {
  try {
    const { lat, lng, city, country, businessCategory } = req.body;
    const currentUserId = req.user._id;

    const updateData = {};

    if (lat && lng) {
      updateData["location.type"] = "Point";
      updateData["location.coordinates"] = [parseFloat(lng), parseFloat(lat)];
    }
    if (city !== undefined) updateData["location.city"] = city;
    if (country !== undefined) updateData["location.country"] = country;
    if (businessCategory) updateData["businessCategory"] = businessCategory;

    await SocialUser.findByIdAndUpdate(currentUserId, { $set: updateData });

    res.json({ success: true, message: "Location updated!" });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};