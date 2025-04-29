const express = require("express");
const { OAuth2Client } = require("google-auth-library")
const jwt = require("jsonwebtoken")
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const pool = require("../../db/pool");
const password = require("../../utils/password");
const eventBus = require("../../utils/eventBus");

const PORT = process.env.PORT || 5005;

const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.get("/login", async (req, res, next) => {
  let calledMethod = '';
  if (req.query.token) {
    calledMethod = "magiclogin";
  }
  if (calledMethod === "magiclogin") {
    const { token } = req.query;

    const { id, email } = jwt.verify(token, process.env.JWT_SECRET)
    console.log(id, email)

    if (!id || !email) {
      return res.status(404).json({ message: "token expired." })
    }

    const query = await pool.query("SELECT id, google_sub_id, tenant_id FROM mst_admin WHERE email = $1", [email]);
    const authToken = jwt.sign(
      { id, email },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    res.redirect(`https://manorama-adminportal.vercel.app/?auth=${authToken}&tenant=${query.rows[0].tenant_id}`);
  }
})

router.post("/login", async (req, res, next) => {
  try {

    if (req.body.method === undefined) {
      res.statusMessage = "Method is required";
      return res.status(401).send();
    }

    const { method: calledMethod } = req.body;
    if (calledMethod === "google") {
      if (!req.body.token) {
        res.statusMessage = "Token is required";
        return res.status(401).send();
      }
      const { token } = req.body;

      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      if (!ticket) {
        res.statusMessage = "Error";
        return res.status(500).send();
      }

      const { sub, email } = ticket.getPayload();

      const query = await pool.query("SELECT id, google_sub_id FROM mst_admin WHERE email = $1", [email]);

      if (query.rowCount === 0) {
        res.statusMessage = "Email not registered";
        return res.status(404).send();
      }

      const google_sub_id = query.rows[0].google_sub_id;
      const id = query.rows[0].id;

      if (google_sub_id === sub) {

        const { rows: user } = await pool.query("UPDATE mst_admin SET last_logged_in = $1 WHERE id = $2 RETURNING id, name, email, phone_no, status, google_sub_id, profile_pic, tenant_id, created_at, updated_at, last_logged_in", [(new Date()).toISOString(), id]);

        // Generate JWT Token for session
        const jwtToken = jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: "2d" });

        res.statusMessage = "Login Successfull!!";
        return res.status(200).json({ user: user[0], token: jwtToken });
      }
      else {
        res.statusMessage = "Email is not linked with any google account.";
        return res.status(401).send();
      }
    }
    else if (calledMethod === "credentials") {
      const { email, pass } = req.body;

      const query = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

      if (query.rowCount !== 0) {
        const hashedpass = query.rows[0].password;
        const id = query.rows[0].id;

        // return res.send(query.rows)

        if (!(await password.compare(pass, hashedpass))) {
          res.statusMessage = "Credentials don't match";
          return res.status(404).send();
        }

        const { rows: user } = await pool.query("UPDATE mst_admin SET last_logged_in = $1 WHERE id = $2 RETURNING id, name, email, phone_no, status, google_sub_id, profile_pic, tenant_id, created_at, updated_at, last_logged_in", [(new Date()).toISOString(), id]);

        // Generate JWT Token for session
        const jwtToken = jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: "2d" });

        res.statusMessage = "Login Successfull!!";
        return res.status(200).json({ user: user[0], token: jwtToken });
      }
      else {
        res.statusMessage = "Email not registered";
        return res.status(404).send();
      }
    }
    else {
      throw new Error("Method not allowed");
    }

  } catch (error) {
    console.error(error);
    res.statusMessage = "Method not allowed";
    res.status(403).send();
  }
})

router.all("/", (req, res, next) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

module.exports = router;