require("dotenv").config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const eventBus = require('../utils/eventBus');
const authEventSubscribers = require('./events');
const pool = require('../db/pool');
const app = express();
const PORT = process.env.PORT || 5005;
const userRoutes = require("./route/");

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  res.setTimeout(10 * 60 * 1000); // 10 minutes
  next();
});
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