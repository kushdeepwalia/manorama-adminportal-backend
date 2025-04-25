const express = require("express");
const jwt = require("jsonwebtoken")
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const pool = require("../../db/pool");
const password = require("../../utils/password");
const eventBus = require("../../utils/eventBus");

const PORT = process.env.PORT || 5001;

const router = express.Router();

router.post("/register", authVerifyToken, async (req, res, next) => {
  try {
    if (req.body?.name === undefined || req.body?.email === undefined || req.body?.pass === undefined || req.body?.tenant_id === undefined || req.body?.phone_no === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(400).send();
    }

    const { email } = req.user;
    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const tenant_id = Number(user[0].tenant_id);
      if (tenant_id !== 1) {
        res.statusMessage = "Forbidden."
        return res.status(403).send();
      }

      const { name, email: newEmailToRegister, pass, tenant_id: newOrganizationId, phone_no } = req.body;

      const { rows } = await pool.query("SELECT count(*) FROM mst_admin WHERE email = $1 OR phone_no = $2", [newEmailToRegister, phone_no]);

      console.log(rows);

      if (rows[0].count > 0) {
        res.statusMessage = "Email or phone no is already registered.";
        return res.status(409).send();
      }

      const hashedpass = await password.hash(pass)
      console.log(hashedpass);

      const { rows: users, rowCount } = await pool.query("INSERT INTO mst_admin(name, email, password, tenant_id, phone_no) values ($1, $2, $3, $4, $5) RETURNING id, name, email, phone_no, status, google_sub_id, profile_pic, tenant_id, updated_at, created_at, last_logged_in", [name, newEmailToRegister, hashedpass, newOrganizationId, phone_no]);

      const token = jwt.sign(
        { id: users[0].id, email: newEmailToRegister },
        process.env.JWT_SECRET,
        { expiresIn: "30m" }
      );

      const magicLink = `https://manorama.adminportal.anganwaditest.co.in/auth/login?token=${token}`;

      if (rowCount > 0) {
        res.statusMessage = "User registered.";
        eventBus.publish('AdminSendEmailToNewUser', {
          mailOptions: {
            from: 'kushdeepwalia.iit@gmail.com', // Sender address
            to: newEmailToRegister, // List of recipients
            subject: 'Onboarding: ' + name, // Subject line
            // text: 'Hello, this is a test email!', // Plain text body
            html: `<span>Hi! Click below to log in and set your password. The link is valid for 30 minutes only. So: </span><a href="${magicLink}">Log In</a><span> now.</span>`
          }
        }).catch((error) => {
          console.log(error)
          res.statusMessage = "Error in sending email.";
          return res.status(500).json({ error });
        })
        res.statusMessage = "Data Fetched";
        return res.status(201).json({ user: users[0] });
      }
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(404).send();

  } catch (error) {
    res.statusMessage = "Internal Server Error";
    res.status(500).json({ error });
  }
})

router.get("/getAll", authVerifyToken, async (req, res, next) => {
  try {
    const { email } = req.user;

    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const tenant_id = Number(user[0].tenant_id);

      const tenantids = await eventBus.publish('OrgGetTenantIds', { tenant_id }, Date.now().toString());

      const { rows: admins, rowCount: adminCount } = await pool.query("SELECT a.id AS admin_id, a.name AS name, a.email AS email, a.phone_no AS phone_no, a.status AS profile_status, a.google_sub_id AS google_sub_id, a.profile_pic AS profile_pic, a.last_logged_in AS last_logged_in, a.tenant_id AS org_tenant_id, o.name AS org_name, a.created_at AS created_at, a.updated_at AS updated_at FROM mst_admin a JOIN mst_organization o ON a.tenant_id = o.tenant_id WHERE a.tenant_id = ANY($1) ORDER BY a.updated_at DESC", [tenantids]);

      if (adminCount > 0) {
        res.statusMessage = "Fetched Records";
        return res.status(200).json({ admins });
      }

      res.statusMessage = "No Data";
      return res.status(204).send();
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(404).send();
  }
  catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.all("/", (req, res, next) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

module.exports = router;