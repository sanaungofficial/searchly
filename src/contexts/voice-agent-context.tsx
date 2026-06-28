"use client";

import { createContext, useContext, useCallback, useState } from "react";
import {
  useVoiceAgentSession,
  type VoiceChatHistoryEntry,
  type VoiceTranscriptLine,
} from "@/hooks/use-voice-agent-session";
import type { VoiceOrbState } from "@/components/voice/voice-orb";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";
import type { VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import type { AgentSettingsObject } from "@deepgram/agents";

type VoiceSessionResultHandler = (result: {
  summary: string;
  transcript: string;
}) => void;

interface VoiceAgentContextValue {
  available: boolean | null;
  agentSettings: AgentSettingsObject | null;
  orbState: VoiceOrbState;
  error: string | null;
  summary: string | null;
  agentLine: string | null;
  transcriptLines: VoiceTranscriptLine[];
  audioLevel: number;
  sessionActive: boolean;
  selectedPreset: VoicePresetId;
  startSession: () => Promise<void>;
  endSession: () => void;
  resetSession: () => void;
  toggleSession: () => void;
  setSelectedPreset: (id: VoicePresetId) => void;
  setPageHint: (hint: AssistantPageHint | undefined) => void;
  setOnComplete: (handler: VoiceSessionResultHandler | undefined) => void;
  setOnNavigate: (handler: ((route: string, label?: string) => void) | undefined) => void;
  setChatHistory: (history: VoiceChatHistoryEntry[] | undefined) => void;
}

const VoiceAgentContext = createContext<VoiceAgentContextValue | null>(null);

export function useVoiceAgent(): VoiceAgentContextValue {
  const ctx = useContext(VoiceAgentContext);
  if (!ctx) throw new Error("useVoiceAgent must be used within VoiceAgentProvider");
  return ctx;
}

export function useVoiceAgentOptional(): VoiceAgentContextValue | null {
  return useContext(VoiceAgentContext);
}

export function VoiceAgentProvider({ children }: { children: React.ReactNode }) {
  const [pageHint, setPageHint] = useState<AssistantPageHint | undefined>();
  const [selectedPreset, setSelectedPreset] = useState<VoicePresetId>("general");
  const [chatHistory, setChatHistory] = useState<VoiceChatHistoryEntry[] | undefined>();
  const [onCompleteRef, setOnCompleteRef] = useState<VoiceSessionResultHandler | undefined>();
  const [onNavigateRef, setOnNavigateRef] = useState<
    ((route: string, label?: string) => void) | undefined
  >();

  const onComplete = useCallback(
    (result: { summary: string; transcript: string }) => {
      onCompleteRef?.(result);
    },
    [onCompleteRef],
  );

  const onNavigate = useCallback(
    (route: string, label?: string) => {
      onNavigateRef?.(route, label);
    },
    [onNavigateRef],
  );

  const {
    available,
    agentSettings,
    orbState,
    error,
    summary,
    agentLine,
    transcriptLines,
    audioLevel,
    sessionActive,
    startSession,
    endSession,
    resetSession,
    toggleSession,
  } = useVoiceAgentSession({
    context: "workspace",
    voicePresetId: selectedPreset,
    pageHint,
    chatHistory,
    onComplete,
    onNavigate,
  });

  const value: VoiceAgentContextValue = {
    available,
    agentSettings,
    orbState,
    error,
    summary,
    agentLine,
    transcriptLines,
    audioLevel,
    sessionActive,
    selectedPreset,
    startSession,
    endSession,
    resetSession,
    toggleSession,
    setSelectedPreset,
    setPageHint,
    setOnComplete: (handler) => setOnCompleteRef(() => handler),
    setOnNavigate: (handler) => setOnNavigateRef(() => handler),
    setChatHistory,
  };

  return <VoiceAgentContext.Provider value={value}>{children}</VoiceAgentContext.Provider>;
}
