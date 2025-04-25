const express = require("express");
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const eventBus = require("../../utils/eventBus");
const pool = require("../../db/pool");

const PORT = process.env.PORT || 5004;

const router = express.Router();

router.post("/register", authVerifyToken, async (req, res, next) => {
  try {
    if (req.body?.name === undefined || req.body?.allowed_inputs === undefined || req.body?.allowed_outputs === undefined || req.body?.tenant_id === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(400).send(req.body);
    }
    const { email } = req.user;
    const { name, allowed_inputs, allowed_outputs, tenant_id: project_tenant_id } = req.body;

    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount > 0) {
      const tenant_id = Number(user[0].tenant_id)


      if (tenant_id === 1 || tenant_id === project_tenant_id) {

        const { rows } = await pool.query("SELECT count(*) FROM mst_project WHERE tenant_id = $1 AND name = $2", [project_tenant_id, name]);

        console.log(rows);

        if (rows[0].count > 0) {
          res.statusMessage = "Project name exists";
          return res.status(409).send();
        }

        const { rows: project, rowCount: projectCount } = await pool.query("WITH inserted_project as (INSERT INTO mst_project(name, tenant_id, allowed_inputs, allowed_outputs) values($1, $2, $3, $4) RETURNING *) SELECT ip.*, ip.tenant_id as organization_id, o.name as organization_name FROM inserted_project ip JOIN mst_organization o ON ip.tenant_id = o.tenant_id", [name, project_tenant_id, allowed_inputs, allowed_outputs])

        // const query = await pool.query("INSERT INTO txn_org_project (tenant_id, project_id, access) values($1,$2,'admin')", [project_tenant_id, project[0].id])

        if (!(projectCount > 0)) {
          console.error("Error adding project");
          res.statusMessage = "Error adding project";
          return res.status(500).send();
        }

        res.statusMessage = "Added Project";
        return res.status(201).json({ project });
      }
      res.statusMessage = "Forbidden";
      return res.status(403).send();
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

      const { rows: projects, rowCount: projectCount } = await pool.query("SELECT p.id, p.name, p.image, p.allowed_inputs, p.allowed_outputs, p.tenant_id as org_tenant_id, o.name as org_name, p.created_at, p.updated_at FROM mst_project p JOIN mst_organization o ON o.tenant_id = p.tenant_id WHERE p.tenant_id = ANY($2) OR $1 = 1 OR p.id IN (SELECT project_id FROM txn_org_project WHERE tenant_id = ANY($2)) ORDER BY p.updated_at DESC", [tenant_id, tenantids]);

      // const { rows: projects, rowCount: projectCount } = await pool.query("SELECT * FROM mst_project WHERE tenant_id = ANY($1) ORDER BY tenant_id", [tenantids]);

      if (projectCount > 0) {
        res.statusMessage = "Fetched Records";
        return res.status(200).json({ projects });
      }

      res.statusMessage = "No Data";
      return res.status(204).send();
    }

    res.statusMessage = "No Data";
    return res.status(204).send();

  } catch (error) {
    res.statusMessage = "Internal Server error";
    res.status(500).json({ error });
  }
})

router.all("/", (_, res) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

module.exports = router;