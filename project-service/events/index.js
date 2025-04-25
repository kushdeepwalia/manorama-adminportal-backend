const pool = require('../../db/pool');
const eventBus = require('../../utils/eventBus'); // or wherever your eventBus is defined

async function projectEventSubscribers() {
  await eventBus.subscribe('projectUserCreated', async (data) => {
    console.log('📨 [PROJECT SERVICE] User created:', data);
  });

  await eventBus.subscribe('ProjectCheckExistence', async (data, sendResponse) => {
    const { project_id } = data;
    console.log('📨 [PROJECT SERVICE] Check Project Existence: ', data);

    const query = await pool.query("SELECT * FROM mst_project WHERE project_id = $1", [project_id])

    sendResponse(query);
  })

  await eventBus.subscribe('ProjectCheckUserAccess', async (data, sendResponse) => {
    const { project_id, user_id } = data;
    console.log('📨 [PROJECT SERVICE] Check Project Existence: ', data);

    const { rows } = await pool.query(`
      WITH RECURSIVE tenant_tree AS (
        SELECT tenant_id
        FROM mst_organization
        WHERE tenant_id = (SELECT tenant_id FROM mst_user WHERE id = $1)
    
        UNION ALL
    
        SELECT o.tenant_id
        FROM mst_organization o
        JOIN tenant_tree tt ON o.parent_tenant_id = tt.tenant_id
      ),
      user_accessible_tenants AS (
        SELECT tenant_id FROM tenant_tree
        UNION
        SELECT o.parent_tenant_id
        FROM mst_organization o
        JOIN tenant_tree tt ON o.tenant_id = tt.tenant_id
        WHERE o.parent_tenant_id IS NOT NULL
      )
      SELECT EXISTS (
        SELECT 1
        FROM txn_org_project top
        WHERE top.project_id = $2
          AND top.tenant_id = ANY (SELECT tenant_id FROM user_accessible_tenants)
          AND top.access = 'write'
      ) AS has_writer_access;
    `, [user_id, project_id]);

    const hasWriterAccess = rows[0].has_writer_access;

    sendResponse(hasWriterAccess);
  })
}

module.exports = projectEventSubscribers;
