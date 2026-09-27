import os
import redis.asyncio as redis
import logging

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Redis connection pool
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

async def get_redis():
    return redis_client

async def test_redis_connection():
    try:
        ping = await redis_client.ping()
        if ping:
            logger.info("Successfully connected to Redis.")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
