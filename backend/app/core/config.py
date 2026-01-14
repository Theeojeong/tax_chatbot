import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# LangSmith Configuration
os.environ["LANGCHAIN_PROJECT"] = "tax-chatbot"
os.environ["LANGCHAIN_TRACING_V2"] = "true"

BASE_DIR = Path(__file__).resolve().parents[2]
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN")

OPENAI_MODEL = "gpt-5.1"
OPENAI_SMALL_MODEL = "gpt-5-nano"
OPENAI_EMBEDDING_MODEL = "text-embedding-3-large"

INCOME_TAX_COLLECTION_DIR = BASE_DIR / "reference" / "income_tax"
REAL_ESTATE_TAX_COLLECTION_DIR = BASE_DIR / "reference" / "real_estate_tax"
