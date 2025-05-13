const { createClient } = require("redis");

const redisClient = createClient({
  username: 'default',
  password: 'C2XIamYMDYQc99qllc0F8aGh7JbSTMy1',
  socket: {
    host: 'redis-11867.c15.us-east-1-2.ec2.redns.redis-cloud.com',
    port: 11867
  }
});

redisClient.connect();

redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

async function deleteSingleCache(cacheKey) {
  return await redisClient.del(cacheKey);
}

async function storeCache(cacheKey, CACHE_EXPIRY, data) {
  return await redisClient.setEx(cacheKey, CACHE_EXPIRY, JSON.stringify(data));
}

async function getCache(cacheKey) {
  return await redisClient.get(cacheKey);
}

module.exports = { redisClient, deleteSingleCache, storeCache, getCache }

