const pool = require('../../db/pool');
const eventBus = require('../../utils/eventBus'); // or wherever your eventBus is defined

async function orgEventSubscribers() {
  await eventBus.subscribe('OrgUserCreated', async (data) => {
    console.log('📨 [ORGANIZATION SERVICE] User created:', data);
  });

  await eventBus.subscribe('OrgGetTenantIds', async (data, sendResponse) => {
    const { tenant_id } = data;
    console.log('📨 [ORGANIZATION SERVICE] Fetch TenantIDs from:', data);
    const { rows: tenantTree } = await pool.query(`
      WITH RECURSIVE tenant_tree AS (
        SELECT tenant_id FROM mst_organization WHERE tenant_id = $1
        UNION ALL
        SELECT o.tenant_id FROM mst_organization o
        JOIN tenant_tree tt ON o.parent_tenant_id = tt.tenant_id
      )
      SELECT tenant_id FROM tenant_tree;
    `, [tenant_id]);

    // Step 2: Extract ids
    const tenantIds = tenantTree.map(row => row.tenant_id); // [3, 6, 7]

    sendResponse(tenantIds);
  })

  await eventBus.subscribe('GetAllOrganizations', async (_, sendResponse) => {
    const query = `
      SELECT tenant_id, name
      FROM mst_organization
    `;

    try {
      const res = await pool.query(query);

      // reduce rows to { tenant_id: name, ... }
      const result = res.rows.reduce((acc, row) => {
        acc[row.name] = row.tenant_id;
        return acc;
      }, {});

      console.log(result);
      sendResponse(result);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      throw err;
    }
  })
}

module.exports = orgEventSubscribers;
