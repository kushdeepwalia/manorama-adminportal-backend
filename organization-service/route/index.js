const express = require("express");
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const eventBus = require("../../utils/eventBus");
const pool = require("../../db/pool");

const PORT = process.env.PORT || 5003;

const router = express.Router()

router.post("/register", authVerifyToken, async (req, res, next) => {
  try {
    if (req.body?.name === undefined || req.body?.allowed_inputs === undefined || req.body?.allowed_outputs === undefined || req.body?.color_theme === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(401).send();
    }
    const { email } = req.user;
    const { name, allowed_inputs, allowed_outputs, color_theme } = req.body;

    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const parent_tenant_id = user[0].tenant_id;
      const { rows: parentOrg, rowCount: orgCount } = await pool.query("SELECT * from mst_organization WHERE tenant_id = $1", [parent_tenant_id]);

      if ((orgCount > 0)) {
        const { level: parentLevel } = parentOrg[0]
        const { rows: newOrg, rowCount: newOrgCount } = await pool.query("INSERT INTO mst_organization(name, allowed_inputs, allowed_outputs, color_theme, level, parent_tenant_id) values ($1, $2, $3, $4, $5, $6) RETURNING *", [name, allowed_inputs, allowed_outputs, color_theme, (parentLevel - 1), parent_tenant_id]);

        if (!(newOrgCount > 0)) {
          console.error("Registration Organization Error");
          res.statusMessage = "Registration Organization Error"
          return res.status(401).send();
        }

        return res.status(200).json({ newOrg })
      }

      res.statusMessage = "Organization exists";
      return res.status(409).send();
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(409).send();
  }
  catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.get("/getAll", authVerifyToken, async (req, res, next) => {
  try {
    const { email } = req.user;

    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const { tenant_id } = user[0]
      const { rows: orgs, rowCount: orgCount } = await pool.query("SELECT * FROM mst_organization WHERE parent_tenant_id >= $1 ORDER BY tenant_id", [tenant_id]);

      if (orgCount > 0) {
        res.statusMessage = "Fetched Records";
        return res.status(200).json({ orgs });
      }

      res.statusMessage = "No Data";
      return res.status(202).send();
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(409).send();
  }
  catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(404).json({ error });
  }
})

router.all("/", (req, res, next) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

module.exports = router;