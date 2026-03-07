"use client";

import { useState } from "react";
import {
  Upload,
  ScanSearch,
  Paintbrush,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface SidebarItem {
  id: string;
  icon: LucideIcon;
  label: string;
  action: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface EditorSidebarProps {
  videoLoaded: boolean;
  isDetecting: boolean;
  onUpload: () => void;
  onDetect: () => void;
  onEditClick: () => void;
}

export function EditorSidebar({
  videoLoaded,
  isDetecting,
  onUpload,
  onDetect,
  onEditClick,
}: EditorSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const items: SidebarItem[] = [
    { id: "upload", icon: Upload, label: "Upload", action: onUpload },
    {
      id: "detect",
      icon: ScanSearch,
      label: "Detect",
      action: onDetect,
      disabled: !videoLoaded,
      loading: isDetecting,
    },
    {
      id: "edit",
      icon: Paintbrush,
      label: "Edit",
      action: onEditClick,
      disabled: !videoLoaded,
    },
    { id: "settings", icon: Settings, label: "Settings", action: () => {} },
  ];

  return (
    <aside className="w-[60px] flex flex-col items-center py-3 gap-1 border-r border-[var(--border-dark)] bg-[#111827]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setActiveId(item.id);
              item.action();
            }}
            disabled={item.disabled}
            aria-label={item.label}
            title={item.label}
            className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 group
              ${isActive ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-white/50 hover:text-white hover:bg-white/5"}
              ${item.disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {item.loading ? (
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon className="w-[18px] h-[18px]" />
            )}
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-white text-[#171717] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {item.label}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
