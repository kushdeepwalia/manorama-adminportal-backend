const eventBus = require('../../utils/eventBus'); // or wherever your eventBus is defined

async function projectEventSubscribers() {
  await eventBus.subscribe('projectUserCreated', async (data) => {
    console.log('📨 [PROJECT SERVICE] User created:', data);
  });
}

module.exports = projectEventSubscribers;
