const express = require('express');
const eventBus = require('../utils/eventBus');
const modelEventSubscribers = require('./events');
const app = express();
const PORT = process.env.PORT || 5002;

app.use(express.json());

app.use("/", (req, res) => {
  res.status(200).json({ message: `Service running on ${PORT}` })
})

app.listen(PORT, async () => {
  await eventBus.connect()
  await modelEventSubscribers()
  console.log(`Model Service running on ${PORT}`)
});

