from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_uri)
    return _client


def get_db():
    """Return the Mekari database handle (matches the Node.js connection)."""
    return get_client().get_default_database()


# Named collection accessors used throughout the intelligence layer.
def threads():
    return get_db()["threads"]


def knowledge_docs():
    return get_db()["knowledgedocs"]


def users():
    return get_db()["users"]


def point_events():
    return get_db()["pointevents"]


def feedback_events():
    return get_db()["feedbackevents"]


def messages():
    return get_db()["messages"]
