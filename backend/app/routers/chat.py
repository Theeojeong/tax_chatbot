import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..agents.multi_agent_graph import graph as multi_agent_graph
from ..deps import get_current_user, get_db
from ..models import Conversation, Message, User
from ..schemas import ChatResponse, ConversationCreate, ConversationOut, MessageCreate, MessageOut

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _get_conversation(db: Session, user_id: int, conversation_id: int) -> Conversation:

    conversation = ( # -> 채팅방
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first() # -> 대화는 어차피 1개지만 객체로 받기 위해 추가
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="채팅방을 찾을 수 없습니다."
        )
    return conversation


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return conversations


@router.post("", response_model=ConversationOut)
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = payload.title.strip() if payload.title else "새 대화"
    conversation = Conversation(user_id=current_user.id, title=title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = _get_conversation(db, current_user.id, conversation_id)
    db.delete(conversation)
    db.commit()
    return None


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = _get_conversation(db, current_user.id, conversation_id)
    return conversation.messages


@router.post("/{conversation_id}/messages")
async def create_message(
    conversation_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = _get_conversation(db, current_user.id, conversation_id)

    user_message = Message(
        conversation_id=conversation.id, role="user", content=payload.content
    )
    db.add(user_message)

    if not conversation.title or conversation.title == "새 대화":
        conversation.title = payload.content.strip()[:40]

    conversation.updated_at = datetime.utcnow()
    db.flush()

    all_messages = conversation.messages
    chat_history = []
    
    for msg in all_messages:
        if msg.id != user_message.id:
            chat_history.append({"role": msg.role, "content": msg.content})

    async def event_generator():
        full_answer = ""
        try:
            async for event in multi_agent_graph.astream_events(
                {"query": payload.content, "chat_history": chat_history},
                version="v2"
            ):
                if event["event"] == "on_chat_model_stream":
                    # router의 structured output 제외 (generate, llm 노드의 출력만 포함)
                    tags = event.get("tags", [])
                    name = event.get("name", "")
                    
                    metadata = event.get("metadata", {})
                    if metadata.get("langgraph_node") == "__start__":
                        continue
                    
                    chunk = event["data"]["chunk"].content
                    if chunk:
                        full_answer += chunk
                        yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            
            assistant_message = Message(
                conversation_id=conversation.id, role="assistant", content=full_answer
            )
            db.add(assistant_message)
            conversation.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(conversation)
            db.refresh(user_message)
            db.refresh(assistant_message)
            
            # 완료 이벤트
            yield f"data: {json.dumps({'type': 'done', 'user_message_id': user_message.id, 'assistant_message_id': assistant_message.id, 'conversation_title': conversation.title})}\n\n"
            
        except Exception as e:
            db.rollback()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

