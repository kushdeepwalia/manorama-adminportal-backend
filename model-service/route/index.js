const express = require("express");
const authVerifyToken = require("../../middlewares/authVerifyToken/");
const eventBus = require("../../utils/eventBus");
const pool = require("../../db/pool");

const PORT = process.env.PORT || 5002;

const router = express.Router();

router.post("/register", authVerifyToken, async (req, res, next) => {
  try {
    if (req.body?.object_name === undefined || req.body?.marker === undefined || req.body?.project_id === undefined || req.body?.dynamo_project_name === undefined || req.body?.dynamo_project_id === undefined || (req.body?.file_name === undefined || Object.keys(req.body?.file_name).length === 0) || req.body?.tenant_id === undefined) {
      res.statusMessage = "Missing Fields";
      return res.status(400).send();
    }

    const { email } = req.user;
    const { rows: user, rowCount: userCount } = await eventBus.publish('AdminCheckUserEmail', { email }, Date.now().toString());

    if (userCount === 0) {
      res.statusMessage = "Account doesn't exists";
      return res.status(404).send();
    }

    const { project_id } = req.body;
    const { rows: project, rowCount: projectCount } = await eventBus.publish('ProjectCheckExistence', { project_id }, Date.now().toString());

    if (projectCount === 0) {
      res.statusMessage = "Project doesn't exists";
      return res.status(404).send();
    }

    const query = await eventBus.publish('ProjectCheckUserAccess', { project_id, userId: user[0].id }, Date.now().toString());

    if (!query) {
      res.statusMessage = "Unauthorized.";
      return res.status(401).send();
    }

    const { object_name, marker, dynamo_project_id, dynamo_project_name, file_name, tenant_id } = req.body;

    const { rows: model, rowCount: modelCount } = await pool.query("INSERT INTO mst_model(object_name, marker, project_id, dynamo_project_id, dynamo_project_name, file_name, tenant_id) values($1, $2, $3, $4, $5, $6, $7) RETURNING *", [object_name, marker, project_id, dynamo_project_id, dynamo_project_name, file_name, tenant_id]);

    if (modelCount === 0) {
      console.error("Error adding model.");
      res.statusMessage = "Error adding model."
      return res.status(500).send();
    }

    return res.status(201).json({ model });

  } catch (error) {
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

      const { rows: models, rowCount: modelCount } = await pool.query("SELECT m.id, m.object_name, m.marker, m.project_id, m.dynamo_project_id, m.dynamo_project_name, m.file_name, m.tenant_id, m.created_at, m.updated_at FROM mst_model m JOIN mst_project p ON m.project_id = p.id WHERE m.tenant_id = ANY($1) ORDER BY m.updated_at DESC", [tenantids]);

      if (modelCount > 0) {
        res.statusMessage = "Fetched Records";
        return res.status(200).json({ models });
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