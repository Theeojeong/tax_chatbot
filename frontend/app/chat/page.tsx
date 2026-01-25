"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Menu, ChevronDown, ArrowUp, CirclePlus } from "lucide-react";

import { Sidebar } from "../../components/Sidebar";
import { MessageItem } from "../../components/MessageItem";
import { apiFetch } from "../../lib/api";
import { clearAuth } from "../../lib/auth";
import { API_BASE } from "../../lib/config";
import type { Conversation, Message, User } from "../../lib/types";

function sortConversations(list: Conversation[]) {
  return [...list].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export default function ChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initial Data Load
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
        } else {
          // If no conversations, start fresh but don't create one yet until user types
          // Or we could leave activeId null
        }
      } catch (err) {
        clearAuth();
        router.replace("/login");
      }
    };

    bootstrap();
  }, [router]);

  // Load Messages when activeId changes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Reset loading state on switch
    setLoading(false);
    setError(null);

    const loadMessages = async () => {
      try {
        const data = await apiFetch<Message[]>(
          `/conversations/${activeId}/messages`,
        );
        setMessages(data);
      } catch (err: any) {
        // If error loading messages, maybe auth error or network
        console.error(err);
      }
    };

    loadMessages();
  }, [activeId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px"; // Reset to min-height
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleNewConversation = async () => {
    // If we are already on a new empty conversation (no ID), maybe just clear messages?
    // But our logic usually creates a conversation on server immediately or first message.
    // Existing logic created it immediately:
    setError(null);
    try {
      const conversation = await apiFetch<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setConversations((prev) => sortConversations([conversation, ...prev]));
      setActiveId(conversation.id);
      setMessages([]);
      // On mobile, close sidebar after selecting new chat
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) {
      return;
    }

    let conversationId = activeId;
    if (!conversationId) {
      // Create new conversation if none active
      try {
        const conversation = await apiFetch<Conversation>("/conversations", {
          method: "POST",
          body: JSON.stringify({}),
        });
        setConversations((prev) => sortConversations([conversation, ...prev]));
        setActiveId(conversation.id);
        conversationId = conversation.id;
      } catch (err: any) {
        setError(err.message);
        return;
      }
    }

    const content = input.trim();
    setInput("");
    setError(null);

    // Optimistic User Message
    const optimisticUser: Message = {
      id: Date.now(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    // Optimistic Assistant Message (Streaming placeholder)
    const optimisticAssistant: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      isStreaming: true,
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
        },
      );

      if (!response.ok) {
        throw new Error("Failed to send message");
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
                      : m,
                  ),
                );
              } else if (data.type === "done") {
                // Finalize messages with real IDs
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id === optimisticUser.id) {
                      return { ...m, id: data.user_message_id };
                    }
                    if (m.id === optimisticAssistant.id) {
                      return {
                        ...m,
                        id: data.assistant_message_id,
                        isStreaming: false,
                      };
                    }
                    return m;
                  }),
                );

                // Update conversation title if generated
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
                          : c,
                      ),
                    ),
                  );
                }
              } else if (data.type === "error") {
                setError(data.message);
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (err: any) {
      // Rollback on error
      setMessages((prev) =>
        prev.filter(
          (m) => m.id !== optimisticUser.id && m.id !== optimisticAssistant.id,
        ),
      );
      setError(err.message);
    } finally {
      setLoading(false);
      // Ensure streaming flag is off in case of error break
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticAssistant.id ? { ...m, isStreaming: false } : m,
        ),
      );
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
        prev.filter((item) => item.id !== conversationId),
      );
      if (activeId === conversationId) {
        const remaining = conversations.filter(
          (item) => item.id !== conversationId,
        );
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
        setMessages([]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-sans selection:bg-primary/30 selection:text-white">
      {/* Sidebar Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        user={user}
        conversations={conversations}
        activeId={activeId}
        onNewChat={handleNewConversation}
        onSelectConversation={(id) => {
          setActiveId(id);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }}
        onDeleteConversation={handleDeleteConversation}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
          <div className="flex flex-col pb-40 pt-2">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center h-[50vh] opacity-50">
                <div className="size-16 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center mb-4">
                  {/* You could use an SVG logo here */}
                  <svg
                    className="w-10 h-10 text-slate-500 dark:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium text-slate-700 dark:text-gray-200">
                  How can I help you regarding taxes today?
                </p>
              </div>
            ) : (
              messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Footer */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-background-light via-background-light dark:from-background-dark dark:via-background-dark to-transparent pt-10 pb-6 px-4 z-20">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end w-full p-3 bg-white dark:bg-input-dark border border-gray-200 dark:border-white/10 rounded-xl shadow-lg focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all">
              {/* Text Area */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:ring-0 resize-none py-2 max-h-[200px] outline-none"
                placeholder="무엇이든 물어보세요"
                rows={1}
                style={{ minHeight: "24px" }}
              ></textarea>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className={`flex-shrink-0 p-1.5 ml-2 rounded-lg transition-colors group ${
                  input.trim() && !loading
                    ? "bg-primary hover:bg-primary/90 text-white"
                    : "bg-transparent text-slate-300 dark:text-gray-500 cursor-not-allowed"
                }`}
              >
                <ArrowUp size={20} />
              </button>
            </div>

            <div className="text-center mt-2">
              <p className="text-[11px] text-slate-400 dark:text-gray-500">
                세무톡은 실수를 할 수 있습니다. 중요한 정보는 재차 확인하세요.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
