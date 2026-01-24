import os
from dotenv import load_dotenv
from langchain_postgres import PGVector
from langchain_upstage import UpstageEmbeddings
from langchain_core.tools.retriever import create_retriever_tool
from langchain.agents import create_agent

load_dotenv()

embedding = UpstageEmbeddings(model="embedding-passage")

CONNECTION_STRING = os.getenv("CONNECTION_STRING")

index_name = "income-tax-index"  # 인덱스 이름 설정

vectorstore = PGVector(
    embeddings=embedding,  # 임베딩 함수
    connection=CONNECTION_STRING,  # PostgreSQL 연결 문자열
    collection_name=index_name,  # 컬렉션 이름
    distance_strategy="cosine",  # 코사인 유사도 사용
    pre_delete_collection=False,  # 기존 컬렉션 삭제 여부
    use_jsonb=True,  # 메타데이터를 JSONB로 저장 (더 나은 성능과 유연성 제공)
)

retriever = vectorstore.as_retriever()

retriever_tool = create_retriever_tool(
    retriever,
    "search_income_tax_law",
    "2025년 대한민국의 소득세법을 검색한 결과를 반환합니다",
)


income_tax_agent = create_agent(model="gpt-5.1", tools=[retriever_tool])
