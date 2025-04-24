require("dotenv").config();

const express = require('express');
const eventBus = require('../utils/eventBus');
const modelEventSubscribers = require('./events');
const app = express();
const modelRoutes = require("./route/");
const pool = require("../db/pool");
const PORT = process.env.PORT || 5002;

app.use(express.json());

app.use("/", modelRoutes);

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✅ Connected to Postgres successfully`);
  } catch (error) {
    console.error('❌ Failed to connect to Postgres:', error.message);
  }
  try {
    await eventBus.connect()
    await modelEventSubscribers()
    console.log('✅ Connected/Subscribed to Model Events')
  } catch (err) {
    console.error('❌ Failed to connect/subscribe Model Events', err)
  }
  console.log(`Model Service running on ${PORT}`)
});

