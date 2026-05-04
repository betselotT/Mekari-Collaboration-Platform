from pydantic_settings import BaseSettings
from pathlib import Path


def _find_env_file() -> str:
    """Walk up from this file until we find a .env file."""
    here = Path(__file__).resolve().parent
    for directory in [here, here.parent, here.parent.parent, here.parent.parent.parent]:
        candidate = directory / ".env"
        if candidate.exists():
            return str(candidate)
    return ".env"


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017/mekari"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    intelligence_port: int = 5000
    intelligence_host: str = "0.0.0.0"
    # Escalation thresholds (tunable at runtime via env)
    ai_confidence_threshold: float = 0.75
    ai_standalone_threshold: float = 0.85

    model_config = {"env_file": _find_env_file(), "extra": "ignore"}


settings = Settings()
