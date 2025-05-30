const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Store file in temp dir
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(__dirname);
    const dir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const upload = multer({ storage });

module.exports = upload;
