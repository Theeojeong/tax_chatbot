from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import httpx

from ..core.config import GOOGLE_CLIENT_ID
from ..core.security import create_access_token, get_password_hash, verify_password
from ..deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas import GoogleLoginRequest, Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"


# 회원 가입
@router.post("/signup", response_model=Token)
def signup(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="이미 가입한 이메일입니다."
        )

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password), # 회원 가입
        display_name=payload.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    token = create_access_token(str(user.id))
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/google", response_model=Token)
async def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):

    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google login is not configured"
        )
    # Google ID Token 검증
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GOOGLE_TOKEN_INFO_URL,
            params={"id_token": payload.credential}
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

    token_info = response.json()

    # Client ID 검증
    if token_info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client ID"
        )

    google_id = token_info.get("sub")
    email = token_info.get("email")
    name = token_info.get("name", email.split("@")[0])

    # 기존 사용자 확인 (google_id로)
    user = db.query(User).filter(User.google_id == google_id).first()

    if not user:
        # 이메일로 기존 계정 확인 (계정 연동)
        user = db.query(User).filter(User.email == email).first()
        if user:
            # 기존 계정에 Google ID 연동
            user.google_id = google_id
            db.commit()
            db.refresh(user)
        else:
            # 신규 사용자 생성
            user = User(
                email=email,
                display_name=name,
                # hashed_password=get_password_hash(token_urlsafe(32)),
                google_id=google_id,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    token = create_access_token(str(user.id))
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
