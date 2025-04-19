const express = require('express');
const eventBus = require('../utils/eventBus');
const projectEventSubscribers = require('./events');
const app = express();
const PORT = process.env.PORT || 5004;

app.use(express.json());

app.use("/", (req, res) => {
  res.status(200).json({ messgage: `Service running on ${PORT}` })
})

app.listen(PORT, async () => {
  await eventBus.connect()
  await projectEventSubscribers()
  console.log(`Project Service running on ${PORT}`)
});

