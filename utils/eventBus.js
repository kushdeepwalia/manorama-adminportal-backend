const amqp = require('amqplib');

const RABBITMQ_URL = 'amqp://localhost';
let channel;

async function connect() {
  const conn = await amqp.connect(RABBITMQ_URL);
  channel = await conn.createChannel();
}

// Publish method that allows sending messages with a replyTo queue for responses
async function publish(event, data, correlationId = null) {
  await channel.assertQueue(event);

  // If there's a correlationId, we are expecting a response, so add a replyTo
  if (correlationId) {
    const replyQueue = await channel.assertQueue('', { exclusive: true });

    // Send the message with the replyTo queue and correlationId for response handling
    channel.sendToQueue(event, Buffer.from(JSON.stringify(data)), {
      replyTo: replyQueue.queue,
      correlationId: correlationId,
    });

    console.log('Request sent with correlationId:', correlationId);

    // Wait for the response from the replyQueue
    return new Promise((resolve, reject) => {
      channel.consume(replyQueue.queue, (msg) => {
        if (msg.properties.correlationId === correlationId) {
          // Handle the response
          resolve(JSON.parse(msg.content.toString()));
          channel.ack(msg);  // Acknowledge the message
        }
      });
    });
  } else {
    // If no correlationId, just send the message without waiting for a response
    channel.sendToQueue(event, Buffer.from(JSON.stringify(data)));
    console.log('Message sent without expecting response');
  }
}

// Subscribe method for handling incoming requests and responding to them
async function subscribe(event, handler) {
  await channel.assertQueue(event);
  channel.consume(event, (msg) => {
    if (msg !== null) {
      const data = JSON.parse(msg.content.toString());

      // Call the handler to process the data
      // Pass the data and sendResponse callback to the handler
      handler(data, (responseData) => {
        if (msg.properties.replyTo) {
          // Send the response to the replyTo queue with correlationId
          channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(responseData)), {
            correlationId: msg.properties.correlationId
          });
          console.log('Response sent for correlationId:', msg.properties.correlationId);
        }
      });

      // Acknowledge the message
      channel.ack(msg);
    }
  });
}

const eventBus = {
  connect,
  publish,
  subscribe
}

module.exports = eventBus;