import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChangeLogEntry {
  id: string;
  projectId: string;
  timestamp: number;
  type: "segment" | "edit" | "refine";
  frameIndex: number;
  data: {
    // For segment
    clickX?: number;
    clickY?: number;
    maskPath?: string;
    
    // For edit
    editType?: string;
    color?: string;
    prompt?: string;
    scale?: number;
    startFrame?: number;
    endFrame?: number;
    
    // For refine
    prompt?: string;
  };
}

interface ChangeLogStore {
  logs: Record<string, ChangeLogEntry[]>; // projectId -> logs
  addLog: (projectId: string, entry: Omit<ChangeLogEntry, "id" | "timestamp">) => void;
  getLogs: (projectId: string) => ChangeLogEntry[];
  clearLogs: (projectId: string) => void;
  removeLog: (projectId: string, logId: string) => void;
}

export const useChangeLogStore = create<ChangeLogStore>()(
  persist(
    (set, get) => ({
      logs: {},
      
      addLog: (projectId, entry) => {
        const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newEntry: ChangeLogEntry = {
          ...entry,
          id,
          timestamp: Date.now(),
        };
        
        set((state) => ({
          logs: {
            ...state.logs,
            [projectId]: [...(state.logs[projectId] || []), newEntry],
          },
        }));
      },
      
      getLogs: (projectId) => {
        return get().logs[projectId] || [];
      },
      
      clearLogs: (projectId) => {
        set((state) => {
          const newLogs = { ...state.logs };
          delete newLogs[projectId];
          return { logs: newLogs };
        });
      },
      
      removeLog: (projectId, logId) => {
        set((state) => ({
          logs: {
            ...state.logs,
            [projectId]: (state.logs[projectId] || []).filter((log) => log.id !== logId),
          },
        }));
      },
    }),
    {
      name: "change-log-storage",
    }
  )
);
