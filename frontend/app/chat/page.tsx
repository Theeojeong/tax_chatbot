"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { apiFetch } from "../../lib/api";
import { clearAuth } from "../../lib/auth";
import { API_BASE } from "../../lib/config";
import type {
  ChatResponse,
  Conversation,
  Message,
  User,
} from "../../lib/types";

function sortConversations(list: Conversation[]) {
  return [...list].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export default function ChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuDirection, setMenuDirection] = useState<"up" | "down">("down");
  const [loadingDots, setLoadingDots] = useState("");
  const [showSourceModal, setShowSourceModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const bootstrap = async () => {
      try {
        const me = await apiFetch<User>("/auth/me");
        setUser(me);
        const data = await apiFetch<Conversation[]>("/conversations");
        const sorted = sortConversations(data);
        setConversations(sorted);
        if (sorted.length > 0) {
          setActiveId(sorted[0].id);
        }
      } catch (err) {
        clearAuth();
        router.replace("/login");
      }
    };

    bootstrap();
  }, [router]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    // 대화 전환 시 이전 로딩 상태 초기화
    setLoading(false);
    setError(null);

    const loadMessages = async () => {
      try {
        const data = await apiFetch<Message[]>(
          `/conversations/${activeId}/messages`
        );
        setMessages(data);
      } catch (err: any) {
        setError(err.message);
      }
    };

    loadMessages();
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 로딩 중 점(...) 애니메이션
  useEffect(() => {
    if (!loading) {
      setLoadingDots("");
      return;
    }

    const interval = setInterval(() => {
      setLoadingDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (menuOpenId === null) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        setMenuOpenId(null);
        return;
      }
      if (target.closest(`[data-conversation-menu="${menuOpenId}"]`)) {
        return;
      }
      if (target.closest(`[data-conversation-menu-button="${menuOpenId}"]`)) {
        return;
      }
      setMenuOpenId(null);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpenId]);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId]
  );

  const handleNewConversation = async () => {
    setError(null);
    try {
      const conversation = await apiFetch<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setConversations((prev) => sortConversations([conversation, ...prev]));
      setActiveId(conversation.id);
      setMessages([]);
      return conversation;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) {
      return;
    }

    let conversationId = activeId;
    if (!conversationId) {
      const conversation = await handleNewConversation();
      conversationId = conversation?.id ?? null;
      if (!conversationId) {
        return;
      }
    }

    const content = input.trim();
    setInput("");
    setError(null);

    // 사용자 메시지 (optimistic)
    const optimisticUser: Message = {
      id: Date.now(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    // 어시스턴트 메시지 (스트리밍용)
    const optimisticAssistant: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        throw new Error("요청에 실패했습니다.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "token") {
                assistantContent += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === optimisticAssistant.id
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              } else if (data.type === "done") {
                // 실제 ID로 업데이트
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id === optimisticUser.id) {
                      return { ...m, id: data.user_message_id };
                    }
                    if (m.id === optimisticAssistant.id) {
                      return { ...m, id: data.assistant_message_id };
                    }
                    return m;
                  })
                );
                // 대화 제목 업데이트
                if (data.conversation_title) {
                  setConversations((prev) =>
                    sortConversations(
                      prev.map((c) =>
                        c.id === conversationId
                          ? {
                              ...c,
                              title: data.conversation_title,
                              updated_at: new Date().toISOString(),
                            }
                          : c
                      )
                    )
                  );
                }
              } else if (data.type === "error") {
                setError(data.message);
              }
            } catch (parseError) {
              // JSON 파싱 오류 무시 (불완전한 청크)
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.filter(
          (m) => m.id !== optimisticUser.id && m.id !== optimisticAssistant.id
        )
      );
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleDeleteConversation = async (conversationId: number) => {
    if (!confirm("이 대화를 삭제하시겠습니까?")) {
      return;
    }

    setError(null);
    try {
      await apiFetch(`/conversations/${conversationId}`, {
        method: "DELETE",
      });
      setConversations((prev) =>
        prev.filter((item) => item.id !== conversationId)
      );
      if (activeId === conversationId) {
        const remaining = conversations.filter(
          (item) => item.id !== conversationId
        );
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
        setMessages([]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className={`app-shell ${isSidebarOpen ? "" : "sidebar-closed"}`}>
      <aside className="sidebar">
        {/* 고정된 상단 헤더 영역 */}
        <div className="sidebar-top">
          <div className="sidebar-header">
            <div className="brand">
              <h2>세무톡</h2>
              <span>
                부동산세법과 소득세법에 특화된 AI가 세무 상담을 도와드립니다.
              </span>
            </div>
            <button
              className="close-sidebar-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </div>
          <button className="primary" onClick={handleNewConversation}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>새 채팅</span>
          </button>
        </div>

        {/* 스크롤 영역 (헤더/푸터 높이만큼 패딩 처리됨) */}
        <div className="sidebar-scroll-area">
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-item ${
                  conversation.id === activeId ? "active" : ""
                } ${menuOpenId === conversation.id ? "menu-open" : ""}`}
                onClick={() => setActiveId(conversation.id)}
              >
                <div className="conversation-info">
                  <strong>{conversation.title}</strong>
                  <span>
                    {new Date(conversation.updated_at).toLocaleDateString(
                      "ko-KR"
                    )}
                  </span>
                </div>

                <div className="conversation-actions">
                  <button
                    className="menu-btn"
                    data-conversation-menu-button={conversation.id}
                    onClick={(event) => {
                      if (!isSidebarOpen) return; // 사이드바 닫혀있으면 메뉴 클릭 방지
                      event.stopPropagation();
                      const button = event.currentTarget;
                      const sidebar = button.closest(".sidebar") as HTMLElement;
                      const menuHeight = 50; // 대략적인 메뉴 높이
                      const gap = 6;

                      if (sidebar) {
                        const buttonRect = button.getBoundingClientRect();
                        const sidebarRect = sidebar.getBoundingClientRect();
                        const spaceBelow =
                          sidebarRect.bottom - buttonRect.bottom;
                        const spaceAbove = buttonRect.top - sidebarRect.top;

                        // 아래 공간이 충분하면 아래로, 부족하면 위로
                        if (spaceBelow >= menuHeight + gap) {
                          setMenuDirection("down");
                        } else if (spaceAbove >= menuHeight + gap) {
                          setMenuDirection("up");
                        } else {
                          // 양쪽 모두 부족하면 더 많은 공간이 있는 쪽으로
                          setMenuDirection(
                            spaceBelow > spaceAbove ? "down" : "up"
                          );
                        }
                      }

                      setMenuOpenId((prev) =>
                        prev === conversation.id ? null : conversation.id
                      );
                    }}
                    title="대화 메뉴"
                    aria-haspopup="menu"
                    aria-expanded={menuOpenId === conversation.id}
                    aria-label="대화 메뉴"
                  >
                    <span className="menu-btn-dots">⋯</span>
                  </button>
                  {menuOpenId === conversation.id ? (
                    <div
                      className={`conversation-menu ${
                        menuDirection === "up" ? "menu-up" : "menu-down"
                      }`}
                      data-conversation-menu={conversation.id}
                      role="menu"
                    >
                      <button
                        className="menu-item delete"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuOpenId(null);
                          handleDeleteConversation(conversation.id);
                        }}
                      >
                        대화 삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {conversations.length === 0 ? (
              <div className="conversation-item no-hover">
                {isSidebarOpen ? (
                  <>
                    <strong>아직 대화가 없어요</strong>
                    <span>새 채팅을 눌러 시작하세요.</span>
                  </>
                ) : (
                  <span style={{ fontSize: "0.8rem", opacity: 0.5 }}>...</span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* 고정된 하단 푸터 영역 */}
        <div className="sidebar-bottom">
          <button className="secondary" onClick={handleLogout}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {showSourceModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowSourceModal(false)}
        >
          <div className="source-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>RAG 학습 데이터 출처</h3>
              <button
                className="close-btn"
                onClick={() => setShowSourceModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              <div className="source-item">
                <h4>소득세법</h4>
                <img src="/images/tax_source.png" alt="소득세법 원본" />
                <p>국가법령정보센터 (2024.12 기준)</p>
              </div>
              <div className="source-item">
                <h4>종합부동산세법</h4>
                <img
                  src="/images/realestate_source.png"
                  alt="종합부동산세법 원본"
                />
                <p>국가법령정보센터 (2024.12 기준)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="chat-panel" style={{ position: "relative" }}>
        {/* 메시지 영역 - 경계 없음 */}
        <div className="message-area">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h4>무엇을 도와드릴까요?</h4>
              <p>종합부동산세, 소득세 관련 질문을 해보세요.</p>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <div key={message.id} className={`message-row ${message.role}`}>
                  <div className="message-content">
                    {message.role === "assistant" ? (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="message-row assistant">
                  <div className="message-content">
                    응답을 생성 중입니다{loadingDots}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* 입력 바 - 박스 형태 */}
        <div className="input-wrapper">
          <div className="input-box">
            <textarea
              placeholder="무엇이든 물어보세요"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 150) + "px";
              }}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              ↑
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
          <p className="disclaimer">
            세무톡은 실수를 할 수 있습니다. 정확한 세무 상담은 전문가에게
            문의하세요.{" "}
            <span
              className="source-link"
              onClick={() => setShowSourceModal(true)}
            >
              학습 데이터 출처
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
