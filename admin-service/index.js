require("dotenv").config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const eventBus = require('../utils/eventBus');
const adminEventSubscribers = require('./events');
const pool = require('../db/pool');
const app = express();
const PORT = process.env.PORT || 5001;
const adminRoutes = require("./route");

app.use(express.json());
app.use((req, res, next) => {
  res.setTimeout(10 * 60 * 1000); // 10 minutes
  next();
});
app.use("/", adminRoutes)

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✅ Connected to Postgres successfully`);
  } catch (error) {
    console.error('❌ Failed to connect to Postgres:', error.message);
  }
  try {
    await eventBus.connect()
    await adminEventSubscribers();
    console.log('✅ Connected/Subscribed to Admin Events')
  }
  catch (err) {
    console.error('❌ Failed to connect/subscribe Admin Events', err)
  }
  console.log(`Admin Service running on ${PORT}`)
});
