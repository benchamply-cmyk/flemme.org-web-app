"""Environment-backed application settings."""

import os

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv(".env.local")
load_dotenv()


class Settings(BaseModel):
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    qualification_service_key: str | None = os.getenv("FLEMME_QUALIFICATION_SERVICE_KEY")
    qualification_database_path: str | None = os.getenv("FLEMME_QUALIFICATION_DATABASE_PATH")
    qualification_daily_limit: int = 300


settings = Settings()
