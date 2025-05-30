require("dotenv").config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const eventBus = require('../utils/eventBus');
const orgEventSubscribers = require('./events');
const app = express();
const pool = require('../db/pool');
const orgRoutes = require("./route")
const PORT = process.env.PORT || 5003;

app.use(express.json());
app.use((req, res, next) => {
  res.setTimeout(10 * 60 * 1000); // 10 minutes
  next();
});
app.use("/", orgRoutes);

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✅ Connected to Postgres successfully`);
  } catch (error) {
    console.error('❌ Failed to connect to Postgres:', error.message);
  }
  try {
    await eventBus.connect()
    await orgEventSubscribers();
    console.log('✅ Connected/Subscribed to Organization Events')
  }
  catch (err) {
    console.error('❌ Failed to connect/subscribe Organization Events', err)
  }
  console.log(`Organization Service running on ${PORT}`)
});

