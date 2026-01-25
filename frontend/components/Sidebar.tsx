import React, { useRef, useEffect, useState } from "react";
import {
  Plus,
  MessageSquare,
  MoreHorizontal,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { Do_Hyeon } from "next/font/google";
import { Conversation, User } from "../lib/types";
import { useTheme } from "./ThemeProvider";

const doHyeon = Do_Hyeon({
  subsets: ["latin"],
  weight: "400",
});

interface SidebarProps {
  isOpen: boolean;
  user: User | null;
  conversations: Conversation[];
  activeId: number | null;
  onNewChat: () => void;
  onSelectConversation: (id: number) => void;
  onDeleteConversation: (id: number) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  user,
  conversations,
  activeId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onLogout,
}) => {
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 w-[260px] bg-gray-50 dark:bg-sidebar-dark border-r border-gray-200 dark:border-white/5 flex flex-col transition-transform duration-300 transform 
        ${isOpen ? "translate-x-0" : "-translate-x-full"} 
        md:relative md:translate-x-0
      `}
    >
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-2 text-3xl text-slate-900 dark:text-gray-100 mx-auto md:mx-0 mb-3">
          <span className={doHyeon.className}>세무톡</span>
        </div>
        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 px-3 py-3 text-sm text-slate-700 dark:text-white transition-colors mb-4 group shadow-sm dark:shadow-none"
        >
          <div className="h-4 w-4 rounded-full bg-slate-100 dark:bg-white flex items-center justify-center">
            <Plus
              size={14}
              className="text-slate-600 dark:text-black font-bold"
            />
          </div>
          <span className="font-medium">새 채팅</span>
        </button>

        <div className="flex flex-col gap-2">
          {conversations.length > 0 && (
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
              내 채팅
            </div>
          )}

          {conversations.map((chat) => (
            <div key={chat.id} className="relative group">
              <button
                onClick={() => onSelectConversation(chat.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 transition-colors relative overflow-hidden ${
                  chat.id === activeId
                    ? "bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm dark:shadow-none ring-1 ring-gray-200 dark:ring-0"
                    : "text-slate-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <MessageSquare
                  size={18}
                  className={
                    chat.id === activeId
                      ? "text-primary dark:text-white"
                      : "text-slate-400 dark:text-gray-400 group-hover:text-slate-600 dark:group-hover:text-white"
                  }
                />
                <div className="flex-1 truncate text-sm font-medium relative z-10 text-left pr-8">
                  {chat.title}
                </div>
                {/* Fade effect for text overflow */}
                <div
                  className={`absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent z-20 ${
                    chat.id === activeId
                      ? "from-white dark:from-[#1e293b]"
                      : "from-gray-50 dark:from-sidebar-dark group-hover:from-gray-100 dark:group-hover:from-[#1b242e]"
                  }`}
                ></div>
              </button>

              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(chat.id);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-30"
                title="Delete conversation"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* User Profile / Menu */}
      <div className="p-3 border-t border-gray-200 dark:border-white/5 relative">
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            {/* Menu Header with User Info */}
            <div className="p-3 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                  {user?.display_name?.charAt(0) || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">
                    {user?.display_name || "User"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.email || ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-1">
              {/* Theme Settings Area */}
              <div className="px-2 py-2">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">
                  Theme
                </div>
                <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-lg">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-all ${theme === "light" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
                  >
                    <Sun size={14} />
                    Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-all ${theme === "dark" ? "bg-[#2d3748] text-white shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
                  >
                    <Moon size={14} />
                    Dark
                  </button>
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/10 my-1"></div>

              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors text-left"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </div>
        )}

        <button
          ref={buttonRef}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-700 dark:text-white transition-colors ${isMenuOpen ? "bg-gray-100 dark:bg-white/10" : "hover:bg-gray-100 dark:hover:bg-white/5"}`}
        >
          <div className="size-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
            {user?.display_name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 text-left font-medium truncate">
            {user?.display_name || "User"}
          </div>
          <MoreHorizontal
            size={18}
            className="text-slate-400 dark:text-gray-400"
          />
        </button>
      </div>
    </aside>
  );
};
