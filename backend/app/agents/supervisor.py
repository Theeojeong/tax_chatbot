from langgraph.graph import MessagesState
from typing import Literal
from typing_extensions import TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import END
from langgraph.types import Command
from .house import graph as house_tax_agent
from .income import income_tax_agent
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START


class AgentState(MessagesState):

    next: str

router_llm = ChatOpenAI(model="gpt-4o", streaming=False)

members = ["house_tax_agent", "income_tax_agent"]

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
    " respond with FINISH."
)


def supervisor_node(state: AgentState) -> Command[Literal[*members, "__end__"]]:
    """수퍼바이저 노드 함수

    현재 상태를 기반으로 다음 작업자를 결정하고 명령을 반환합니다.

    Args:
        state: 현재 상태 객체

    Returns:
        Command: 다음 작업자로의 전환 명령과 상태 업데이트
    """
    messages = [
        {"role": "system", "content": system_prompt},
    ] + state["messages"]

    response = router_llm.with_structured_output(Router).invoke(messages)
    goto = response["next"]

    # 작업이 완료되면 END로 이동하여 사용자에게 답변 반환
    if goto == "FINISH":
        goto = END

    # Command 객체 반환
    # Command는 그래프의 상태 전이를 제어하는 객체로:
    # - goto: 다음으로 실행할 노드를 지정
    # - update: 현재 상태를 업데이트할 데이터를 지정
    return Command(goto=goto, update={"next": goto})


def house_tax_node(state: AgentState) -> Command[Literal["supervisor"]]:
    """주택분 종합부동산세(종부세) 계산 노드 함수

    주택분 종합부동산세(종부세) 에이전트를 실행하고 결과를 메시지 형태로 변환하여 반환합니다.
    실행이 완료되면 수퍼바이저 노드로 제어를 반환합니다.

    Args:
        state (AgentState): 현재 에이전트의 상태 정보

    Returns:
        Command: 수퍼바이저로의 전환 명령과 종합부동산세 계산 결과 메시지
    """
    # 종합부동산세 에이전트 실행
    result = house_tax_agent.invoke(state)

    # Command 객체 반환:
    # - update: 마지막 메시지를 HumanMessage 형태로 변환하여 상태 업데이트
    # - goto: 다시 수퍼바이저 노드로 제어 반환
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
    # 소득세 에이전트 실행
    result = income_tax_agent.invoke(state)

    # Command 객체 반환:
    # - update: 마지막 메시지를 HumanMessage 형태로 변환하여 상태 업데이트
    # - goto: 다시 수퍼바이저 노드로 제어 반환
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


builder = StateGraph(AgentState)

builder.add_node("supervisor", supervisor_node)
builder.add_node("house_tax_agent", house_tax_node)
builder.add_node("income_tax_agent", income_tax_node)

builder.add_edge(START, "supervisor")

graph = builder.compile()
