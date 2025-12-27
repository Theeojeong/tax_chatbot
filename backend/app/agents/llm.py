from langchain_openai import (
    AzureChatOpenAI,
    AzureOpenAIEmbeddings,
    ChatOpenAI,
    OpenAIEmbeddings,
)

from ..core.config import (
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_SMALL_DEPLOYMENT,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_MODEL,
    OPENAI_SMALL_MODEL,
    USE_AZURE_OPENAI,
)


def get_llm(*, small: bool = False):
    if USE_AZURE_OPENAI:
        deployment = AZURE_OPENAI_SMALL_DEPLOYMENT if small else AZURE_OPENAI_DEPLOYMENT
        return AzureChatOpenAI(
            azure_deployment=deployment,
            api_version=AZURE_OPENAI_API_VERSION,
            temperature=0,
        )

    model = OPENAI_SMALL_MODEL if small else OPENAI_MODEL
    return ChatOpenAI(model=model, temperature=0)


def get_embeddings():
    if USE_AZURE_OPENAI:
        return AzureOpenAIEmbeddings()

    return OpenAIEmbeddings(model=OPENAI_EMBEDDING_MODEL)
