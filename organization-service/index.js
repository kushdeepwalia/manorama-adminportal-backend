const express = require('express');
const eventBus = require('../utils/eventBus');
const orgEventSubscribers = require('./events');
const app = express();
const PORT = process.env.PORT || 5003;

app.use(express.json());

app.use("/", (req, res) => {
  res.status(200).json({ messgage: `Service running on ${PORT}` })
})

app.listen(PORT, async () => {
  await eventBus.connect()
  await orgEventSubscribers()
  console.log(`Organization Service running on ${PORT}`)
});

