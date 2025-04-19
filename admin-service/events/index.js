const pool = require('../../db/pool');
const eventBus = require('../../utils/eventBus'); // or wherever your eventBus is defined
const sendMail = require('../services/nodemailer');

async function adminEventSubscribers() {
  await eventBus.subscribe('AdminUserCreated', async (data) => {
    console.log('📨 [ADMIN SERVICE] User created:', data);
  });

  await eventBus.subscribe('AdminCheckUserEmail', async (data, sendResponse) => {
    console.log('📨 [ADMIN SERVICE] Check email:', data);

    sendResponse(await pool.query("SELECT * FROM mst_admin WHERE email = $1", [data.email]))
  })

  await eventBus.subscribe('AdminSendEmailToNewUser', async (data) => {
    // console.log(data)
    console.log('📨 [ADMIN SERVICE] Sending email:', data);

    sendMail(data.mailOptions);
  })
}

module.exports = adminEventSubscribers;
