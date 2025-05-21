const express = require("express");
const { OAuth2Client } = require("google-auth-library")
const jwt = require("jsonwebtoken")
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const pool = require("../../db/pool");
const password = require("../../utils/password");
const eventBus = require("../../utils/eventBus");
const { redisClient, storeCache, getCache } = require("../../utils/redisClient");
const fs = require("fs");
const csv = require("fast-csv");
const { format } = require("@fast-csv/format");
const upload = require("../../utils/upload");
const twilio = require("twilio");

const PORT = process.env.PORT || 5005;

const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.get("/download-sample", (req, res) => {
  res.setHeader("Content-Disposition", "attachment; filename=sample.csv");
  res.setHeader("Content-Type", "text/csv");

  const csvStream = format({ headers: true });
  csvStream.pipe(res);

  csvStream.write({
    name: "John Doe",
    dob: "2000-01-01",
    state: "Kerala",
    district: "Ernakulam",
    email: "abc@gmail.com",
    organization: "Indian Institute of Technology",
    phone_no: "9876543210"
  });

  csvStream.write({
    name: "Jane Smith",
    dob: "2002-05-15",
    state: "Tamil Nadu",
    district: "Chennai",
    email: "abc@gmail.com",
    organization: "Indian Institute of Technology",
    phone_no: "9123456789"
  });

  csvStream.end();
});

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
    if (req.body === undefined) {
      res.statusMessage = "Missing request body";
      return res.status(401).send();
    }
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
    if (req.body === undefined) {
      res.statusMessage = "Missing request body";
      return res.status(401).send();
    }
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
    if (req.body === undefined) {
      res.statusMessage = "Missing request body";
      return res.status(401).send();
    }
    if (req.body.phone === undefined) {
      res.statusMessage = "Phone Number is required";
      return res.status(401).send();
    }

    const { phone } = req.body;
    const client = new twilio(process.env.ACCOUNT_SID, process.env.TWILIO_ACCOUNT_TOKEN);

    const generatedOTP = await getCache(`otp:${phone}`);
    if (generatedOTP) {
      try {
        console.log("1")
        client.messages
          .create({
            body: 'Your OTP is ' + JSON.parse(JSON.parse(generatedOTP)),
            from: '+17752597203', // trial Twilio number
            to: phone,
          })
          .then(async (message) => {
            console.log("2")
            console.log('OTP sent successfully', message.sid)
            return res.json({ message: 'OTP resent: ' + message.sid, otp: JSON.parse(JSON.parse(generatedOTP)) });
          })
          .catch((error) => {
            console.log("3")
            console.error(error);
            return res.status(404).json({ message: error });
          });
      } catch (error) {
        console.log("4")
        console.error('Error sending OTP:', error.message);
        return res.status(404).json({ message: error });
      }
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    console.log(`OTP: ${otp}, Phone No: ${phone}`);

    try {
      console.log("5")
      client.messages
        .create({
          body: 'Your OTP is ' + otp,
          from: '+17752597203', // trial Twilio number
          to: phone,
        })
        .then(async (message) => {
          console.log("6")
          console.log('OTP sent successfully', message.sid)
          await storeCache(`otp:${phone}`, 5 * 60, JSON.stringify(otp));
          res.status(200).json({ message: 'OTP sent. : ' + message.sid, otp });
        })
        .catch((error) => {
          console.log("7")
          console.error(error);
          return res.status(404).json({ message: error });
        });
    } catch (error) {
      console.log("8")
      console.error('Error sending OTP:', error.message);
      return false;
    }

  } catch (error) {
    console.log("9", error)
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.post("/user/verify-otp", async (req, res, next) => {
  try {
    if (req.body === undefined) {
      res.statusMessage = "Missing request body";
      return res.status(401).send();
    }
    if (req.body.phone === undefined || req.body.otp === undefined) {
      res.statusMessage = "Phone Number OR OTP is required";
      return res.status(401).send();
    }

    const { phone, otp } = req.body;

    const generatedOTP = await getCache(`otp:${phone}`);
    if (generatedOTP) {
      if (Number(JSON.parse(JSON.parse(generatedOTP))) !== Number(otp)) {
        res.statusMessage = "Enter correct OTP";
        return res.status(404).json({ generatedOTP, otp });
      }
      const { rows: user, rowCount: userCount } = await pool.query("SELECT * FROM mst_user WHERE phone_no = $1", [phone]);

      if (userCount === 0) {
        res.statusMessage = "No User Registered.";
        return res.status(204).send();
      }

      const { status } = user[0];

      if (status === "approved") {
        const jwtToken = jwt.sign({ user: user[0] }, process.env.JWT_SECRET, { expiresIn: "2d" });

        res.statusMessage = `Status: ${status}`;
        return res.status(200).json({ token: jwtToken, user });
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

router.post("/user/verifytoken", async (req, res, next) => {
  try {
    console.log(req.body);
    if (req.body === undefined) {
      res.statusMessage = "Missing request body";
      return res.status(401).send();
    }
    if (req.body.verification_method === undefined || req.body.verification_token === undefined) {
      console.log(2)
      res.statusMessage = "Missing fields";
      return res.status(401).send();
    }

    console.log(3)
    const { verification_method: method, verification_token: token } = req.body;

    if (method === "phone") {
      console.log(4)
      const msg91Res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          "authkey": "452060A3rDwlTJ1V2682b0303P1",
          "access-token": token
        }),
      });

      if (!msg91Res.ok) {
        const errText = await msg91Res.text(); // Capture error response text
        console.error("MSG91 Error Response:", errText);
        return res.status(400).json({ error: "Failed to verify token with MSG91", details: errText });
      }

      const data = await msg91Res.json();
      res.statusMessage = "Verified Response";
      return res.status(200).json({ data });
    }
    if (method === "email") {
      console.log(40)
      const msg91Res = await fetch("https://on3arqeece.execute-api.ap-south-1.amazonaws.com/dev/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          "action": "verify-token",
          "verifyToken": token
        }),
      });

      if (!msg91Res.ok) {
        const errText = await msg91Res.text(); // Capture error response text
        console.error("MSG91 Error Response:", errText);
        return res.status(400).json({ error: "Failed to verify token with MSG91", details: errText });
      }

      const data = await msg91Res.json();
      res.statusMessage = "Verified Response";
      return res.status(200).json(data);
    }
    res.statusMessage = "Invalid Method";
    return res.status(400).send();
  } catch (error) {
    console.error("Error verifying token:", error, req.body); // 🔍 Log for debugging
    res.statusMessage = "Internal Server Error";
    res.status(500).json({ error: error.message || "Something went wrong" });
  }
})

router.post("/user/register", async (req, res, next) => {
  try {
    if (req.body === undefined) {
      res.statusMessage = "Missing request body";
      return res.status(401).send();
    }
    if (req.body.name === undefined || req.body.email === undefined || req.body.dob === undefined || req.body.state === undefined || req.body.district === undefined || req.body.tenant_id === undefined || req.body.phone === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(401).send();
    }

    const { name, dob, state, district, tenant_id, phone, email } = req.body;

    const { rowCount: userCount } = await pool.query("SELECT * FROM mst_user WHERE phone_no = $1 OR email = $2", [phone, email]);

    if (userCount !== 0) {
      res.statusMessage = "User already exists";
      return res.status(409).send();
    }

    const { rowCount: newUserCount } = await pool.query("INSERT INTO mst_user(name, dob, state, district, tenant_id, phone_no, email) values ($1, $2, $3, $4, $5, $6, $7) RETURNING *", [name, dob, state, district, tenant_id, phone, email]);

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
          INNER JOIN descendants d ON t.parent_tenant_id = d.tenant_id
        )
        SELECT tenant_id FROM descendants
      `, [tenant_id]);

      const tenantIds = tenantRows.map(row => row.tenant_id);

      // Fetch users for all descendant tenants
      const result = await pool.query(`SELECT u.*, o.name as org_name FROM mst_user u LEFT JOIN mst_organization o ON o.tenant_id = u.tenant_id WHERE u.tenant_id = ANY($1) ORDER BY u.created_at DESC`, [tenantIds]);

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

function validateFile(req, res, next) {
  const file = req.file;
  console.log(file);
  const allowedTypes = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]; // Accept CSV file types
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({ error: "Invalid file type. Only CSV files are allowed." });
  }

  if (file.size > maxSize) {
    return res.status(400).json({ error: "File size exceeds the 5MB limit." });
  }

  next();
}

// Helper to chunk arrays
function chunkArray(arr, size) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

router.post("/user/bulk-import", authVerifyToken, upload.single("file"), validateFile, async (req, res, next) => {
  try {
    console.log("New Bulk Request");
    const filePath = req.file.path;
    const CHUNK_SIZE = 10;
    const records = [];

    console.log("1");
    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: true, ignoreEmpty: true }))
      .on("error", (err) => {
        fs.unlinkSync(filePath);
        console.log("2");
        return res.status(400).json({ error: "Invalid CSV format", details: err.message });
      })
      .on("data", (row) => records.push(row))
      .on("end", async () => {
        console.log("3");
        const chunks = chunkArray(records, CHUNK_SIZE);
        const failed = [];

        const response = await eventBus.publish('GetAllOrganizations', {}, Date.now().toString());

        const client = await pool.connect();

        try {
          console.log("4");
          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];

            for (let recordIndex = 0; recordIndex < chunk.length; recordIndex++) {
              const user = chunk[recordIndex];
              try {
                await client.query(
                  "INSERT INTO mst_user (name, dob, state, district, tenant_id, phone_no, status, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
                  [user.name, user.dob, user.state, user.district, response[user.organization], user.phone_no, "pending", user.email]
                );
              } catch (err) {
                failed.push({
                  chunk: chunkIndex,
                  recordIndex,
                  data: user,
                  errorDetail: err.detail,
                  errorMessage: err.message,
                });
              }
            }
          }

          console.log("5");
          res.status(200).json({
            successCount: records.length - failed.length,
            failedCount: failed.length,
            failed,
          });
        }
        catch (err) {
          console.log("6");
          res.status(500).json({ error: "Import failed", details: err.message });
        }
        finally {
          console.log("7");
          client.release();
          // Clean up file
          fs.unlink(filePath, (err) => {
            if (err) console.error("File cleanup error:", err);
          });
        }
      })
  }
  catch (error) {
    console.log("8");
    res.statusMessage = "Internal Server Error";
    res.status(500).json({ error });
  }
});

router.all("/", (req, res, next) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

module.exports = router;