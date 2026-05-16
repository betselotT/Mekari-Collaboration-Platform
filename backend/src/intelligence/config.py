from pydantic_settings import BaseSettings
from pathlib import Path


def _find_env_files() -> tuple[str, ...]:
    """Return existing .env files from repo root to service-local overrides."""
    here = Path(__file__).resolve().parent
    candidates: list[str] = []
    for directory in [here.parent.parent.parent, here.parent.parent, here.parent, here]:
        candidate = directory / ".env"
        if candidate.exists():
            candidates.append(str(candidate))
    return tuple(candidates) or (".env",)


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017/mekari"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    intelligence_port: int = 5000
    intelligence_host: str = "0.0.0.0"
    # Escalation thresholds (tunable at runtime via env)
    ai_confidence_threshold: float = 0.75
    ai_standalone_threshold: float = 0.85

    model_config = {"env_file": _find_env_files(), "extra": "ignore"}


settings = Settings()
