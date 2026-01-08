from typing import Literal
from typing_extensions import List, TypedDict

from langchain_classic import hub
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langgraph.graph import END, START, StateGraph

from ..core.config import INCOME_TAX_COLLECTION_DIR
from .llm import get_embeddings, get_llm

embedding_function = get_embeddings()
vector_store = Chroma(
    embedding_function=embedding_function,
    collection_name="income_tax_collection",
    persist_directory=str(INCOME_TAX_COLLECTION_DIR),
)
retriever = vector_store.as_retriever(search_kwargs={"k": 3})


class AgentState(TypedDict):
    query: str
    context: List[Document]
    answer: str
    chat_history: list[dict]


llm = get_llm()

graph_builder = StateGraph(AgentState)


def retrieve(state: AgentState):
    docs = retriever.invoke(state["query"])
    return {"context": docs}


doc_relevance_prompt = hub.pull("langchain-ai/rag-document-relevance")


def check_doc_relevance(state: AgentState) -> Literal["relevant", "irrelevant"]:
    doc_relevance_chain = doc_relevance_prompt | llm
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


dictionary = ["사람과 관련된 표현 -> 거주자"]

rewrite_prompt = PromptTemplate.from_template(
    """
사용자의 질문을 보고, 우리의 사전을 참고해서 사용자의 질문을 변경해주세요
사전: {dictionary}
질문: {query}
"""
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
    hallucination_chain = hallucination_prompt | llm | StrOutputParser()
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
####################################################################
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
####################################################################
graph = graph_builder.compile()

if __name__ == "__main__":
    with open("graph.png", "wb") as f:
        f.write(graph.get_graph().draw_mermaid_png())
