const eventBus = require('../../utils/eventBus'); // or wherever your eventBus is defined

async function modelEventSubscribers() {
  await eventBus.subscribe('ModelUserCreated', async (data) => {
    console.log('📨 [MODEL SERVICE] User created:', data);
  });
}

module.exports = modelEventSubscribers;
