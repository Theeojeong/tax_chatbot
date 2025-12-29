from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..agents.multi_agent_graph import graph as multi_agent_graph
from ..deps import get_current_user, get_db
from ..models import Conversation, Message, User
from ..schemas import ChatResponse, ConversationCreate, ConversationOut, MessageCreate, MessageOut

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _get_conversation(db: Session, user_id: int, conversation_id: int) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return conversation


@router.get("/", response_model=list[ConversationOut])
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


@router.post("/", response_model=ConversationOut)
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


@router.post("/{conversation_id}/messages", response_model=ChatResponse)
def create_message(
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

    try:
        result = multi_agent_graph.invoke({"query": payload.content})
        answer = result.get("answer") or "답변을 생성하지 못했습니다."
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent error: {exc}",
        ) from exc

    assistant_message = Message(
        conversation_id=conversation.id, role="assistant", content=answer
    )
    db.add(assistant_message)
    conversation.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(conversation)
    db.refresh(user_message)
    db.refresh(assistant_message)

    return ChatResponse(
        conversation=ConversationOut.model_validate(conversation),
        user_message=MessageOut.model_validate(user_message),
        assistant_message=MessageOut.model_validate(assistant_message),
    )
