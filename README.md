# 세무톡 (Tax Chatbot)

종합부동산세법과 소득세법 데이터를 바탕으로 세무 상담을 제공하는 AI 챗봇 서비스입니다.

## 🚀 주요 기능

- **세무 상담**: RAG(Retrieval-Augmented Generation) 기술을 활용하여 정확한 법령에 기반한 답변 제공
- **대화 관리**: 이전 대화 내용 저장 및 조회 가능
- **멀티/단일 에이전트**: 상황에 맞는 에이전트 라우팅 (RouteLLM 기반)
- **모니터링**: Grafana, Loki를 이용한 로그 및 시스템 모니터링

## 🛠️ 기술 스택

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS (Vanilla CSS 사용)
- **Backend**: Python, FastAPI, LangGraph
- **Infrastructure**: Docker, Docker Compose
- **Monitoring**: Grafana, Loki, Promtail

## 📦 실행 방법

### 전제 조건

- Docker 및 Docker Compose 설치

### 실행

```bash
# 레포지토리 클론
git clone https://github.com/Theeojeong/tax_chatbot.git

# 환경 변수 설정 (.env 파일 생성)
cp .env.example .env

# 서비스 실행
docker-compose up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Grafana: http://localhost:3001

## 📂 프로젝트 구조

```
tax_chatbot/
├── frontend/          # Next.js 프론트엔드
├── backend/           # Python 백엔드 (AI/API)
├── docker-compose.yml # 컨테이너 오케스트레이션
└── ...
```
