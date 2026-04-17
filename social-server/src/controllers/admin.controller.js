

import SocialUser from '../models/User.model.js';
import Post from '../models/Post.model.js';

// ── Platform Stats ────────────────────────────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const totalUsers = await SocialUser.countDocuments({ role: 'user' });
    const newToday   = await SocialUser.countDocuments({
      role: 'user',
      createdAt: { $gte: new Date(Date.now() - 86400000) }
    });
    const totalPosts = await Post.countDocuments();
    res.json({ totalUsers, newToday, totalPosts });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── User Growth (Last 7 Months) ───────────────────────────────────────────────
export const getUserGrowth = async (req, res) => {
  try {
    const months = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const count = await SocialUser.countDocuments({
        role: 'user',
        createdAt: { $gte: date, $lt: nextDate }
      });

      months.push({
        month: date.toLocaleString('en-US', { month: 'short' }),
        users: count
      });
    }

    // Cumulative banana (running total)
    let running = 0;
    const cumulative = months.map(m => {
      running += m.users;
      return { month: m.month, users: running };
    });

    res.json(cumulative);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Post Activity (This Week - Last 7 Days) ───────────────────────────────────
export const getPostActivity = async (req, res) => {
  try {
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const count = await Post.countDocuments({
        createdAt: { $gte: start, $lte: end }
      });

      days.push({
        day: dayNames[start.getDay()],
        posts: count
      });
    }

    res.json(days);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── All Posts ─────────────────────────────────────────────────────────────────
export const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'name email avatar')
      .sort('-createdAt')
      .limit(100);

    // author field ko user naam se map karo (frontend expects post.user)
    const mapped = posts.map(p => ({
      ...p.toObject(),
      user: p.author,
      content: p.caption,
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Delete Post ───────────────────────────────────────────────────────────────
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── All Users ─────────────────────────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const users = await SocialUser.find({ role: 'user' })
      .select('name email avatar createdAt isSuspended warningCount')
      .sort('-createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Warn User ─────────────────────────────────────────────────────────────────
export const warnUser = async (req, res) => {
  try {
    const user = await SocialUser.findByIdAndUpdate(
      req.params.id,
      { $inc: { warningCount: 1 } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `Warning issued. Total warnings: ${user.warningCount}` });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Suspend User ──────────────────────────────────────────────────────────────
export const suspendUser = async (req, res) => {
  try {
    const user = await SocialUser.findByIdAndUpdate(
      req.params.id,
      { isSuspended: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User suspended successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ── Recent Activity ───────────────────────────────────────────────────────────
export const getRecentActivity = async (req, res) => {
  try {
    const recentPosts = await Post.find()
      .populate('author', 'name avatar')
      .sort('-createdAt')
      .limit(5);

    const recentUsers = await SocialUser.find({ role: 'user' })
      .sort('-createdAt')
      .limit(5)
      .select('name avatar createdAt');

    const postActivity = recentPosts.map(p => ({
      type: 'post',
      message: `${p.author?.name} created a new post`,
      avatar: p.author?.avatar,
      name: p.author?.name,
      time: p.createdAt,
    }));

    const userActivity = recentUsers.map(u => ({
      type: 'user',
      message: `${u.name} joined the platform`,
      avatar: u.avatar,
      name: u.name,
      time: u.createdAt,
    }));

    const combined = [...postActivity, ...userActivity]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 8);

    res.json(combined);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Top Users ─────────────────────────────────────────────────────────────────
export const getTopUsers = async (req, res) => {
  try {
    const topUsers = await Post.aggregate([
      { $group: { _id: '$author', postCount: { $sum: 1 }, totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } } } },
      { $sort: { postCount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'socialusers', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', avatar: '$user.avatar', postCount: 1, totalLikes: 1 } }
    ]);
    res.json(topUsers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Unsuspend User ────────────────────────────────────────────────────────────
export const unsuspendUser = async (req, res) => {
  try {
    const user = await SocialUser.findByIdAndUpdate(
      req.params.id,
      { isSuspended: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User unsuspended successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
};