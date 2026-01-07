import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[3]  # tax_chatbot 루트

DATABASE_URL = os.getenv("DATABASE_URL")

SECRET_KEY = os.getenv("SECRET_KEY", "change-me")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN")

USE_AZURE_OPENAI = bool(os.getenv("AZURE_OPENAI_API_KEY")) and bool(
    os.getenv("AZURE_OPENAI_ENDPOINT") 
)
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-2024-11-20")
AZURE_OPENAI_SMALL_DEPLOYMENT = os.getenv(
    "AZURE_OPENAI_SMALL_DEPLOYMENT", "gpt-4o-mini-2024-07-18"
)

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.1")
OPENAI_SMALL_MODEL = os.getenv("OPENAI_SMALL_MODEL", "gpt-5-nano")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")

INCOME_TAX_COLLECTION_DIR = BASE_DIR / "reference" / "income_tax_collection"
REAL_ESTATE_TAX_COLLECTION_DIR = BASE_DIR / "reference" / "real_estate_tax_collection"
