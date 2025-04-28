const express = require("express");
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const eventBus = require("../../utils/eventBus");
const pool = require("../../db/pool");

const PORT = process.env.PORT || 5003;

const router = express.Router()

router.post("/register", authVerifyToken, async (req, res, next) => {
  try {
    if (req.body?.name === undefined || req.body?.allowed_inputs === undefined || req.body?.allowed_outputs === undefined || req.body?.color_theme === undefined || req.body?.parent_tenant_id === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(400).send();
    }
    const { email } = req.user;
    const { name, allowed_inputs, allowed_outputs, color_theme, parent_tenant_id } = req.body;

    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const tenant_id = Number(user[0].tenant_id);

      if (tenant_id !== 1) {
        res.statusMessage = "Forbidden."
        return res.status(403).json({ tenant_id });
      }

      const { rows: parentOrg, rowCount: parentOrgCount } = await pool.query("SELECT * from mst_organization WHERE tenant_id = $1", [parent_tenant_id]);

      if ((parentOrgCount > 0)) {
        const { level: parentLevel } = parentOrg[0];

        const { rows: newOrg, rowCount: newOrgCount } = await pool.query("INSERT INTO mst_organization(name, allowed_inputs, allowed_outputs, color_theme, level, parent_tenant_id) values ($1, $2, $3, $4, $5, $6) RETURNING *", [name, allowed_inputs, allowed_outputs, color_theme, (parentLevel - 1), parent_tenant_id]);

        if (!(newOrgCount > 0)) {
          console.error("Error adding organization.");
          res.statusMessage = "Error adding organization."
          return res.status(500).send();
        }

        return res.status(201).json({ newOrg });
      }

      res.statusMessage = "Organization doesn't exists";
      return res.status(404).send();
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(404).send();
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
      const tenant_id = Number(user[0].tenant_id);

      const tenantids = await eventBus.publish('OrgGetTenantIds', { tenant_id }, Date.now().toString());

      const { rows: orgs, rowCount: orgCount } = await pool.query(`
        SELECT 
          org.tenant_id, 
          org.name AS org_name, 
          org.color_theme, 
          org.allowed_inputs, 
          org.allowed_outputs, 
          org.parent_tenant_id, 
          CASE 
            WHEN org.tenant_id = 1 THEN NULL
            ELSE o.name
          END AS parent_org_name, 
          org.created_at, 
          org.updated_at 
        FROM mst_organization org 
        LEFT JOIN mst_organization o 
          ON org.parent_tenant_id = o.tenant_id 
        WHERE org.tenant_id = ANY($1)
        ORDER BY org.updated_at DESC
      `, [tenantids]);

      if (orgCount > 0) {
        res.statusMessage = "Fetched Records";
        return res.status(200).json({ orgs });
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

router.put("/modify/:id", authVerifyToken, async (req, res, next) => {
  try {
    if (!req.params.id) {
      res.statusMessage = "Missing Id";
      return res.status(400).send();
    }

    if (req.body?.name === undefined || req.body?.allowed_inputs === undefined || req.body?.allowed_outputs === undefined || req.body?.color_theme === undefined || req.body?.parent_tenant_id === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(400).send();
    }

    const { id } = req.params;
    const { email } = req.user;
    const { name, allowed_inputs, allowed_outputs, color_theme, parent_tenant_id } = req.body;

    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const tenant_id = Number(user[0].tenant_id);

      if (tenant_id !== 1) {
        res.statusMessage = "Forbidden."
        return res.status(403).json({ tenant_id });
      }

      const { rows: parentOrg, rowCount: parentOrgCount } = await pool.query("SELECT * from mst_organization WHERE tenant_id = $1", [parent_tenant_id]);

      if ((parentOrgCount > 0)) {
        const { level: parentLevel } = parentOrg[0];

        const { rows: modifiedOrg, rowCount: modifiedOrgCount } = await pool.query("UPDATE mst_organization SET name = $1, allowed_inputs = $2, allowed_outputs = $3, color_theme = $4, level = $5, parent_tenant_id = $6 WHERE tenant_id = $7 RETURNING *", [name, allowed_inputs, allowed_outputs, color_theme, (parentLevel - 1), parent_tenant_id, id]);

        if (!(modifiedOrgCount > 0)) {
          console.error("Error modifying organization.");
          res.statusMessage = "Error modifying organization."
          return res.status(500).send();
        }

        return res.status(200).json({ modifiedOrg });
      }

      res.statusMessage = "Organization doesn't exists";
      return res.status(404).send();
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(404).send();
  }
  catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.delete("/delete/:id", authVerifyToken, async (req, res, next) => {
  try {

    if (!req.params.id) {
      res.statusMessage = "Missing Id";
      return res.status(400).send();
    }
    const { id } = req.params;
    const { email } = req.user;

    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const tenant_id = Number(user[0].tenant_id);

      if (tenant_id !== 1) {
        res.statusMessage = "Forbidden."
        return res.status(403).json({ tenant_id });
      }

      const { rows: deletedOrg, rowCount: deletedOrgCount } = await pool.query("DELETE FROM mst_organization WHERE tenant_id = $1 RETURNING *", [id]);

      if (deletedOrgCount === 0) {
        res.statusMessage = "Organization doesn't exists";
        return res.status(404).send();
      }

      return res.status(200).json({ deletedOrg });
    }

    res.statusMessage = "Account doesn't exists";
    return res.status(404).send();

  } catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.all("/", (req, res, next) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

module.exports = router;