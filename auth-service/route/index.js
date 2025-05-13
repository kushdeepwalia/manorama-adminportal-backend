const express = require("express");
const { OAuth2Client } = require("google-auth-library")
const jwt = require("jsonwebtoken")
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const pool = require("../../db/pool");
const password = require("../../utils/password");
const eventBus = require("../../utils/eventBus");
const { redisClient, storeCache, getCache } = require("../../utils/redisClient");

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

router.put("/modifypass", authVerifyToken, async (req, res, next) => {
  try {
    if (req.body.pass === undefined) {
      res.statusMessage = "Password is required";
      return res.status(401).send();
    }
    const { pass } = req.body;
    const { email } = req.user;

    const { rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());
    if (userCount > 0) {
      const hashedpass = await password.hash(pass);

      const { rows: updatedUser, rowCount: updatedUserCount } = await pool.query("UPDATE mst_admin SET password = $1, last_logged_in = $2 WHERE email = $3 RETURNING id, name, email, phone_no, status, google_sub_id, profile_pic, tenant_id, updated_at, created_at, last_logged_in", [hashedpass, (new Date()).toISOString(), email])

      if (updatedUserCount > 0) {
        // Generate JWT Token for session
        const jwtToken = jwt.sign({ id: updatedUser[0].id, email }, process.env.JWT_SECRET, { expiresIn: "2d" });

        res.statusMessage = "Login Successfull!!";
        return res.status(200).json({ user: updatedUser[0], token: jwtToken });
      }

      res.statusMessage = "Error in updating password";
      return res.status(400).send();
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(404).send();

  } catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.post("/user/send-otp", async (req, res, next) => {
  try {
    if (req.body.phone === undefined) {
      res.statusMessage = "Phone Number is required";
      return res.status(401).send();
    }

    const { phone } = req.body;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    console.log(`OTP: ${otp}, Phone No: ${phone}`);

    await storeCache(`otp:${phone}`, 1800, JSON.stringify(otp));

    res.json({ message: 'OTP sent.', otp });

  } catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.post("/user/verify-otp", async (req, res, next) => {
  try {
    if (req.body.phone === undefined || req.body.otp === undefined) {
      res.statusMessage = "Phone Number OR OTP is required";
      return res.status(401).send();
    }

    const { phone, otp } = req.body;

    const generatedOTP = JSON.parse(await getCache(`otp:${phone}`));
    if (generatedOTP) {
      if (Number(generatedOTP) !== Number(otp)) {
        res.statusMessage = "Enter correct OTP";
        return res.status(404).send();
      }
      const { rows: user, rowCount: userCount } = await pool.query("SELECT * FROM mst_user WHERE phone_no = $1", [phone]);

      if (userCount === 0) {
        res.statusMessage = "No User Registered.";
        return res.status(204).send();
      }

      const { status } = user[0];

      if (status === "approved") {
        const jwtToken = jwt.sign({ user: user[0] }, process.env.JWT_SECRET, { expiresIn: "2d" });

        res.statusMessage = "Login Successful";
        return res.status(200).json({ token: jwtToken, status, user });
      }
      else {
        res.statusMessage = `Status: ${status}`;
        return res.status(200).send();
      }
    }

    res.statusMessage = "Invalid OTP/Phone No";
    res.status(404).send();

  } catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.post("/user/register", async (req, res, next) => {
  try {
    if (req.body.name === undefined || req.body.dob === undefined || req.body.state === undefined || req.body.district === undefined || req.body.tenant_id === undefined || req.body.phone_no === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(401).send();
    }

    const { name, dob, state, district, tenant_id, phone_no } = req.body;

    const { rowCount: userCount } = await pool.query("SELECT * FROM mst_user WHERE phone_no = $1", [phone_no]);

    if (userCount !== 0) {
      res.statusMessage = "User already exists";
      return res.status(409).send();
    }

    const { rowCount: newUserCount } = await pool.query("INSERT INTO mst_user(name, dob, state, district, tenant_id, phone_no) values ($1, $2, $3, $4, $5, $6) RETURNING *", [name, dob, state, district, tenant_id, phone_no]);

    if (newUserCount === 0) {
      res.statusMessage = "Error in adding user";
      return res.status(409).send();
    }

    res.statusMessage = "Submitted for approval.";
    res.status(201).send();

  } catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.get("/user/approvals/", authVerifyToken, async (req, res, next) => {
  try {
    const { email } = req.user;
    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const tenant_id = Number(user[0].tenant_id);

      // Get all descendant tenant_ids (including self)
      const { rows: tenantRows } = await pool.query(`
        WITH RECURSIVE descendants AS (
          SELECT tenant_id FROM mst_organization WHERE tenant_id = $1
          UNION ALL
          SELECT t.tenant_id FROM mst_organization t
          INNER JOIN descendants d ON t.parent_id = d.tenant_id
        )
        SELECT tenant_id FROM descendants
      `, [tenant_id]);

      const tenantIds = tenantRows.map(row => row.tenant_id);

      // Fetch users for all descendant tenants
      const result = await pool.query(`SELECT * FROM mst_user WHERE tenant_id = ANY($1)`, [tenantIds]);

      res.json(result.rows);
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(404).send();

  } catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

// PATCH /user/status/:status/:id
router.patch('/user/status/:status/:id', authVerifyToken, async (req, res) => {
  try {
    if (req.params.id === undefined || req.params.status === undefined) {
      res.statusMessage = "Invalid id or status";
      return res.status(400).send();
    }

    const { id, status } = req.params;

    const query = await pool.query("UPDATE mst_user SET status = $2 WHERE id = $1", [id, status]);

    if (query.rowCount === 0) {
      res.statusMessage = "Error in updating.";
      return res.status(404).send();
    }

    res.statusMessage = "User " + status;
    res.status(200).send();
  } catch (error) {
    res.statusMessage = "Internal Server Error";
    res.status(500).json({ error });
  }

});

router.get('/user/state-district-map', async (req, res) => {
  const result = await pool.query(`
    SELECT state, district
    FROM mst_organization
    WHERE state IS NOT NULL AND district IS NOT NULL
  `);

  const map = {};
  result.rows.forEach(({ state, district }) => {
    if (!map[state]) map[state] = new Set();
    map[state].add(district);
  });

  // Convert Set to Array
  const output = {};
  Object.keys(map).forEach(state => {
    output[state] = Array.from(map[state]).sort();
  });

  res.json(output);
});

router.get('/user/organization-map', async (req, res) => {
  const { state, district } = req.query;

  if (!state || !district) {
    return res.status(400).json({ message: 'State and district are required.' });
  }

  const result = await pool.query(`
    SELECT DISTINCT name, tenant_id
    FROM mst_organization
    WHERE state = $1 AND district = $2
    ORDER BY name
  `, [state, district]);

  res.json(result.rows); // returns: [{ id: 1, name: 'ABC Org' }, ...]
});

// DELETE /user/delete/:id
router.delete('/user/delete/:id', authVerifyToken, async (req, res) => {
  try {
    if (req.params.id === undefined) {
      res.statusMessage = "Invalid id";
      return res.status(400).send();
    }

    const { id } = req.params;

    const query = await pool.query("DELETE FROM mst_user WHERE id = $1", [id]);

    if (query.rowCount === 0) {
      res.statusMessage = "Error in updating.";
      return res.status(404).send();
    }

    res.statusMessage = "Deleted Successfully";
    res.status(200).json({ message: 'User deleted.' });
  } catch (error) {
    res.statusMessage = "Internal Server Error";
    res.status(500).json({ error });
  }
});

router.all("/", (req, res, next) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

module.exports = router;