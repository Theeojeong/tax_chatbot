from typing import Literal
from typing_extensions import List, TypedDict

from langchain_classic import hub
from langchain_chroma import Chroma
from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder, PromptTemplate
from langgraph.graph import END, START, StateGraph
from langchain_core.documents import Document
from langchain_tavily import TavilySearch
from langchain_postgres import PGVector
from dotenv import load_dotenv

load_dotenv()

from ..core.config import CONNECTION_STRING
from .llm import get_embeddings, get_llm

llm = get_llm()
small_llm = get_llm(small=True)
embedding_function = get_embeddings()

vectorstore = PGVector(
    embeddings=embedding_function,  # 임베딩 함수
    connection=CONNECTION_STRING,  # PostgreSQL 연결 문자열
    collection_name="income_tax_recursive_splitter",  # 컬렉션 이름
    distance_strategy="cosine",  # 코사인 유사도 사용
    pre_delete_collection=False,  # 기존 컬렉션 삭제 여부
    use_jsonb=True,  # 메타데이터를 JSONB로 저장 (더 나은 성능과 유연성 제공)
)

base_retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

QUERY_PROMPT = PromptTemplate(
    input_variables=["question"],
    template="""당신의 임무는 사용자의 질문에 대해 벡터 데이터베이스에서 관련 문서를 검색하기 위해 3개의 서로 다른 버전의 질문을 생성하는것입니다. 
    다양한 관점에서 질문을 작성함으로써 거리 기반 유사도 검색의 한계를 극복하는 것이 목적입니다.
    
    사용자 질문: {question}
    """,
)

retriever_multi = MultiQueryRetriever.from_llm(
    retriever=base_retriever,
    llm=llm,
    prompt=QUERY_PROMPT,
)

retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

class AgentState(TypedDict):
    query: str
    context: List[Document]
    answer: str
    chat_history: list[dict]
    retry_count: int  # 재시도 횟수 추적


graph_builder = StateGraph(AgentState)


# 1번
def retrieve(state: AgentState):
    docs = retriever_multi.invoke(state["query"])
    return {"context": docs}


doc_relevance_prompt = hub.pull("langchain-ai/rag-document-relevance")

# 2번
def check_doc_relevance(state: AgentState) -> Literal["relevant", "irrelevant"]:
    doc_relevance_chain = doc_relevance_prompt | small_llm
    response = doc_relevance_chain.invoke(
        {"question": state["query"], "documents": state["context"]}
    )
    return "relevant" if response["Score"] == 1 else "irrelevant"


generate_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are an assistant for question-answering tasks. 
Use the following pieces of retrieved context to answer the question. 
If you don't know the answer, just say that you don't know. 
Use three sentences maximum and keep the answer concise.
Context: {context}""",
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ]
)

transform_query_prompt = PromptTemplate.from_template(
    """
    당신은 웹 검색을 위한 "검색 질의 최적화 도구"입니다.
    
    목표:
    - 사용자의 질문을 검색 엔진(Google, Bing 등)이 이해하기 쉽도록 최적화된 키워드 중심으로 재작성하라.
    - 특히 세법/법률 관련 질문이므로, 정확한 용어와 문맥이 포함되도록 하라.
    
    규칙:
    1. 불필요한 조사나 어미를 제거하고 핵심 키워드 위주로 구성하라.
    2. 질문의 의도를 명확히 파악하여 검색 효율을 높여라.
    3. 오직 재작성된 검색 질의만 출력하라. (설명 금지)
    
    사용자 질문: {query}
    
    최적화된 검색 질의:"""
)

def web_search(state: AgentState) -> list[Document]:
    transform_chain = transform_query_prompt | small_llm | StrOutputParser()
    optimized_query = transform_chain.invoke({"query": state["query"]})
    
    search = TavilySearch(
        max_results=3,
        include_answer=True,  # 답변 포함 여부
        include_raw_content=False,  # 원본 내용 포함 여부
        include_images=False,  # 이미지 포함 여부
        search_depth="advanced",  # "basic" 또는 "advanced"
        exclude_domains=None,  # 필요하면 제외 도메인 지정 가능
    )

    web_results = search.invoke({"query": optimized_query})

    documents = [
        Document(page_content=r["content"], metadata={"source": r["url"]})
        for r in web_results["results"]
    ]

    return {"context": documents}


# 3번
def generate(state: AgentState):
    rag_chain = generate_prompt | llm
    response = rag_chain.invoke(
        {
            "question": state["query"],
            "context": state["context"],
            "chat_history": state["chat_history"],
        },
        config={"tags": ["final_answer"]},
    )
    return {"answer": response.content}


rewrite_prompt = PromptTemplate.from_template(
    """
너는 대한민국 세법(소득세법) 문서를 검색하기 위한 
" RAG retrieve 검색 질의 생성기" 역할을 한다.

목표:
- 소득세법 문서에서 관련 조문을 가장 잘 찾을 수 있도록
  RAG retrieve 검색에 최적화된 질의로 재작성하라.

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

검색용 질의:"""
)

dictionary = ["사람과 관련된 표현 -> 거주자"]

def rewrite(state: AgentState):
    rewrite_chain = rewrite_prompt | llm | StrOutputParser()
    response = rewrite_chain.invoke({"query": state["query"], "dictionary": dictionary})
    retry_count = state.get("retry_count", 0) + 1
    return {"query": response, "retry_count": retry_count}


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

# 4번
def check_hallucination(
    state: AgentState,
) -> Literal["hallucinated", "not hallucinated", "max_retries"]:
    if state.get("retry_count", 0) > 2:
        return "max_retries"

    context = [doc.page_content for doc in state["context"]]
    hallucination_chain = hallucination_prompt | small_llm | StrOutputParser()
    response = hallucination_chain.invoke(
        {"student_answer": state["answer"], "documents": context},
        config={"tags": ["hallucination_check"]},
    )
    return response


helpfulness_prompt = hub.pull("langchain-ai/rag-answer-helpfulness")

# 6번
def check_helpfulness_grader(state: AgentState) -> Literal["helpful", "unhelpful", "max_retries"]:
    if state.get("retry_count", 0) > 2:
        return "max_retries"
        
    helpfulness_chain = helpfulness_prompt | llm
    response = helpfulness_chain.invoke(
        {"question": state["query"], "student_answer": state["answer"]}
    )
    return "helpful" if response["Score"] == 1 else "unhelpful"

# 5번
def check_helpfulness(state: AgentState):
    return state

# 3번
def fallback_answer(state: AgentState):
    """문서가 관련 없을 때 기본 답변 반환"""
    return {
        "answer": "죄송합니다. 해당 질문에 대한 정보를 찾지 못했습니다. 다른 방식으로 질문해 주시거나, 세무 전문가에게 문의해 주세요."
    }


graph_builder.add_node("retrieve", retrieve)
graph_builder.add_node("generate", generate)
graph_builder.add_node("rewrite", rewrite)
graph_builder.add_node("web_search", web_search)
graph_builder.add_node("check_helpfulness", check_helpfulness)
graph_builder.add_node("fallback_answer", fallback_answer)


graph_builder.add_edge(START, "retrieve")
graph_builder.add_conditional_edges(
    "retrieve",
    check_doc_relevance,
    {"relevant": "generate", "irrelevant": "web_search"},
)
graph_builder.add_edge("web_search", "generate")
graph_builder.add_edge("fallback_answer", END)
graph_builder.add_conditional_edges(
    "generate",
    check_hallucination,
    {
        "not hallucinated": "check_helpfulness",
        "hallucinated": "web_search",
        "max_retries": "fallback_answer",
    },
)

graph_builder.add_conditional_edges(
    "check_helpfulness",
    check_helpfulness_grader,
    {
        "helpful": END,
        "unhelpful": "web_search",
        "max_retries": "fallback_answer",
    },
)
# graph_builder.add_edge("rewrite", "retrieve")


graph = graph_builder.compile()

if __name__ == "__main__":
    with open("graph.png", "wb") as f:
        f.write(graph.get_graph().draw_mermaid_png())
