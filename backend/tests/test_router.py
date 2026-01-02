import pytest
from app.agents.multi_agent_graph import router

class TestRouter:
    """Router 함수 테스트 클래스"""

    def test_route_to_income_tax(self):
        """소득세 관련 질문은 income_tax로 라우팅되어야 함"""
        state = {"query": "소득세 계산 방법 알려줘", "context": [], "answer": ""}
        result = router(state)
        assert result == "income_tax"

    def test_route_to_income_tax_with_different_query(self):
        """다양한 소득세 질문 테스트"""
        state = {"query": "연말정산 공제 항목이 뭐야?", "context": [], "answer": ""}
        result = router(state)
        assert result == "income_tax"

    def test_route_to_real_estate_tax(self):
        """부동산세 관련 질문은 real_estate_tax로 라우팅되어야 함"""
        state = {"query": "부동산 취득세는 얼마야?", "context": [], "answer": ""}
        result = router(state)
        assert result == "real_estate_tax"

    def test_route_to_real_estate_tax_with_different_query(self):
        """다양한 부동산세 질문 테스트"""
        state = {"query": "종합부동산세 납부 기한 알려줘", "context": [], "answer": ""}
        result = router(state)
        assert result == "real_estate_tax"

    def test_route_to_llm(self):
        """세금과 무관한 질문은 llm으로 라우팅되어야 함"""
        state = {"query": "오늘 날씨 어때?", "context": [], "answer": ""}
        result = router(state)
        assert result == "llm"

    def test_route_to_llm_with_different_query(self):
        """다양한 일반 질문 테스트"""
        state = {"query": "파이썬으로 웹서버 만드는 법", "context": [], "answer": ""}
        result = router(state)
        assert result == "llm"


# 파라미터화 테스트 - 여러 케이스를 한 번에 테스트
@pytest.mark.parametrize(
    "query,expected",
    [
        ("소득세율이 어떻게 되나요?", "income_tax"),
        ("근로소득세 계산법", "income_tax"),
        ("양도소득세 신고 방법", "income_tax"),
        ("아파트 재산세 납부", "real_estate_tax"),
        ("주택 취득세 감면", "real_estate_tax"),
        ("맛있는 김치찌개 레시피", "llm"),
        ("서울에서 부산까지 거리", "llm"),
    ],
)
def test_router_parametrized(query: str, expected: str):
    """파라미터화된 라우터 테스트"""
    state = {"query": query, "context": [], "answer": ""}
    result = router(state)
    assert result == expected
