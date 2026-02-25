const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

let connection;

const getRedisConnection = () => {
  if (!connection) {
    if (!process.env.REDIS_URL) {
      console.warn('⚠️  REDIS_URL not set — BullMQ disabled');
      return null;
    }
    connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
};

module.exports = { getRedisConnection, Queue, Worker };
