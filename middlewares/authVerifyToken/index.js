const jwt = require("jsonwebtoken");

// Middleware to verify JWT
const authVerifyToken = (req, res, next) => {
  const token = req.headers["authorization"].split("Bearer ")[1];
  if (!token) {
    res.statusMessage = "Token is required";
    return res.status(403).json({ error: "Token is required" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.statusMessage = "Invalid or expired token";
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = authVerifyToken;