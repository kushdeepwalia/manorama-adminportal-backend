require("dotenv").config();

const express = require('express');
const eventBus = require('../utils/eventBus');
const projectEventSubscribers = require('./events');
const app = express();
const PORT = process.env.PORT || 5004;
const projectRoutes = require("./route/");
const pool = require("../db/pool");

app.use(express.json());

app.use("/", projectRoutes);

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✅ Connected to Postgres successfully`);
  } catch (error) {
    console.error('❌ Failed to connect to Postgres:', error.message);
  }

  try {
    await eventBus.connect()
    await projectEventSubscribers()
    console.log('✅ Connected/Subscribed to Project Events')
  }
  catch (err) {
    console.error('❌ Failed to connect/subscribe Project Events', err)
  }
  console.log(`Project Service running on ${PORT}`)
});

