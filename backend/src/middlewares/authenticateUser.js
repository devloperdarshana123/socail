// middlewares/authenticateUser.js
import { USER_COOKIE_ACCESS } from "../utils/authCookies.js";

export const authenticateUser = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[USER_COOKIE_ACCESS];

  if (!token) return next(new AppError("Not authenticated", 401));

  const decoded = jwt.verify(token, process.env.USER_ACCESS_TOKEN_SECRET);
  
  // blacklist check...
  
  const user = await User.findById(decoded._id);
  if (!user) return next(new AppError("User not found", 401));

  req.user = user;
  next();
});