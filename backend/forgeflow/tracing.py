"""Langfuse tracing configuration — auto-instrument all agent calls."""

from langfuse import Langfuse, observe
from forgeflow.config import settings

# Initialize Langfuse only if credentials are provided
if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
    langfuse = Langfuse(
        public_key=settings.LANGFUSE_PUBLIC_KEY,
        secret_key=settings.LANGFUSE_SECRET_KEY,
        host=settings.LANGFUSE_HOST,
    )
else:
    langfuse = Langfuse(public_key="", secret_key="")

__all__ = ["langfuse", "observe"]
