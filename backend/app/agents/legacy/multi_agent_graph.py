from typing import Literal
from typing_extensions import TypedDict

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from .income_tax_graph import graph as income_tax_agent
from ..llm import get_llm
from .real_estate_tax_graph import graph as real_estate_tax_agent


class AgentState(TypedDict):
    query: str
    context: list
    answer: str
    chat_history: list[dict]


class Route(BaseModel):
    target: Literal["income_tax", "llm"] = Field(
        description="The target for the query to answer"
    )


router_system_prompt = """
You are an expert at routing a user's question to 'income_tax', 'llm'.
'income_tax' contains information about income tax up to December 2024.
if you think the question is not related to 'income_tax';
you can route it to 'llm'.
"""

router_prompt = ChatPromptTemplate.from_messages(
    [("system", router_system_prompt), ("user", "{query}")]
)


small_llm = get_llm()

structured_router_llm = small_llm.with_structured_output(Route)


def router(state: AgentState) -> Literal["income_tax", "llm"]:
    router_chain = router_prompt | structured_router_llm
    route = router_chain.invoke({"query": state["query"]})

    return route.target


call_llm_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "너는 도움이 되는 어시스턴트야."),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{query}"),
    ]
)

def call_llm(state: AgentState) -> AgentState:
    llm_chain = call_llm_prompt | small_llm | StrOutputParser()
    llm_answer = llm_chain.invoke(
        {
            "query": state["query"],
            "chat_history": state["chat_history"],
        },
        config={"tags": ["final_answer"]},
    )

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
