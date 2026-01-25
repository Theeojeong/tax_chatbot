import React from "react";
import { User, Copy, ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react";
import { Message } from "../lib/types";
import { CodeBlock } from "./CodeBlock";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// OpenAI Logo style SVG for the "Model" avatar
const OpenAILogo = () => (
  <svg
    className="text-green-500 scale-75"
    fill="none"
    height="24"
    viewBox="0 0 41 41"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3938 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.490897 18.3058 0.50019C14.0779 0.528113 10.2657 2.62332 8.05387 6.1672C7.22079 6.45638 6.43094 6.86691 5.70751 7.38665C3.3828 9.05694 1.72808 11.5313 1.04017 14.3164C0.352272 17.1015 0.675006 20.0216 1.9517 22.5833C1.50361 23.9304 1.34842 25.3575 1.49626 26.7691C1.6441 28.1807 2.09121 29.5442 2.80898 30.7686C3.87241 32.6208 5.49673 34.0872 7.4476 34.9563C9.39848 35.8254 11.5751 36.0522 13.6634 35.604C14.6053 36.6655 15.763 37.5135 17.0592 38.0914C18.3554 38.6692 19.76 38.9639 21.1792 38.9546C25.4071 38.9266 29.2193 36.8314 31.4311 33.2875C32.2642 32.9984 33.0541 32.5878 33.7775 32.0681C36.1022 30.3978 37.7569 27.9235 38.4448 25.1384C39.1327 22.3532 38.81 19.4331 37.5324 16.8707ZM22.4978 33.3349C22.4978 34.1362 21.8472 34.7868 21.0459 34.7868C20.2446 34.7868 19.594 34.1362 19.594 33.3349V23.2385C19.594 21.9405 18.6305 20.8645 17.3887 20.6793L8.68113 19.3782C7.94273 19.268 7.42533 18.572 7.53556 17.8336C7.64578 17.0952 8.34182 16.5778 9.08022 16.688L17.7878 17.9891C20.6908 18.4227 22.8462 20.7828 22.4978 23.7259V33.3349ZM10.5968 10.4568C9.90299 9.76302 9.90299 8.63825 10.5968 7.94443C11.2906 7.25062 12.4153 7.25062 13.1091 7.94443L20.2483 15.0836C21.166 16.0013 22.4105 16.5168 23.7081 16.5168H32.5134C33.2604 16.5168 33.8659 17.1224 33.8659 17.8693C33.8659 18.6163 33.2604 19.2218 32.5134 19.2218H23.7081C21.6931 19.2218 19.7608 18.4214 18.336 16.9966L10.5968 10.4568ZM34.7868 23.0317C34.7868 24.0189 33.9866 24.8192 32.9993 24.8192C32.0121 24.8192 31.2118 24.0189 31.2118 23.0317V13.8863C31.2118 12.5883 30.2483 11.5123 29.0065 11.3271L20.299 10.026C19.5606 9.91574 19.0432 9.21971 19.1534 8.48131C19.2636 7.74291 19.9596 7.22551 20.6981 7.33574L29.4056 8.63688C32.3086 9.07044 34.464 11.4305 34.1156 14.3736V23.0317H34.7868Z"
      fill="currentColor"
    ></path>
  </svg>
);

interface MessageItemProps {
  message: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === "user";

  const renderMarkdown = (text: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="whitespace-pre-wrap mb-2">{children}</p>
        ),
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || "");
          if (match) {
            return (
              <CodeBlock
                language={match[1]}
                code={String(children).replace(/\n$/, "")}
              />
            );
          }
          return (
            <code
              className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10"
              {...props}
            >
              {children}
            </code>
          );
        },
        img: ({ src, alt }) => (
          <img
            src={src || ""}
            alt={alt || "Embedded Content"}
            className="max-w-full rounded-lg my-2 border border-white/10"
            loading="lazy"
          />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );

  return (
    <div
      className={`w-full max-w-3xl mx-auto px-4 flex flex-col gap-6 ${isUser ? "items-end" : "items-start"} mb-6`}
    >
      {/* Name Label */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400 font-medium">
          {isUser ? "You" : "세무톡"}
        </span>
        {!isUser && message.isStreaming && (
          <span className="text-[11px] text-green-500 font-medium animate-pulse">
            답변 생성 중...
          </span>
        )}
      </div>

      {/* Bubble / Content */}
      <div
        className={`flex gap-4 ${isUser ? "flex-row-reverse max-w-[90%] md:max-w-[85%]" : "flex-row max-w-full"}`}
      >
        {/* User Avatar (Hidden in provided UI for user, but we render if needed) or Model Icon */}
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            <div
              className={`size-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center ${
                message.isStreaming ? "animate-[spin_3s_linear_infinite]" : ""
              }`}
            >
              <OpenAILogo />
            </div>
          </div>
        )}

        {/* Message Body */}
        <div
          className={`relative ${
            isUser
              ? "bg-primary/90 text-white px-5 py-3.5 rounded-2xl rounded-tr-sm shadow-md break-keep break-words"
              : "text-slate-800 dark:text-gray-200 w-full min-w-0 break-words"
          }`}
        >
          <div className="text-[15px] leading-relaxed">
            {renderMarkdown(message.content)}
          </div>

          {/* Model Actions */}
          {!isUser && !message.isStreaming && (
            <div className="flex items-center gap-3 mt-3">
              <button
                aria-label="Copy response"
                className="text-slate-400 hover:text-slate-700 dark:text-gray-500 dark:hover:text-white transition-colors"
              >
                <Copy size={16} />
              </button>
              <button
                aria-label="Good response"
                className="text-slate-400 hover:text-slate-700 dark:text-gray-500 dark:hover:text-white transition-colors"
              >
                <ThumbsUp size={16} />
              </button>
              <button
                aria-label="Bad response"
                className="text-slate-400 hover:text-slate-700 dark:text-gray-500 dark:hover:text-white transition-colors"
              >
                <ThumbsDown size={16} />
              </button>
              <button
                aria-label="Regenerate"
                className="text-slate-400 hover:text-slate-700 dark:text-gray-500 dark:hover:text-white transition-colors"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
