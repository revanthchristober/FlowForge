from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Always resolve .env from project root (two levels up from this file)
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Postgres
    DATABASE_URL: str = "postgresql://forge:forge@localhost:5432/forgeflow"

    # LiteLLM proxy
    LITELLM_PROXY_URL: str = "http://localhost:4000"
    LITELLM_MASTER_KEY: str = "sk-forge-master"

    # LLM providers (direct fallback when proxy unavailable)
    ANTHROPIC_API_KEY: str = ""

    # Langfuse (cloud)
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    # App
    DEFAULT_BUDGET_CAP_USD: float = 5.0
    LOG_LEVEL: str = "INFO"

    @property
    def litellm_api_key(self) -> str:
        return self.LITELLM_MASTER_KEY


settings = Settings()
