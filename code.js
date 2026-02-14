const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const UPLOAD_FOLDER = "uploads";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const FILE_LIFETIME_HOURS = 24;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER);
}

// ============================
// Multer Setup
// ============================

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

// ============================
// Helper Functions
// ============================

function allowedFile(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function cleanupOldFiles() {
  const now = Date.now();
  fs.readdirSync(UPLOAD_FOLDER).forEach((file) => {
    const filePath = path.join(UPLOAD_FOLDER, file);
    const stats = fs.statSync(filePath);
    const ageHours = (now - stats.birthtimeMs) / (1000 * 60 * 60);
    if (ageHours > FILE_LIFETIME_HOURS) {
      fs.unlinkSync(filePath);
    }
  });
}

// ============================
// Routes
// ============================

app.post("/upload", upload.single("file"), (req, res) => {
  cleanupOldFiles();

  if (!req.file) {
    return res.status(400).json({ error: "No file selected" });
  }

  if (!allowedFile(req.file.originalname)) {
    return res.status(400).json({ error: "Invalid file type" });
  }

  // Generate SHA256 hash
  const hash = crypto
    .createHash("sha256")
    .update(req.file.buffer)
    .digest("hex");

  const extension = req.file.originalname.split(".").pop().toLowerCase();
  const filename = `${hash}.${extension}`;
  const filePath = path.join(UPLOAD_FOLDER, filename);

  if (fs.existsSync(filePath)) {
    return res.status(200).json({ message: "Duplicate file detected" });
  }

  fs.writeFileSync(filePath, req.file.buffer);

  res.status(201).json({ message: "File uploaded successfully" });
});

// Handle large file error
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large (Max 5MB)" });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
