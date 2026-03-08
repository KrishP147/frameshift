"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Check, X, RotateCcw, Sparkles } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatMessage {
  role: "user" | "assistant";
  message: string;
  timestamp: number;
}

interface AIChatPaneProps {
  projectId: string | null;
  currentFrame: number;
  videoLoaded: boolean;
  chatHistory: ChatMessage[];
  previewFrameUrl: string | null;
  isGenerating: boolean;
  aiEditStatus: "idle" | "preview" | "applying" | "done";
  onSendPrompt: (prompt: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
}

export function AIChatPane({
  projectId,
  currentFrame,
  videoLoaded,
  chatHistory,
  previewFrameUrl,
  isGenerating,
  aiEditStatus,
  onSendPrompt,
  onAccept,
  onReject,
  onRetry,
}: AIChatPaneProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSend = () => {
    if (!input.trim() || isGenerating || !videoLoaded) return;
    onSendPrompt(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="w-[320px] shrink-0 flex flex-col border-l"
      style={{ background: "var(--ed-surface)", borderColor: "var(--ed-border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "var(--ed-border)" }}
      >
        <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--ed-text)" }}>
          AI Edit
        </span>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "var(--ed-subtle)" }}>
              Describe the edit you want to make
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--ed-disabled)" }}>
              e.g., "make the sky more blue"
            </p>
          </div>
        )}

        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                msg.role === "user"
                  ? "rounded-br-sm"
                  : "rounded-bl-sm"
              }`}
              style={{
                background:
                  msg.role === "user"
                    ? "var(--accent)"
                    : "var(--ed-surface-2)",
                color:
                  msg.role === "user"
                    ? "#fff"
                    : "var(--ed-text)",
              }}
            >
              {msg.message}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start">
            <div
              className="rounded-xl rounded-bl-sm px-3 py-2 text-xs"
              style={{
                background: "var(--ed-surface-2)",
                color: "var(--ed-text)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
                />
                Generating...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preview Actions */}
      {aiEditStatus === "preview" && (
        <div
          className="border-t p-3"
          style={{ borderColor: "var(--ed-border)" }}
        >
          <p className="text-xs mb-2 text-center" style={{ color: "var(--ed-subtle)" }}>
            Review the preview in the canvas above
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onAccept}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg, var(--accent), #8B5CF6)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <Check className="w-3.5 h-3.5" />
              Apply to All Frames
            </button>
            <p className="text-[10px] text-center" style={{ color: "var(--ed-disabled)" }}>
              Propagates this edit across the entire video
            </p>
            <div className="flex gap-2">
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border"
              style={{
                background: "transparent",
                color: "var(--ed-text)",
                borderColor: "var(--ed-border)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ed-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
            <button
              onClick={onRetry}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border"
              style={{
                background: "transparent",
                color: "var(--ed-text)",
                borderColor: "var(--ed-border)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ed-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Applying Status */}
      {aiEditStatus === "applying" && (
        <div
          className="border-t p-4"
          style={{ borderColor: "var(--ed-border)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <span className="text-xs" style={{ color: "var(--ed-text)" }}>
              Applying to video...
            </span>
          </div>
        </div>
      )}

      {/* Input */}
      <div
        className="border-t p-3"
        style={{ borderColor: "var(--ed-border)" }}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your edit..."
            disabled={isGenerating || !videoLoaded || aiEditStatus === "applying"}
            className="flex-1 rounded-lg px-3 py-2 text-xs outline-none transition-colors border"
            style={{
              background: "var(--ed-surface-2)",
              color: "var(--ed-text)",
              borderColor: "var(--ed-border)",
              opacity: isGenerating || !videoLoaded || aiEditStatus === "applying" ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating || !videoLoaded || aiEditStatus === "applying"}
            className="rounded-lg p-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              color: "#fff",
            }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {videoLoaded && (
          <p className="text-[10px] mt-1.5" style={{ color: "var(--ed-disabled)" }}>
            Frame {currentFrame + 1}
          </p>
        )}
      </div>
    </div>
  );
}
