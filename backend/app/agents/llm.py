from langchain_openai import (
    AzureChatOpenAI,
    AzureOpenAIEmbeddings,
    ChatOpenAI,
    OpenAIEmbeddings,
)

from ..core.config import (
    OPENAI_EMBEDDING_MODEL,
    OPENAI_MODEL,
    OPENAI_SMALL_MODEL,
)


def get_llm():
    return ChatOpenAI(model=OPENAI_SMALL_MODEL, temperature=0)


def get_embeddings():
    return OpenAIEmbeddings(model=OPENAI_EMBEDDING_MODEL)
