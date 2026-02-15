from langgraph.graph import MessagesState, END, StateGraph, START
from langgraph.types import Command

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI

from typing import Literal
from typing_extensions import TypedDict

from .house import graph as house_tax_agent
from .income import income_tax_agent
from .real_estate import real_estate_tax_agent
from .llm import get_llm


class AgentState(MessagesState):

    next: str

router_llm = ChatOpenAI(model="gpt-4o", streaming=False)

members = ["house_tax_agent", "income_tax_agent", "real_estate_tax_agent", "call_llm"]

options = members + ["FINISH"]


class Router(TypedDict):
    """다음 작업자를 결정하는 라우터.
    작업이 필요한 경우 다음 작업자를 지정하고,
    더 이상 작업이 필요하지 않은 경우 FINISH를 반환.
    """

    next: Literal[*options]


system_prompt = (
    "You are a supervisor tasked with managing a conversation between the"
    f" following workers: {members}. Given the following user request,"
    " respond with the worker to act next. Each worker will perform a"
    " task and respond with their results and status. When finished,"
    " respond with FINISH. Never respond with FINISH when the latest"
    " message is from the user. If the user greets, asks for small talk,"
    " or asks general questions unrelated to income or real-estate tax,"
    " choose call_llm."
)


def supervisor_node(state: AgentState) -> Command[Literal[*members, "__end__"]]:
    """수퍼바이저 노드 함수

    현재 상태를 기반으로 다음 작업자를 결정하고 명령을 반환합니다.

    Args:
        state: 현재 상태 객체

    Returns:
        Command: 다음 작업자로의 전환 명령과 상태 업데이트
    """
    if state["messages"] and isinstance(state["messages"][-1], AIMessage):
        return Command(goto=END, update={"next": END})

    messages = [
        SystemMessage(content=system_prompt),
    ] + state["messages"]

    response = router_llm.with_structured_output(Router).invoke(messages)
    goto = response["next"]

    # 작업이 완료되면 END로 이동하여 사용자에게 답변 반환
    if goto == "FINISH":
        goto = END

    return Command(goto=goto, update={"next": goto})


def house_tax_node(state: AgentState) -> Command[Literal["supervisor"]]:
    """주택분 종합부동산세(종부세) 세액 계산 **특화** 노드 함수

    공제액, 공정시장가액비율, 과세표준, 세율을 적용해 **최종 세액**을 계산합니다.
    법령 조항 설명이나 일반 법령 질의는 처리하지 않습니다.
    주택분 종합부동산세(종부세) 에이전트를 실행하고 결과를 메시지 형태로 변환하여 반환합니다.
    실행이 완료되면 수퍼바이저 노드로 제어를 반환합니다.

    Args:
        state (AgentState): 현재 에이전트의 상태 정보

    Returns:
        Command: 수퍼바이저로의 전환 명령과 종합부동산세 계산 결과 메시지
    """
    result = house_tax_agent.invoke(state)

    return Command(
        update={
            "messages": [
                HumanMessage(
                    content=result["messages"][-1].content, name="house_tax_agent"
                )
            ]
        },
        goto="supervisor",
    )


def income_tax_node(state: AgentState) -> Command[Literal["supervisor"]]:
    """소득세 계산 노드 함수

    소득세 에이전트를 실행하고 결과를 메시지 형태로 변환하여 반환합니다.
    실행이 완료되면 수퍼바이저 노드로 제어를 반환합니다.

    Args:
        state (AgentState): 현재 에이전트의 상태 정보

    Returns:
        Command: 수퍼바이저로의 전환 명령과 소득세 계산 결과 메시지
    """
    result = income_tax_agent.invoke(state)

    return Command(
        update={
            "messages": [
                HumanMessage(
                    content=result["messages"][-1].content, name="income_tax_agent"
                )
            ]
        },
        goto="supervisor",
    )


def real_estate_tax_node(state: AgentState) -> Command[Literal["supervisor"]]:
    """종합부동산세(종부세) 계산 노드 함수

    종합부동산세 에이전트를 실행하고 결과를 메시지 형태로 변환하여 반환합니다.
    실행이 완료되면 수퍼바이저 노드로 제어를 반환합니다.

    Args:
        state (AgentState): 현재 에이전트의 상태 정보

    Returns:
        Command: 수퍼바이저로의 전환 명령과 종합소득세 계산 결과 메시지
    """
    result = real_estate_tax_agent.invoke(state)

    return Command(
        update={
            "messages": [
                HumanMessage(
                    content=result["messages"][-1].content, name="real_estate_tax_agent"
                )
            ]
        },
        goto="supervisor",
    )


call_llm_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "너는 소득세법 & 부동산세법 어시스턴트야."),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{query}"),
    ]
)

small_llm = get_llm(small=True)


def call_llm(state: AgentState) -> Command[Literal["supervisor"]]:
    """
    소득세 및 종합부동산세(종부세)와 관계없는 질문에 답변하는 일반 에이전트.
    일반 에이전트를 실행하고 결과를 메시지 형태로 변환하여 반환합니다.
    실행이 완료되면 수퍼바이저 노드로 제어를 반환합니다.
    Args:
        state (AgentState): 현재 에이전트의 상태 정보
    Returns:
        Command: 수퍼바이저로의 전환 명령과 일반 에이전트 답변 메시지
    """
    llm_chain = call_llm_prompt | small_llm | StrOutputParser()
    user_query = ""
    for message in reversed(state["messages"]):
        if isinstance(message, HumanMessage):
            user_query = message.content
            break
    llm_answer = llm_chain.invoke(
        {
            "query": user_query,
            "chat_history": state["messages"],
        }
    )

    return Command(
        update={"messages": [AIMessage(content=llm_answer, name="call_llm")]},
        goto="supervisor",
    )


builder = StateGraph(AgentState)

builder.add_node("supervisor", supervisor_node)
builder.add_node("house_tax_agent", house_tax_node)
builder.add_node("income_tax_agent", income_tax_node)
builder.add_node("real_estate_tax_agent", real_estate_tax_node)
builder.add_node("call_llm", call_llm)

builder.add_edge(START, "supervisor")

graph = builder.compile()
