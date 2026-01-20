from datetime import date

from langchain_classic import hub
from langchain_chroma import Chroma
from langchain_tavily import TavilySearch
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from ..core.config import REAL_ESTATE_TAX_COLLECTION_DIR
from .llm import get_embeddings, get_llm

llm = get_llm()

class AgentState(TypedDict):
    query: str
    answer: str
    tax_base_equation: str
    tax_deduction: str
    market_ratio: str
    tax_base: str


graph_builder = StateGraph(AgentState)

embedding_function = get_embeddings()

vector_store = Chroma(
    embedding_function=embedding_function,
    collection_name="real_estate",
    persist_directory=str(REAL_ESTATE_TAX_COLLECTION_DIR),
)

retriever = vector_store.as_retriever(search_kwargs={"k": 3})


rag_prompt = hub.pull("rlm/rag-prompt")


tax_base_retrieval_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | rag_prompt
    | llm
    | StrOutputParser()
)

tax_base_equation_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "사용자의 질문에서 과세표준을 계산하는 방법을 수식으로 나타내주세요. 부연설명 없이 수식만 리턴해주세요",
        ),
        ("human", "{tax_base_equation_information}"),
    ]
)


tax_base_equation_chain = (
    {"tax_base_equation_information": RunnablePassthrough()}
    | tax_base_equation_prompt
    | llm
    | StrOutputParser()
)

tax_base_chain = {
    "tax_base_equation_information": tax_base_retrieval_chain
} | tax_base_equation_chain


def get_tax_base_equation(state: AgentState):
    tax_base_equation_question = "주택에 대한 종합부동산세 계산시 과세표준을 계산하는 방법을 수식으로 표현해서 알려주세요"
    tax_base_equation = tax_base_chain.invoke(tax_base_equation_question)
    return {"tax_base_equation": tax_base_equation}


tax_deduction_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | rag_prompt
    | llm
    | StrOutputParser()
)


def get_tax_deduction(state: AgentState):
    tax_deduction_question = "주택에 대한 종합부동산세 계산시 공제금액을 알려주세요"
    tax_deduction = tax_deduction_chain.invoke(tax_deduction_question)
    return {"tax_deduction": tax_deduction}


tavily_search_tool = TavilySearch(
    max_results=5,
    search_depth="advanced",
    include_answer=True,
    include_raw_content=True,
    include_images=True,
)

tax_market_ratio_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "아래 정보를 기반으로 공정시장 가액비율을 계산해주세요\n\nContext:\n{context}",
        ),
        ("human", "{query}"),
    ]
)


def get_market_ratio(state: AgentState):
    query = f"오늘 날짜:({date.today()})에 해당하는 주택 공시가격 공정시장가액비율은 몇 %인가요?"
    context = tavily_search_tool.invoke(query)
    tax_market_ratio_chain = tax_market_ratio_prompt | llm | StrOutputParser()
    market_ratio = tax_market_ratio_chain.invoke({"context": context, "query": query})
    return {"market_ratio": market_ratio}


tax_base_calculation_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
주어진 내용을 기반으로 과세표준을 계산해주세요

과세표준 계산 공식: {tax_base_equation}
공제금액: {tax_deduction}
공정시장가액비율: {market_ratio}""",
        ),
        ("human", "사용자 주택 공시가격 정보: {query}"),
    ]
)


def calculate_tax_base(state: AgentState):
    tax_base_calculation_chain = tax_base_calculation_prompt | llm | StrOutputParser()
    tax_base = tax_base_calculation_chain.invoke(
        {
            "tax_base_equation": state["tax_base_equation"],
            "tax_deduction": state["tax_deduction"],
            "market_ratio": state["market_ratio"],
            "query": state["query"],
        }
    )

    return {"tax_base": tax_base}


tax_rate_calculation_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """당신은 종합부동산세 계산 전문가입니다. 아래 문서를 참고해서 사용자의 질문에 대한 종합부동산세를 계산해주세요

종합부동산세 세율:{context}""",
        ),
        (
            "human",
            """과세표준과 사용자가 소지한 주택의 수가 아래와 같을 때 종합부동산세를 계산해주세요

과세표준: {tax_base}
주택 수:{query}""",
        ),
    ]
)


def calculate_tax_rate(state: AgentState):
    context = retriever.invoke(state["query"])
    tax_rate_chain = tax_rate_calculation_prompt | llm | StrOutputParser()
    tax_rate = tax_rate_chain.invoke(
        {"context": context, "tax_base": state["tax_base"], "query": state["query"]},
        config={"tags": ["final_answer"]},
    )

    return {"answer": tax_rate}


graph_builder.add_node("get_tax_base_equation", get_tax_base_equation)
graph_builder.add_node("get_tax_deduction", get_tax_deduction)
graph_builder.add_node("get_market_ratio", get_market_ratio)
graph_builder.add_node("calculate_tax_base", calculate_tax_base)
graph_builder.add_node("calculate_tax_rate", calculate_tax_rate)

graph_builder.add_edge(START, "get_tax_base_equation")
graph_builder.add_edge(START, "get_tax_deduction")
graph_builder.add_edge(START, "get_market_ratio")
graph_builder.add_edge("get_tax_base_equation", "calculate_tax_base")
graph_builder.add_edge("get_tax_deduction", "calculate_tax_base")
graph_builder.add_edge("get_market_ratio", "calculate_tax_base")
graph_builder.add_edge("calculate_tax_base", "calculate_tax_rate")
graph_builder.add_edge("calculate_tax_rate", END)

graph = graph_builder.compile()
