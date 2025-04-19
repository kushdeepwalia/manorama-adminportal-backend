require("dotenv").config();

const express = require('express');
const eventBus = require('../utils/eventBus');
const authEventSubscribers = require('./events');
const pool = require('../db/pool');
const app = express();
const PORT = process.env.PORT || 5005;
const userRoutes = require("./route/");

app.use(express.json());
app.use("/", userRoutes);

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✅ Connected to Postgres successfully`);
  } catch (error) {
    console.error('❌ Failed to connect to Postgres:', error.message);
  }
  try {
    await eventBus.connect()
    await authEventSubscribers();
    console.log('✅ Connected/Subscribed to Auth Events')
  }
  catch (err) {
    console.error('❌ Failed to connect/subscribe Auth Events', err)
  }
  console.log(`Auth Service running on ${PORT}`)
});