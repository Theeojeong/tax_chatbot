from typing import Literal
from typing_extensions import List, TypedDict

from langchain_classic import hub
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langgraph.graph import END, START, StateGraph
import os
from dotenv import load_dotenv

load_dotenv()

os.getenv("LANGSMITH_API_KEY")
os.environ["LANGCHAIN_PROJECT"] = "tax-chatbot"
os.environ["LANGCHAIN_TRACING_V2"] = "true"

from ..core.config import INCOME_TAX_COLLECTION_DIR
from .llm import get_embeddings, get_llm


embedding_function = get_embeddings()
vector_store = Chroma(
    embedding_function=embedding_function,
    collection_name="income_tax",
    persist_directory=str(INCOME_TAX_COLLECTION_DIR),
)
retriever = vector_store.as_retriever(search_kwargs={"k": 3})


class AgentState(TypedDict):
    query: str
    context: List[Document]
    answer: str
    chat_history: list[dict]


llm = get_llm()
small_llm = get_llm(small=True)

graph_builder = StateGraph(AgentState)


dictionary = ["사람과 관련된 표현 -> 거주자"]

rewrite_before_retrieve_prompt = PromptTemplate.from_template(
    """
You are an intelligent search query optimizer. 
Your job is to rewrite the user's question to be more effective for keyword-based or semantic search in a tax law database.

Follow these rules:
1. **Resolve Ambiguity**: Replace pronouns (e.g., "it", "that", "he") with specific names or entities from the context if possible. (Note: Only current query is provided here, but interpret clearly).
2. **Use Professional Terminology**: Use the provided dictionary to map common words to legal/tax terms.
3. **Be Specific**: Add necessary context to make the query standalone.
4. **Keep Meaning**: Do not change the original intent of the user.
5. **Output ONLY the rewritten query**: Do not add any explanations or prefixes.

Original Question: {query}
Rewritten Question:"""
)

def rewrite_before_retrieve(state: AgentState):
    rewrite_chain = rewrite_before_retrieve_prompt | llm | StrOutputParser()
    response = rewrite_chain.invoke({"query": state["query"]})
    return {"query": response}


def retrieve(state: AgentState):
    docs = retriever.invoke(state["query"])
    return {"context": docs}


doc_relevance_prompt = hub.pull("langchain-ai/rag-document-relevance")


def check_doc_relevance(state: AgentState) -> Literal["relevant", "irrelevant"]:
    doc_relevance_chain = doc_relevance_prompt | small_llm
    response = doc_relevance_chain.invoke(
        {"question": state["query"], "documents": state["context"]}
    )
    return "relevant" if response["Score"] == 1 else "irrelevant"


generate_prompt = PromptTemplate(
    input_variables=["context", "question", "chat_history"],  # chat_history 추가
    template="""You are an assistant for question-answering tasks. 
        Use the following pieces of retrieved context to answer the question. 
        If you don't know the answer, just say that you don't know. 
        Use three sentences maximum and keep the answer concise.
        chat_history: {chat_history} 
        Question: {question}
        Context: {context}
        Answer:""",
)


def generate(state: AgentState):
    rag_chain = generate_prompt | llm
    response = rag_chain.invoke(
        {
            "question": state["query"],
            "context": state["context"],
            "chat_history": state["chat_history"],
        }
    )
    return {"answer": response.content}


rewrite_prompt = PromptTemplate.from_template(
    """
너는 대한민국 세법(소득세법) 문서를 검색하기 위한 
"검색 질의 생성기" 역할을 한다.

목표:
- 사용자의 질문을 그대로 답변하지 말고
- 소득세법 문서에서 관련 조문을 가장 잘 찾을 수 있도록
  검색에 최적화된 질의로 재작성하라.

규칙:
1. 가능한 경우 반드시 "제X조", "제X조의Y", "제X항", "제X호" 형태를 사용하라.
2. 세법에서 사용되는 공식 용어를 우선 사용하라.
   (예: 세율, 과세표준, 산출세액, 필요경비, 예정신고 등)
3. 불필요한 조사, 존댓말, 질문 표현은 제거하라.
4. 계산식, 표, 요건, 세율과 관련된 질문이면 해당 개념을 명시하라.
5. 질문이 모호하면 가장 가능성이 높은 법령 키워드 중심으로 재작성하라.
6. 절대 답변을 생성하지 말고, 검색용 질의만 출력하라.

사용자 질문:
{query}

사용자의 질문으로 rag retrieve된 문서:
{dictionary}

검색용 질의:"""
)

def rewrite(state: AgentState):
    rewrite_chain = rewrite_prompt | llm | StrOutputParser()
    response = rewrite_chain.invoke({"query": state["query"], "dictionary": dictionary})
    return {"query": response}


hallucination_prompt = PromptTemplate.from_template(
    """
You are a teacher tasked with evaluating whether a student's answer is based on documents or not,
Given documents, which are excerpts from income tax law, and a student's answer;
If the student's answer is based on documents, respond with "not hallucinated",
If the student's answer is not based on documents, respond with "hallucinated".

documents: {documents}
student_answer: {student_answer}
"""
)


def check_hallucination(
    state: AgentState,
) -> Literal["hallucinated", "not hallucinated"]:
    context = [doc.page_content for doc in state["context"]]
    hallucination_chain = hallucination_prompt | small_llm | StrOutputParser()
    response = hallucination_chain.invoke(
        {"student_answer": state["answer"], "documents": context}
    )
    return response


helpfulness_prompt = hub.pull("langchain-ai/rag-answer-helpfulness")


def check_helpfulness_grader(state: AgentState) -> Literal["helpful", "unhelpful"]:
    helpfulness_chain = helpfulness_prompt | llm
    response = helpfulness_chain.invoke(
        {"question": state["query"], "student_answer": state["answer"]}
    )
    return "helpful" if response["Score"] == 1 else "unhelpful"


def check_helpfulness(state: AgentState):
    return state


def fallback_answer(state: AgentState):
    """문서가 관련 없을 때 기본 답변 반환"""
    return {
        "answer": "죄송합니다. 해당 질문에 대한 정보를 찾지 못했습니다. 다른 방식으로 질문해 주시거나, 세무 전문가에게 문의해 주세요."
    }


graph_builder.add_node("retrieve", retrieve)
graph_builder.add_node("generate", generate)
graph_builder.add_node("rewrite", rewrite)
graph_builder.add_node("check_helpfulness", check_helpfulness)
graph_builder.add_node("fallback_answer", fallback_answer)


graph_builder.add_edge(START, "retrieve")
graph_builder.add_conditional_edges(
    "retrieve",
    check_doc_relevance,
    {"relevant": "generate", "irrelevant": "fallback_answer"},
)
graph_builder.add_edge("fallback_answer", END)
graph_builder.add_conditional_edges(
    "generate",
    check_hallucination,
    {"not hallucinated": "check_helpfulness", "hallucinated": "generate"},
)
graph_builder.add_conditional_edges(
    "check_helpfulness",
    check_helpfulness_grader,
    {"helpful": END, "unhelpful": "rewrite"},
)
graph_builder.add_edge("rewrite", "retrieve")


graph = graph_builder.compile()

if __name__ == "__main__":
    with open("graph.png", "wb") as f:
        f.write(graph.get_graph().draw_mermaid_png())
