"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../lib/api";
import { clearAuth } from "../../lib/auth";
import type { ChatResponse, Conversation, Message, User } from "../../lib/types";

function sortConversations(list: Conversation[]) {
  return [...list].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
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
      return;
    }

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

    const optimistic: Message = {
      id: Date.now(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setLoading(true);

    try {
      const response = await apiFetch<ChatResponse>(
        `/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content }),
        }
      );
      setMessages((prev) => [
        ...prev.filter((item) => item.id !== optimistic.id),
        response.user_message,
        response.assistant_message,
      ]);
      setConversations((prev) =>
        sortConversations(
          prev.map((item) =>
            item.id === response.conversation.id ? response.conversation : item
          )
        )
      );
      setActiveId(response.conversation.id);
    } catch (err: any) {
      setMessages((prev) => prev.filter((item) => item.id !== optimistic.id));
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
        const remaining = conversations.filter((item) => item.id !== conversationId);
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
        setMessages([]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h2>TaxRoute</h2>
          <span>RouteLLM 멀티 에이전트</span>
        </div>
        <button className="primary" onClick={handleNewConversation}>
          새 대화 시작
        </button>
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
                  {new Date(conversation.updated_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <div className="conversation-actions">
                <button
                  className="menu-btn"
                  data-conversation-menu-button={conversation.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    const button = event.currentTarget;
                    const sidebar = button.closest(".sidebar") as HTMLElement;
                    const menuHeight = 50; // 대략적인 메뉴 높이
                    const gap = 6;
                    
                    if (sidebar) {
                      const buttonRect = button.getBoundingClientRect();
                      const sidebarRect = sidebar.getBoundingClientRect();
                      const spaceBelow = sidebarRect.bottom - buttonRect.bottom;
                      const spaceAbove = buttonRect.top - sidebarRect.top;
                      
                      // 아래 공간이 충분하면 아래로, 부족하면 위로
                      if (spaceBelow >= menuHeight + gap) {
                        setMenuDirection("down");
                      } else if (spaceAbove >= menuHeight + gap) {
                        setMenuDirection("up");
                      } else {
                        // 양쪽 모두 부족하면 더 많은 공간이 있는 쪽으로
                        setMenuDirection(spaceBelow > spaceAbove ? "down" : "up");
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
                    className={`conversation-menu ${menuDirection === "up" ? "menu-up" : "menu-down"}`}
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
            <div className="conversation-item">
              <strong>아직 대화가 없어요</strong>
              <span>새 대화를 눌러 시작하세요.</span>
            </div>
          ) : null}
        </div>
        <button className="secondary" onClick={handleLogout}>
          로그아웃
        </button>
      </aside>

      <main className="main-panel">
        <header className="main-header">
          <div>
            <h3>{activeConversation?.title ?? "새로운 대화"}</h3>
            <div className="meta">
              {user ? `${user.display_name}님 환영합니다` : ""}
            </div>
          </div>
          <div className="meta">세금/부동산/일반 질문을 분기합니다</div>
        </header>

        <section className="chat-window">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h4>멀티 에이전트 준비 완료</h4>
              <p>
                소득세/종부세 질문은 전문 에이전트가, 그 외 질문은 일반
                LLM이 응답합니다.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <div>
                  <div className="role">
                    {message.role === "user" ? "You" : "Agent"}
                  </div>
                </div>
                <div className="bubble">{message.content}</div>
              </div>
            ))
          )}
          {loading ? (
            <div className="message assistant">
              <div>
                <div className="role">Agent</div>
              </div>
              <div className="bubble">응답을 생성 중입니다...</div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </section>

        <section className="composer">
          <textarea
            placeholder="질문을 입력하세요. Shift+Enter로 줄바꿈"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {error ? <p className="error-text">{error}</p> : null}
          <div className="composer-footer">
            <button onClick={handleSend} disabled={loading}>
              {loading ? "답변 생성 중" : "보내기"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
