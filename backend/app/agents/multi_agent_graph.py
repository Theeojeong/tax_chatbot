from typing import Literal
from typing_extensions import TypedDict

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from .income_tax_graph import graph as income_tax_agent
from .llm import get_llm
from .real_estate_tax_graph import graph as real_estate_tax_agent


class AgentState(TypedDict):
    query: str
    context: list
    answer: str


class Route(BaseModel):
    target: Literal["income_tax", "llm", "real_estate_tax"] = Field(
        description="The target for the query to answer"
    )


router_system_prompt = """
You are an expert at routing a user's question to 'income_tax', 'llm', or 'real_estate_tax'.
'income_tax' contains information about income tax up to December 2024.
'real_estate_tax' contains information about real estate tax up to December 2024.
if you think the question is not related to either 'income_tax' or 'real_estate_tax';
you can route it to 'llm'.
"""

router_prompt = ChatPromptTemplate.from_messages(
    [("system", router_system_prompt), ("user", "{query}")]
)


small_llm = get_llm()
structured_router_llm = small_llm.with_structured_output(Route)


def router(state: AgentState) -> Literal["income_tax", "real_estate_tax", "llm"]:
    route = (router_prompt | structured_router_llm).invoke({"query": state["query"]})
    return route.target


def call_llm(state: AgentState) -> AgentState:
    llm_chain = small_llm | StrOutputParser()
    llm_answer = llm_chain.invoke(state["query"])
    return {"answer": llm_answer}


def build_graph():
    graph_builder = StateGraph(AgentState)

    graph_builder.add_node("income_tax", income_tax_agent)
    graph_builder.add_node("real_estate_tax", real_estate_tax_agent)
    graph_builder.add_node("llm", call_llm)

    graph_builder.add_conditional_edges(
        START,
        router,
        {"income_tax": "income_tax", "real_estate_tax": "real_estate_tax", "llm": "llm"},
    )
    graph_builder.add_edge("income_tax", END)
    graph_builder.add_edge("real_estate_tax", END)
    graph_builder.add_edge("llm", END)

    return graph_builder.compile()


graph = build_graph()
