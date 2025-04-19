const eventBus = require('../../utils/eventBus'); // or wherever your eventBus is defined

async function orgEventSubscribers() {
  await eventBus.subscribe('OrgUserCreated', async (data) => {
    console.log('📨 [ORGANIZATION SERVICE] User created:', data);
  });
}

module.exports = orgEventSubscribers;
