const eventBus = require('../../utils/eventBus'); // or wherever your eventBus is defined

async function authEventSubscribers() {
  await eventBus.subscribe('AuthUserCreated', async (data) => {
    console.log('📨 [AUTH SERVICE] User created:', data);
  });
}

module.exports = authEventSubscribers;
