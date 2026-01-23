from langchain_openai import (
    AzureChatOpenAI,
    AzureOpenAIEmbeddings,
    ChatOpenAI,
    OpenAIEmbeddings,
)
from langchain_upstage import UpstageEmbeddings

from ..core.config import (
    OPENAI_EMBEDDING_MODEL,
    OPENAI_MODEL,
    OPENAI_SMALL_MODEL,
    UPSTAGE_EMBEDDING_MODEL,
)


def get_llm(small: bool = True):
    if small:
        return ChatOpenAI(model=OPENAI_SMALL_MODEL, temperature=0)
    return ChatOpenAI(model=OPENAI_MODEL, temperature=0)


def get_embeddings():
    return UpstageEmbeddings(model=UPSTAGE_EMBEDDING_MODEL)
