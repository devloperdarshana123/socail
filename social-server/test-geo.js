import mongoose from 'mongoose';
import SocialUser from './src/models/User.model.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erovians');
  console.log("Connected");
  try {
    const lat = 28;
    const lng = 77;
    const query = {
      isDeleted: false,
      isSuspended: false,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: 500000,
        },
      },
    };
    const sellers = await SocialUser.find(query).limit(1);
    console.log("Success! Found:", sellers.length);
  } catch (err) {
    console.error("Geo Query Error:", err);
  }
  process.exit();
}
test();
