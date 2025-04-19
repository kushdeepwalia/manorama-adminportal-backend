const express = require("express");
const { OAuth2Client } = require("google-auth-library")
const jwt = require("jsonwebtoken")
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const pool = require("../../db/pool");
const password = require("../../utils/password");
const eventBus = require("../../utils/eventBus");

const PORT = process.env.PORT || 5001;

const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/register", async (req, res, next) => {
  try {
    if (req.body?.name === undefined || req.body?.email === undefined || req.body?.pass === undefined || req.body?.tenant_id === undefined || req.body?.phone_no === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(401).send();
    }

    const { name, email, pass, tenant_id, phone_no } = req.body;

    const { rows } = await pool.query("SELECT count(*) FROM mst_admin WHERE email = $1 OR phone_no = $2", [email, phone_no]);

    console.log(rows);

    if (rows[0].count > 0) {
      res.statusMessage = "Account exists";
      return res.status(409).send();
    }

    const hashedpass = await password.hash(pass)
    console.log(hashedpass);

    const { rows: users, rowCount } = await pool.query("INSERT INTO mst_admin(name, email, password, tenant_id, phone_no) values ($1, $2, $3, $4, $5) RETURNING id, name, email, phone_no, status, google_sub_id, profile_pic, tenant_id, updated_at, created_at, last_logged_in", [name, email, hashedpass, tenant_id, phone_no]);

    const token = jwt.sign(
      { id: users[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: "30m" }
    );

    const magicLink = `http://localhost:2000/auth/login?token=${token}`;

    if (rowCount > 0) {
      res.statusMessage = "User registered.";
      eventBus.publish('AdminSendEmailToNewUser', {
        mailOptions: {
          from: 'kushdeepwalia.iit@gmail.com', // Sender address
          to: email, // List of recipients
          subject: 'Onboarding: ' + name, // Subject line
          // text: 'Hello, this is a test email!', // Plain text body
          html: `<span>Hi! Click below to log in and set your password. The link is valid for 30 minutes only. So: </span><a href="${magicLink}">Log In</a><span> now.</span>`
        }
      }).catch((error) => {
        console.log(error)
      })
      return res.status(200).json({ user: users[0] });
    }

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
})

router.all("/", (req, res, next) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

module.exports = router;