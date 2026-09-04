import multer from "multer";

const storage = multer.memoryStorage(); // file buffer mein rakhega, disk pe nahi

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png", 
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/quicktime", // .mov
    "video/webm",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max (video ke liye)
    files: 10, // max 10 files (carousel)
  },
});

export default upload;