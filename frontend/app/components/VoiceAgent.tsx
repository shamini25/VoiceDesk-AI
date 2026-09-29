"use client";

import { useCallback, useRef, useState } from "react";

type AgentStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "error";

type TranscriptMessage = {
  id: string;
  speaker: "user" | "agent";
  text: string;
};

type PendingToolResult = {
  call_id: string;
  result: unknown;
};

type ConversationMemory = {
  lastOrderId: string | null;
  lastQuestion: string | null;
  lastKnowledgeTopic: string | null;
  escalationReason: string | null;
  lastIntent: string | null;
  lastOrderStatus: string | null;
  expectedDelivery: string | null;
  currentIssue: string | null;
  resolutionState: "unknown" | "in_progress" | "resolved" | "escalated";
  turnCount: number;
};

type SentimentData = {
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  frustration: "low" | "medium" | "high";
  frustrationScore: number;
  escalationRecommended: boolean;
};

type ToolActivity = {
  name: string;
  label: string;
  icon: string;
  status: "working" | "completed";
};

const SAMPLE_RATE = 24000;

const BACKEND_URL = "http://127.0.0.1:8000";

export default function VoiceAgent() {
  // ==================================================
  // BASIC STATE
  // ==================================================

  const [status, setStatus] =
    useState<AgentStatus>("idle");

  const [transcript, setTranscript] =
    useState<TranscriptMessage[]>([]);

  const [error, setError] =
    useState("");

  // ==================================================
  // SENTIMENT
  // ==================================================

  const [sentiment, setSentiment] =
    useState<SentimentData | null>(null);

  // ==================================================
  // REAL-TIME INTELLIGENCE
  // ==================================================

  const [detectedIntent, setDetectedIntent] =
    useState("Waiting for customer input");

  const [lastCustomerMessage, setLastCustomerMessage] =
    useState("");

  const [toolActivity, setToolActivity] =
    useState<ToolActivity | null>(null);

  const [conversationMemory, setConversationMemory] =
    useState<ConversationMemory>({
      lastOrderId: null,
      lastQuestion: null,
      lastKnowledgeTopic: null,
      escalationReason: null,
      lastIntent: null,
      lastOrderStatus: null,
      expectedDelivery: null,
      currentIssue: null,
      resolutionState: "unknown",
      turnCount: 0,
    });

  // ==================================================
  // AUDIO / WEBSOCKET
  // ==================================================

  const socketRef =
    useRef<WebSocket | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const audioWorkletNodeRef =
    useRef<AudioWorkletNode | null>(null);

  const microphoneSourceRef =
    useRef<MediaStreamAudioSourceNode | null>(null);

  const playbackContextRef =
    useRef<AudioContext | null>(null);

  const playbackCursorRef =
    useRef<number>(0);

  const activeSourcesRef =
    useRef<AudioBufferSourceNode[]>([]);

  const sessionReadyRef =
    useRef(false);

  const sessionIdRef =
    useRef<string | null>(null);

  // ==================================================
  // ANALYTICS SESSION
  // ==================================================

  const analyticsSessionIdRef =
    useRef<string | null>(null);

  const analyticsEndingRef =
    useRef(false);

  // ==================================================
  // TOOL REFERENCES
  // ==================================================

  const pendingToolsRef =
    useRef<PendingToolResult[]>([]);

  const replyDoneRef =
    useRef(false);

  // ==================================================
  // SESSION REFERENCES
  // ==================================================

  const isStoppingRef =
    useRef(false);

  const partialUserTranscriptRef =
    useRef("");

  const partialTranscriptIdRef =
    useRef<string | null>(null);

  // ==================================================
  // CONVERSATION MEMORY
  // ==================================================

  const conversationMemoryRef =
    useRef<ConversationMemory>({
      lastOrderId: null,
      lastQuestion: null,
      lastKnowledgeTopic: null,
      escalationReason: null,
      lastIntent: null,
      lastOrderStatus: null,
      expectedDelivery: null,
      currentIssue: null,
      resolutionState: "unknown",
      turnCount: 0,
    });

  // ==================================================
  // INTENT DETECTION
  // ==================================================

  const detectCustomerIntent =
    useCallback((text: string) => {
      const value = text.toLowerCase();

      if (
        value.includes("order") &&
        (
          value.includes("status") ||
          value.includes("where") ||
          value.includes("track")
        )
      ) {
        return "Order status inquiry";
      }

      if (
        value.includes("order") &&
        (
          value.includes("arrive") ||
          value.includes("delivery") ||
          value.includes("deliver") ||
          value.includes("when")
        )
      ) {
        return "Delivery inquiry";
      }

      if (
        value.includes("return") ||
        value.includes("refund")
      ) {
        return "Returns & refund inquiry";
      }

      if (
        value.includes("shipping") ||
        value.includes("delivery")
      ) {
        return "Shipping & delivery inquiry";
      }

      if (
        value.includes("payment") ||
        value.includes("pay") ||
        value.includes("card")
      ) {
        return "Payment inquiry";
      }

      if (
        value.includes("warranty") ||
        value.includes("guarantee")
      ) {
        return "Warranty inquiry";
      }

      if (
        value.includes("password") ||
        value.includes("account") ||
        value.includes("login")
      ) {
        return "Account support inquiry";
      }

      if (
        value.includes("human") ||
        value.includes("agent") ||
        value.includes("representative") ||
        value.includes("person")
      ) {
        return "Human support request";
      }

      if (
        value.includes("frustrat") ||
        value.includes("angry") ||
        value.includes("upset") ||
        value.includes("annoy")
      ) {
        return "Customer frustration detected";
      }

      return "General customer support";
    }, []);

  // ==================================================
  // ANALYTICS
  // ==================================================

  const createAnalyticsSession =
    useCallback(async () => {
      try {
        console.log(
          "Creating analytics session..."
        );

        const response =
          await fetch(
            `${BACKEND_URL}/api/analytics/session`,
            {
              method: "POST",
            }
          );

        if (!response.ok) {
          throw new Error(
            `Analytics session creation failed: ${response.status}`
          );
        }

        const data =
          await response.json();

        const id =
          data?.session?.session_id;

        if (!id) {
          throw new Error(
            "Analytics session ID was not returned."
          );
        }

        analyticsSessionIdRef.current =
          id;

        analyticsEndingRef.current =
          false;

        console.log(
          "Analytics session created:",
          id
        );

        return id;
      } catch (analyticsError) {
        console.error(
          "Analytics session error:",
          analyticsError
        );

        return null;
      }
    }, []);

  const recordCustomerAnalytics =
    useCallback(
      async (
        text: string,
        sentimentResult: SentimentData
      ) => {
        const sessionId =
          analyticsSessionIdRef.current;

        if (!sessionId) {
          return;
        }

        try {
          const params =
            new URLSearchParams();

          params.set(
            "session_id",
            sessionId
          );

          params.set(
            "text",
            text
          );

          params.set(
            "sentiment",
            sentimentResult.sentiment
          );

          params.set(
            "frustration",
            sentimentResult.frustration
          );

          params.set(
            "frustration_score",
            String(
              sentimentResult.frustrationScore
            )
          );

          params.set(
            "escalation_recommended",
            String(
              sentimentResult.escalationRecommended
            )
          );

          const response =
            await fetch(
              `${BACKEND_URL}/api/analytics/customer-message?${params.toString()}`,
              {
                method: "POST",
              }
            );

          if (!response.ok) {
            throw new Error(
              `Customer analytics failed: ${response.status}`
            );
          }

          console.log(
            "Customer message saved to analytics."
          );
        } catch (analyticsError) {
          console.error(
            "Customer analytics error:",
            analyticsError
          );
        }
      },
      []
    );

  const recordAgentAnalytics =
    useCallback(
      async (text: string) => {
        const sessionId =
          analyticsSessionIdRef.current;

        if (
          !sessionId ||
          !text.trim()
        ) {
          return;
        }

        try {
          const params =
            new URLSearchParams();

          params.set(
            "session_id",
            sessionId
          );

          params.set(
            "text",
            text
          );

          const response =
            await fetch(
              `${BACKEND_URL}/api/analytics/agent-message?${params.toString()}`,
              {
                method: "POST",
              }
            );

          if (!response.ok) {
            throw new Error(
              `Agent analytics failed: ${response.status}`
            );
          }

          console.log(
            "Agent response saved to analytics."
          );
        } catch (analyticsError) {
          console.error(
            "Agent analytics error:",
            analyticsError
          );
        }
      },
      []
    );

  const recordToolAnalytics =
    useCallback(
      async (toolName: string) => {
        const sessionId =
          analyticsSessionIdRef.current;

        if (!sessionId) {
          return;
        }

        try {
          const params =
            new URLSearchParams();

          params.set(
            "session_id",
            sessionId
          );

          params.set(
            "tool_name",
            toolName
          );

          const response =
            await fetch(
              `${BACKEND_URL}/api/analytics/tool?${params.toString()}`,
              {
                method: "POST",
              }
            );

          if (!response.ok) {
            throw new Error(
              `Tool analytics failed: ${response.status}`
            );
          }

          console.log(
            "Tool usage saved:",
            toolName
          );
        } catch (analyticsError) {
          console.error(
            "Tool analytics error:",
            analyticsError
          );
        }
      },
      []
    );

  const recordEscalationAnalytics =
    useCallback(
      async (ticketId: string) => {
        const sessionId =
          analyticsSessionIdRef.current;

        if (
          !sessionId ||
          !ticketId
        ) {
          return;
        }

        try {
          const params =
            new URLSearchParams();

          params.set(
            "session_id",
            sessionId
          );

          params.set(
            "ticket_id",
            ticketId
          );

          const response =
            await fetch(
              `${BACKEND_URL}/api/analytics/escalation?${params.toString()}`,
              {
                method: "POST",
              }
            );

          if (!response.ok) {
            throw new Error(
              `Escalation analytics failed: ${response.status}`
            );
          }

          console.log(
            "Escalation saved to analytics:",
            ticketId
          );
        } catch (analyticsError) {
          console.error(
            "Escalation analytics error:",
            analyticsError
          );
        }
      },
      []
    );

  const saveConversationMemory = useCallback(async () => {
  const sessionId =
    analyticsSessionIdRef.current;

  if (!sessionId) {
    return;
  }

  try {
    const response =
      await fetch(
        `${BACKEND_URL}/api/analytics/session/memory`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            memory: conversationMemoryRef.current,
          }),
        }
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.warn(
        "Conversation memory save failed:",
        response.status,
        errorText
      );

      return;
    }

    const result =
      await response.json();

    console.log(
      "Conversation memory saved successfully:",
      result
    );

  } catch (memoryError) {
    /*
     * Memory persistence must never
     * interrupt the voice conversation
     * or show a Next.js error overlay.
     */
    console.warn(
      "Conversation memory could not be saved:",
      memoryError
    );
  }
}, []);

  const endAnalyticsSession =
    useCallback(async () => {
      const sessionId =
        analyticsSessionIdRef.current;

      if (
        !sessionId ||
        analyticsEndingRef.current
      ) {
        return;
      }

      analyticsEndingRef.current =
        true;

      // Persist the final conversation memory before
      // marking the analytics session as completed.
      await saveConversationMemory();

      try {
        const params =
          new URLSearchParams();

        params.set(
          "session_id",
          sessionId
        );

        const response =
          await fetch(
            `${BACKEND_URL}/api/analytics/session/end?${params.toString()}`,
            {
              method: "POST",
            }
          );

        if (!response.ok) {
          throw new Error(
            `Analytics session end failed: ${response.status}`
          );
        }

        console.log(
          "Analytics session ended:",
          sessionId
        );
      } catch (analyticsError) {
        console.error(
          "Analytics session end error:",
          analyticsError
        );
      } finally {
        analyticsSessionIdRef.current =
          null;
      }
    }, [saveConversationMemory]);

  // ==================================================
  // TRANSCRIPT
  // ==================================================

  const addTranscript =
    useCallback(
      (
        speaker: "user" | "agent",
        text: string
      ) => {
        const cleanText =
          text.trim();

        if (!cleanText) {
          return;
        }

        setTranscript(
          (previous) => [
            ...previous,
            {
              id:
                `${Date.now()}-${Math.random()}`,
              speaker,
              text: cleanText,
            },
          ]
        );
      },
      []
    );

  const updatePartialUserTranscript =
    useCallback(
      (text: string) => {
        const cleanText =
          text.trim();

        if (!cleanText) {
          return;
        }

        if (
          !partialTranscriptIdRef.current
        ) {
          const id =
            `partial-${Date.now()}`;

          partialTranscriptIdRef.current =
            id;

          setTranscript(
            (previous) => [
              ...previous,
              {
                id,
                speaker: "user",
                text: cleanText,
              },
            ]
          );
        } else {
          const id =
            partialTranscriptIdRef.current;

          setTranscript(
            (previous) =>
              previous.map(
                (message) =>
                  message.id === id
                    ? {
                        ...message,
                        text: cleanText,
                      }
                    : message
              )
          );
        }
      },
      []
    );

  // ==================================================
  // SENTIMENT
  // ==================================================

  const runSentimentAnalysis =
    useCallback(
      async (
        text: string
      ): Promise<SentimentData | null> => {
        try {
          if (!text.trim()) {
            return null;
          }

          console.log(
            "Analyzing customer sentiment:",
            text
          );

          const response =
            await fetch(
              `${BACKEND_URL}/api/sentiment?text=${encodeURIComponent(
                text
              )}`
            );

          if (!response.ok) {
            throw new Error(
              `Sentiment analysis failed: ${response.status}`
            );
          }

          const data =
            await response.json();

          if (!data.success) {
            return null;
          }

          const result: SentimentData = {
            sentiment:
              data.sentiment ??
              "neutral",

            sentimentScore:
              Number(
                data.sentiment_score ??
                  0
              ),

            frustration:
              data.frustration ??
              "low",

            frustrationScore:
              Number(
                data.frustration_score ??
                  0
              ),

            escalationRecommended:
              Boolean(
                data.escalation_recommended
              ),
          };

          setSentiment(result);

          console.log(
            "Sentiment result:",
            result
          );

          return result;
        } catch (sentimentError) {
          console.error(
            "Sentiment analysis error:",
            sentimentError
          );

          return null;
        }
      },
      []
    );

  const finalizeUserTranscript =
    useCallback(
      async (text: string) => {
        const cleanText =
          text.trim();

        if (!cleanText) {
          return;
        }

        const detected =
          detectCustomerIntent(cleanText);

        const normalizedText =
          cleanText
            .toLowerCase()
            .replace(/[.!?,]/g, " ")
            .replace(/\\s+/g, " ")
            .trim();

        const closingPhrase =
          normalizedText === "thanks" ||
          normalizedText === "thank you" ||
          normalizedText === "thanks a lot" ||
          normalizedText === "thank you very much" ||
          normalizedText === "that is all" ||
          normalizedText === "that's all" ||
          normalizedText === "thats all" ||
          normalizedText === "no more questions" ||
          normalizedText === "no more" ||
          normalizedText === "goodbye" ||
          normalizedText === "bye" ||
          normalizedText.includes(
            "thank you thats all"
          ) ||
          normalizedText.includes(
            "thank you that is all"
          ) ||
          normalizedText.includes(
            "thanks thats all"
          );

        conversationMemoryRef.current.lastQuestion =
          cleanText;
        const intentKey =
          detected === "Order status inquiry"
            ? "order_status"
            : detected === "Delivery inquiry"
            ? "delivery_inquiry"
            : detected === "Returns & refund inquiry"
            ? "return_refund"
            : detected === "Shipping & delivery inquiry"
            ? "shipping_delivery"
            : detected === "Payment inquiry"
            ? "payment"
            : detected === "Warranty inquiry"
            ? "warranty"
            : detected === "Account support inquiry"
            ? "account_support"
            : detected === "Human support request"
            ? "human_support"
            : detected === "Customer frustration detected"
            ? "frustration"
            : "general_query";

        // Preserve the main conversation intent when the
        // customer gives a short follow-up such as "No",
        // "Okay", "Thanks", or "Bye". These replies should
        // not overwrite a meaningful intent such as order_status.
        const shortFollowUp =
          normalizedText === "no" ||
          normalizedText === "no thanks" ||
          normalizedText === "okay" ||
          normalizedText === "ok" ||
          normalizedText === "thanks" ||
          normalizedText === "thank you" ||
          normalizedText === "thanks a lot" ||
          normalizedText === "thank you very much" ||
          normalizedText === "that's all" ||
          normalizedText === "that is all" ||
          normalizedText === "thats all" ||
          normalizedText === "no more" ||
          normalizedText === "no more questions" ||
          normalizedText === "goodbye" ||
          normalizedText === "bye";

        // A customer may answer an order-status question with only
        // an order number, for example: "Uh, 1003." In that case
        // the generic intent detector correctly sees no new topic,
        // but the conversation intent must remain order_status.
        const containsOrderNumber =
          /\b(?:ord(?:er)?\s*)?\d{4,}\b/i.test(
            normalizedText
          );

        const existingIntent =
          conversationMemoryRef.current.lastIntent;

        // If the customer supplies a numeric order number after
        // asking about an order, explicitly keep the conversation
        // intent as order_status. This also protects against cases
        // where the previous turn was not classified correctly.
        const orderContextActive =
          existingIntent === "order_status" ||
          conversationMemoryRef.current.lastOrderId !== null ||
          /\b(?:where is|status of|track|tracking|order)\b/i.test(
            conversationMemoryRef.current.lastQuestion || ""
          );

        const meaningfulExistingIntent =
          !!existingIntent &&
          existingIntent !== "general_query";

        const preserveExistingIntent =
          meaningfulExistingIntent &&
          (shortFollowUp ||
            containsOrderNumber ||
            normalizedText.length <= 3);

        if (containsOrderNumber && orderContextActive) {
          conversationMemoryRef.current.lastIntent =
            "order_status";
        } else if (!preserveExistingIntent) {
          conversationMemoryRef.current.lastIntent =
            intentKey;
        }
        conversationMemoryRef.current.currentIssue =
          cleanText;
        conversationMemoryRef.current.turnCount += 1;

        if (
          closingPhrase &&
          conversationMemoryRef.current.turnCount > 1 &&
          conversationMemoryRef.current.resolutionState !==
            "escalated"
        ) {
          conversationMemoryRef.current.resolutionState =
            "resolved";
        } else if (
          detected === "Customer frustration detected"
        ) {
          conversationMemoryRef.current.resolutionState =
            "in_progress";
        } else if (
          detected === "Human support request"
        ) {
          conversationMemoryRef.current.resolutionState =
            "escalated";
        } else {
          conversationMemoryRef.current.resolutionState =
            "in_progress";
        }

        setConversationMemory({
          ...conversationMemoryRef.current,
        });

        setLastCustomerMessage(
          cleanText
        );

        const effectiveIntent =
          conversationMemoryRef.current.lastIntent;

        const preservedIntentLabel =
          effectiveIntent === "order_status"
            ? "Order status inquiry"
            : effectiveIntent === "delivery_inquiry"
            ? "Delivery inquiry"
            : effectiveIntent === "return_refund"
            ? "Returns & refund inquiry"
            : effectiveIntent === "shipping_delivery"
            ? "Shipping & delivery inquiry"
            : effectiveIntent === "payment"
            ? "Payment inquiry"
            : effectiveIntent === "warranty"
            ? "Warranty inquiry"
            : effectiveIntent === "account_support"
            ? "Account support inquiry"
            : effectiveIntent === "human_support"
            ? "Human support request"
            : effectiveIntent === "frustration"
            ? "Customer frustration detected"
            : detected;

        setDetectedIntent(
          effectiveIntent === "order_status"
            ? "Order status inquiry"
            : preserveExistingIntent
            ? preservedIntentLabel
            : detected
        );

        const partialId =
          partialTranscriptIdRef.current;

        if (partialId) {
          setTranscript(
            (previous) =>
              previous.map(
                (message) =>
                  message.id === partialId
                    ? {
                        ...message,
                        text: cleanText,
                      }
                    : message
              )
          );
        } else {
          addTranscript(
            "user",
            cleanText
          );
        }

        partialTranscriptIdRef.current =
          null;

        partialUserTranscriptRef.current =
          "";

        const sentimentResult =
          await runSentimentAnalysis(
            cleanText
          );

        if (sentimentResult) {
          await recordCustomerAnalytics(
            cleanText,
            sentimentResult
          );
        }
      },
      [
        addTranscript,
        detectCustomerIntent,
        recordCustomerAnalytics,
        runSentimentAnalysis,
      ]
    );

  // ==================================================
  // AUDIO PLAYBACK
  // ==================================================

  const stopPlayback =
    useCallback(() => {
      for (
        const source of
        activeSourcesRef.current
      ) {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }

        try {
          source.disconnect();
        } catch {
          // Ignore.
        }
      }

      activeSourcesRef.current =
        [];

      if (
        playbackContextRef.current
      ) {
        playbackCursorRef.current =
          playbackContextRef.current.currentTime;
      } else {
        playbackCursorRef.current =
          0;
      }
    }, []);

  const playAudio =
    useCallback(
      (base64Audio: string) => {
        try {
          if (!base64Audio) {
            return;
          }

          let audioContext =
            playbackContextRef.current;

          if (!audioContext) {
            audioContext =
              new AudioContext({
                sampleRate:
                  SAMPLE_RATE,
              });

            playbackContextRef.current =
              audioContext;
          }

          if (
            audioContext.state ===
            "suspended"
          ) {
            void audioContext.resume();
          }

          const binary =
            atob(base64Audio);

          const bytes =
            new Uint8Array(
              binary.length
            );

          for (
            let index = 0;
            index < binary.length;
            index++
          ) {
            bytes[index] =
              binary.charCodeAt(index);
          }

          const pcm =
            new Int16Array(
              bytes.buffer
            );

          const audioBuffer =
            audioContext.createBuffer(
              1,
              pcm.length,
              SAMPLE_RATE
            );

          const channel =
            audioBuffer.getChannelData(
              0
            );

          for (
            let index = 0;
            index < pcm.length;
            index++
          ) {
            channel[index] =
              pcm[index] / 32768;
          }

          const source =
            audioContext.createBufferSource();

          source.buffer =
            audioBuffer;

          source.connect(
            audioContext.destination
          );

          const now =
            audioContext.currentTime;

          if (
            playbackCursorRef.current <
            now
          ) {
            playbackCursorRef.current =
              now;
          }

          const startTime =
            playbackCursorRef.current;

          playbackCursorRef.current +=
            audioBuffer.duration;

          activeSourcesRef.current.push(
            source
          );

          source.onended = () => {
            activeSourcesRef.current =
              activeSourcesRef.current.filter(
                (item) =>
                  item !== source
              );

            try {
              source.disconnect();
            } catch {
              // Ignore.
            }
          };

          source.start(startTime);

          setStatus("speaking");
        } catch (playbackError) {
          console.error(
            "Audio playback error:",
            playbackError
          );
        }
      },
      []
    );

  // ==================================================
  // TOOL RESULT HANDLING
  // ==================================================

  const flushPendingTools =
    useCallback(() => {
      const socket =
        socketRef.current;

      if (
        !socket ||
        socket.readyState !==
          WebSocket.OPEN
      ) {
        return;
      }

      if (
        !replyDoneRef.current
      ) {
        return;
      }

      if (
        pendingToolsRef.current
          .length === 0
      ) {
        return;
      }

      for (
        const tool of
        pendingToolsRef.current
      ) {
        socket.send(
          JSON.stringify({
            type:
              "tool.result",

            call_id:
              tool.call_id,

            result:
              JSON.stringify(
                tool.result
              ),
          })
        );
      }

      pendingToolsRef.current =
        [];

      replyDoneRef.current =
        false;
    }, []);

  // ==================================================
  // TOOL UI HELPERS
  // ==================================================

  const setToolWorking =
    useCallback(
      (
        name: string
      ) => {
        if (
          name ===
          "search_knowledge_base"
        ) {
          setToolActivity({
            name,
            label:
              "Searching knowledge base",
            icon: "🔎",
            status: "working",
          });

          return;
        }

        if (
          name ===
          "get_order_status"
        ) {
          setToolActivity({
            name,
            label:
              "Checking order status",
            icon: "📦",
            status: "working",
          });

          return;
        }

        if (
          name ===
          "request_human_support"
        ) {
          setToolActivity({
            name,
            label:
              "Creating human support request",
            icon: "👨‍💼",
            status: "working",
          });

          return;
        }

        setToolActivity({
          name,
          label: name,
          icon: "🔧",
          status: "working",
        });
      },
      []
    );

  const setToolCompleted =
    useCallback(
      (name: string) => {
        if (
          name ===
          "search_knowledge_base"
        ) {
          setToolActivity({
            name,
            label:
              "Knowledge base search completed",
            icon: "🔎",
            status: "completed",
          });

          return;
        }

        if (
          name ===
          "get_order_status"
        ) {
          setToolActivity({
            name,
            label:
              "Order status retrieved",
            icon: "📦",
            status: "completed",
          });

          return;
        }

        if (
          name ===
          "request_human_support"
        ) {
          setToolActivity({
            name,
            label:
              "Human support request created",
            icon: "👨‍💼",
            status: "completed",
          });

          return;
        }

        setToolActivity({
          name,
          label:
            "Tool completed",
          icon: "🔧",
          status: "completed",
        });
      },
      []
    );

  // ==================================================
  // RAG
  // ==================================================

  const runKnowledgeSearch =
    useCallback(
      async (
        callId: string,
        query: string
      ) => {
        try {
          conversationMemoryRef.current.lastKnowledgeTopic =
            query;
          conversationMemoryRef.current.currentIssue =
            query;
          conversationMemoryRef.current.resolutionState =
            "in_progress";
          setConversationMemory({
            ...conversationMemoryRef.current,
          });

          void recordToolAnalytics(
            "search_knowledge_base"
          );

          const response =
            await fetch(
              `${BACKEND_URL}/api/knowledge-search?q=${encodeURIComponent(
                query
              )}`
            );

          if (!response.ok) {
            throw new Error(
              `Knowledge search failed: ${response.status}`
            );
          }

          const data =
            await response.json();

          pendingToolsRef.current.push({
            call_id: callId,
            result: data,
          });

          setToolCompleted(
            "search_knowledge_base"
          );

          flushPendingTools();
        } catch (searchError) {
          console.error(
            "Knowledge search error:",
            searchError
          );

          pendingToolsRef.current.push({
            call_id: callId,
            result: {
              success: false,
              error:
                "The knowledge base could not be searched.",
            },
          });

          setToolCompleted(
            "search_knowledge_base"
          );

          flushPendingTools();
        }
      },
      [
        flushPendingTools,
        recordToolAnalytics,
        setToolCompleted,
      ]
    );

  // ==================================================
  // ORDER STATUS
  // ==================================================

  const runOrderStatus =
    useCallback(
      async (
        callId: string,
        orderId: string
      ) => {
        try {
          conversationMemoryRef.current.lastOrderId =
            orderId;
          conversationMemoryRef.current.resolutionState =
            "in_progress";
          setConversationMemory({
            ...conversationMemoryRef.current,
          });

          void recordToolAnalytics(
            "get_order_status"
          );

          const response =
            await fetch(
              `${BACKEND_URL}/api/order-status?order_id=${encodeURIComponent(
                orderId
              )}`
            );

          if (!response.ok) {
            throw new Error(
              `Order status request failed: ${response.status}`
            );
          }

          const data =
            await response.json();

          const order =
            data?.order ?? data?.data ?? data;

          if (order && typeof order === "object") {
            const orderRecord = order as Record<string, unknown>;
            conversationMemoryRef.current.lastOrderStatus =
              typeof orderRecord.status === "string"
                ? orderRecord.status
                : typeof orderRecord.order_status === "string"
                ? orderRecord.order_status
                : null;
            conversationMemoryRef.current.expectedDelivery =
              typeof orderRecord.expected_delivery === "string"
                ? orderRecord.expected_delivery
                : typeof orderRecord.expectedDelivery === "string"
                ? orderRecord.expectedDelivery
                : typeof orderRecord.expected_delivery_date === "string"
                ? orderRecord.expected_delivery_date
                : null;

            conversationMemoryRef.current.resolutionState =
              data?.success === false
                ? "in_progress"
                : "in_progress";

            setConversationMemory({
              ...conversationMemoryRef.current,
            });
          }

          pendingToolsRef.current.push({
            call_id: callId,
            result: data,
          });

          setToolCompleted(
            "get_order_status"
          );

          flushPendingTools();
        } catch (orderError) {
          console.error(
            "Order status error:",
            orderError
          );

          pendingToolsRef.current.push({
            call_id: callId,
            result: {
              success: false,
              error:
                "Unable to retrieve the order status.",
            },
          });

          setToolCompleted(
            "get_order_status"
          );

          flushPendingTools();
        }
      },
      [
        flushPendingTools,
        recordToolAnalytics,
        setToolCompleted,
      ]
    );

  // ==================================================
  // HUMAN ESCALATION
  // ==================================================

  const runHumanEscalation =
    useCallback(
      async (
        callId: string,
        reason: string
      ) => {
        try {
          conversationMemoryRef.current.escalationReason =
            reason;
          conversationMemoryRef.current.resolutionState =
            "escalated";
          setConversationMemory({
            ...conversationMemoryRef.current,
          });

          void recordToolAnalytics(
            "request_human_support"
          );

          const response =
            await fetch(
              `${BACKEND_URL}/api/escalate?reason=${encodeURIComponent(
                reason ||
                  "Customer requested human assistance"
              )}`,
              {
                method: "POST",
              }
            );

          if (!response.ok) {
            throw new Error(
              `Escalation request failed: ${response.status}`
            );
          }

          const data =
            await response.json();

          if (
            data?.ticket_id
          ) {
            void recordEscalationAnalytics(
              data.ticket_id
            );
          }

          pendingToolsRef.current.push({
            call_id: callId,
            result: data,
          });

          setToolCompleted(
            "request_human_support"
          );

          flushPendingTools();
        } catch (escalationError) {
          console.error(
            "Human escalation error:",
            escalationError
          );

          pendingToolsRef.current.push({
            call_id: callId,
            result: {
              success: false,
              error:
                "Unable to create the human support request.",
            },
          });

          setToolCompleted(
            "request_human_support"
          );

          flushPendingTools();
        }
      },
      [
        flushPendingTools,
        recordEscalationAnalytics,
        recordToolAnalytics,
        setToolCompleted,
      ]
    );

  // ==================================================
  // CLEANUP
  // ==================================================

  const cleanup =
    useCallback(() => {
      isStoppingRef.current =
        true;

      sessionReadyRef.current =
        false;

      pendingToolsRef.current =
        [];

      replyDoneRef.current =
        false;

      stopPlayback();

      if (
        audioWorkletNodeRef.current
      ) {
        try {
          audioWorkletNodeRef.current.disconnect();
        } catch {
          // Ignore.
        }

        audioWorkletNodeRef.current =
          null;
      }

      if (
        microphoneSourceRef.current
      ) {
        try {
          microphoneSourceRef.current.disconnect();
        } catch {
          // Ignore.
        }

        microphoneSourceRef.current =
          null;
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        streamRef.current =
          null;
      }

      if (
        audioContextRef.current
      ) {
        void audioContextRef.current
          .close()
          .catch(() => {});

        audioContextRef.current =
          null;
      }

      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // Ignore.
        }

        socketRef.current =
          null;
      }

      sessionIdRef.current =
        null;

      isStoppingRef.current =
        false;
    }, [stopPlayback]);

  const stopConversation =
    useCallback(async () => {
      await endAnalyticsSession();

      cleanup();

      setToolActivity(null);

      conversationMemoryRef.current = {
        lastOrderId: null,
        lastQuestion: null,
        lastKnowledgeTopic: null,
        escalationReason: null,
        lastIntent: null,
        lastOrderStatus: null,
        expectedDelivery: null,
        currentIssue: null,
        resolutionState: "unknown",
        turnCount: 0,
      };

      setConversationMemory({
        lastOrderId: null,
        lastQuestion: null,
        lastKnowledgeTopic: null,
        escalationReason: null,
        lastIntent: null,
        lastOrderStatus: null,
        expectedDelivery: null,
        currentIssue: null,
        resolutionState: "unknown",
        turnCount: 0,
      });
      setDetectedIntent(
        "Waiting for customer input"
      );
      setLastCustomerMessage("");

      setStatus("idle");
    }, [
      cleanup,
      endAnalyticsSession,
    ]);

  // ==================================================
  // MICROPHONE
  // ==================================================

  const startMicrophone =
    useCallback(
      async (
        socket: WebSocket
      ) => {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            }
          );

        streamRef.current =
          stream;

        const audioContext =
          new AudioContext({
            sampleRate:
              SAMPLE_RATE,
          });

        audioContextRef.current =
          audioContext;

        if (
          audioContext.state ===
          "suspended"
        ) {
          await audioContext.resume();
        }

        await audioContext.audioWorklet.addModule(
          "/pcm-processor.js"
        );

        const microphoneSource =
          audioContext.createMediaStreamSource(
            stream
          );

        microphoneSourceRef.current =
          microphoneSource;

        const audioWorklet =
          new AudioWorkletNode(
            audioContext,
            "pcm-processor"
          );

        audioWorkletNodeRef.current =
          audioWorklet;

        audioWorklet.port.onmessage =
          (event) => {
            if (
              !sessionReadyRef.current
            ) {
              return;
            }

            if (
              socket.readyState !==
              WebSocket.OPEN
            ) {
              return;
            }

            const buffer =
              event.data as ArrayBuffer;

            const pcm =
              new Uint8Array(
                buffer
              );

            let binary = "";

            const chunkSize =
              0x8000;

            for (
              let index = 0;
              index < pcm.length;
              index += chunkSize
            ) {
              const chunk =
                pcm.subarray(
                  index,
                  Math.min(
                    index +
                      chunkSize,
                    pcm.length
                  )
                );

              binary +=
                String.fromCharCode(
                  ...chunk
                );
            }

            const base64Audio =
              btoa(binary);

            socket.send(
              JSON.stringify({
                type:
                  "input.audio",
                audio:
                  base64Audio,
              })
            );
          };

        microphoneSource.connect(
          audioWorklet
        );

        const silentGain =
          audioContext.createGain();

        silentGain.gain.value =
          0;

        audioWorklet.connect(
          silentGain
        );

        silentGain.connect(
          audioContext.destination
        );
      },
      []
    );

  // ==================================================
  // START CONVERSATION
  // ==================================================

  const startConversation =
    useCallback(async () => {
      try {
        cleanup();

        setError("");
        setTranscript([]);
        setSentiment(null);
        setToolActivity(null);

        setConversationMemory({
          lastOrderId: null,
          lastQuestion: null,
          lastKnowledgeTopic: null,
          escalationReason: null,
          lastIntent: null,
          lastOrderStatus: null,
          expectedDelivery: null,
          currentIssue: null,
          resolutionState: "unknown",
          turnCount: 0,
        });

        setDetectedIntent(
          "Waiting for customer input"
        );

        setLastCustomerMessage("");

        setStatus("connecting");

        conversationMemoryRef.current = {
          lastOrderId: null,
          lastQuestion: null,
          lastKnowledgeTopic: null,
          escalationReason: null,
          lastIntent: null,
          lastOrderStatus: null,
          expectedDelivery: null,
          currentIssue: null,
          resolutionState: "unknown",
          turnCount: 0,
        };

        // ----------------------------------------------
        // CREATE ANALYTICS SESSION
        // ----------------------------------------------

        await createAnalyticsSession();

        // ----------------------------------------------
        // TEMPORARY ASSEMBLYAI TOKEN
        // ----------------------------------------------

        const tokenResponse =
          await fetch(
            `${BACKEND_URL}/api/voice-token`
          );

        if (!tokenResponse.ok) {
          throw new Error(
            "Could not get AssemblyAI voice token."
          );
        }

        const tokenData =
          await tokenResponse.json();

        const token =
          tokenData.token;

        if (!token) {
          throw new Error(
            "AssemblyAI token was not returned."
          );
        }

        // ----------------------------------------------
        // ASSEMBLYAI WEBSOCKET
        // ----------------------------------------------

        const socket =
          new WebSocket(
            `wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(
              token
            )}`
          );

        socketRef.current =
          socket;

        // ----------------------------------------------
        // SOCKET OPEN
        // ----------------------------------------------

        socket.onopen = () => {
          console.log(
            "Connected to AssemblyAI Voice Agent."
          );

          socket.send(
            JSON.stringify({
              type:
                "session.update",

              session: {
                system_prompt: `
You are VoiceDesk AI, a professional customer support voice assistant.

GENERAL BEHAVIOR:

- Listen carefully to the customer.
- Understand the customer's intent.
- Respond naturally and professionally.
- Keep spoken responses concise and easy to understand.
- Never invent company-specific information.
- Do not expose internal tool names, JSON, technical details, or implementation details.

KNOWLEDGE BASE:

- Use the search_knowledge_base tool whenever the customer asks about company-specific support information.
- This includes shipping, delivery, returns, refunds, payments, warranty, account support, and company policies.
- Always use the knowledge base when relevant.
- If the knowledge base does not contain enough information, explain that additional support is required.

ORDER STATUS:

- Use get_order_status whenever the customer asks about a specific order.
- Customers may say "order 1001", "ORD1001", "ORD 1001", or simply "1001".
- If the customer gives a numeric order number, extract the number.
- Never invent an order status or delivery date.
- Remember the order number during the current conversation.
- If the customer says "that order", "my order", or "it", use the previously discussed order when the context is clear.

HUMAN ESCALATION:

- Use request_human_support when the customer explicitly asks to speak with a human, agent, representative, or support executive.
- Also use it when the issue cannot be resolved using the available knowledge base or order information.
- If the customer has not explained why they need human assistance, ask briefly for the reason.
- When the tool returns a ticket ID, tell the customer that the request has been escalated and provide the ticket ID.
- Never invent a ticket ID.

CONVERSATION MEMORY:

- Remember important information from the current conversation.
- Do not ask the customer to repeat information already available.
- Remember previously mentioned order numbers.
- If the customer refers to "that order", "it", or "the same issue", use the relevant conversation context.
- If a reference is ambiguous, ask a short clarification question.
- Memory applies only to the current voice session.
- If an order ID was already discussed, do not ask for it again unless the reference is ambiguous.
- When the customer asks a follow-up such as "when will it arrive?", "what about that order?", or "is it still processing?", resolve the reference using the latest known order context.
- Keep the conversation focused on the customer's current issue and use earlier details to avoid repetition.

CUSTOMER EMOTION:

- Remain calm and professional when the customer is frustrated.
- Do not argue with the customer.
- Acknowledge concerns when appropriate.
- Try to resolve the issue before escalating.
- If the customer explicitly asks for a human agent, follow the escalation instructions.

VOICE STYLE:

- Be friendly, calm, and professional.
- Use natural spoken language.
- Avoid unnecessarily long answers.
- Do not read JSON or raw tool results aloud.
                `.trim(),

                greeting:
                  "Hello! Welcome to VoiceDesk AI. How can I help you today?",

                output: {
                  voice: "anna",
                },

                tools: [
                  {
                    type:
                      "function",

                    name:
                      "search_knowledge_base",

                    description:
                      "Search the VoiceDesk customer support knowledge base for accurate information about shipping, delivery, returns, refunds, payments, warranty, accounts, and other support policies.",

                    parameters: {
                      type:
                        "object",

                      properties: {
                        query: {
                          type:
                            "string",

                          description:
                            "The customer's support question or a concise search query.",
                        },
                      },

                      required: [
                        "query",
                      ],
                    },
                  },

                  {
                    type:
                      "function",

                    name:
                      "get_order_status",

                    description:
                      "Retrieve the current status, expected delivery date, and items for a customer order.",

                    parameters: {
                      type:
                        "object",

                      properties: {
                        order_id: {
                          type:
                            "string",

                          description:
                            "The customer's order number. It may be ORD1001, 1001, ORD 1001, or order 1001.",
                        },
                      },

                      required: [
                        "order_id",
                      ],
                    },
                  },

                  {
                    type:
                      "function",

                    name:
                      "request_human_support",

                    description:
                      "Create a human support escalation request when the customer asks to speak with a human agent or when the issue requires human assistance.",

                    parameters: {
                      type:
                        "object",

                      properties: {
                        reason: {
                          type:
                            "string",

                          description:
                            "A short explanation of why the customer needs human support.",
                        },
                      },

                      required: [
                        "reason",
                      ],
                    },
                  },
                ],
              },
            })
          );
        };

        // ----------------------------------------------
        // SOCKET MESSAGE
        // ----------------------------------------------

        socket.onmessage = async (
          event
        ) => {
          try {
            const message =
              JSON.parse(
                event.data
              );

            console.log(
              "AssemblyAI event:",
              message
            );

            switch (
              message.type
            ) {
              // ----------------------------------------
              // SESSION READY
              // ----------------------------------------

              case "session.ready": {
                sessionReadyRef.current =
                  true;

                sessionIdRef.current =
                  message.session_id ??
                  null;

                console.log(
                  "Voice session ready:",
                  message.session_id
                );

                await startMicrophone(
                  socket
                );

                if (
                  !isStoppingRef.current
                ) {
                  setStatus(
                    "listening"
                  );
                }

                break;
              }

              // ----------------------------------------
              // SESSION UPDATED
              // ----------------------------------------

              case "session.updated": {
                console.log(
                  "Voice session updated."
                );

                break;
              }

              // ----------------------------------------
              // SPEECH STARTED
              // ----------------------------------------

              case "input.speech.started": {
                stopPlayback();

                setStatus(
                  "listening"
                );

                break;
              }

              // ----------------------------------------
              // SPEECH STOPPED
              // ----------------------------------------

              case "input.speech.stopped": {
                break;
              }

              // ----------------------------------------
              // USER DELTA
              // ----------------------------------------

              case "transcript.user.delta": {
                if (
                  message.text
                ) {
                  partialUserTranscriptRef.current =
                    message.text;

                  updatePartialUserTranscript(
                    message.text
                  );
                }

                break;
              }

              // ----------------------------------------
              // FINAL USER TRANSCRIPT
              // ----------------------------------------

              case "transcript.user": {
                if (
                  message.text
                ) {
                  void finalizeUserTranscript(
                    message.text
                  );
                }

                break;
              }

              // ----------------------------------------
              // REPLY STARTED
              // ----------------------------------------

              case "reply.started": {
                setStatus(
                  "speaking"
                );

                break;
              }

              // ----------------------------------------
              // REPLY AUDIO
              // ----------------------------------------

              case "reply.audio": {
                if (
                  message.data
                ) {
                  playAudio(
                    message.data
                  );
                }

                break;
              }

              // ----------------------------------------
              // AGENT TRANSCRIPT
              // ----------------------------------------

              case "transcript.agent": {
                if (
                  message.text
                ) {
                  addTranscript(
                    "agent",
                    message.text
                  );

                  void recordAgentAnalytics(
                    message.text
                  );
                }

                break;
              }

              // ----------------------------------------
              // TOOL CALL
              // ----------------------------------------

              case "tool.call": {
                console.log(
                  "Tool call:",
                  message
                );

                const argumentsData =
                  message.arguments ??
                  {};

                setToolWorking(
                  message.name
                );

                if (
                  message.name ===
                  "search_knowledge_base"
                ) {
                  const query =
                    typeof argumentsData.query ===
                    "string"
                      ? argumentsData.query
                      : "";

                  if (!query) {
                    pendingToolsRef.current.push({
                      call_id:
                        message.call_id,

                      result: {
                        success:
                          false,

                        error:
                          "No search query was provided.",
                      },
                    });

                    flushPendingTools();

                    break;
                  }

                  void runKnowledgeSearch(
                    message.call_id,
                    query
                  );

                  break;
                }

                if (
                  message.name ===
                  "get_order_status"
                ) {
                  const orderId =
                    typeof argumentsData.order_id ===
                    "string"
                      ? argumentsData.order_id
                      : "";

                  if (!orderId) {
                    pendingToolsRef.current.push({
                      call_id:
                        message.call_id,

                      result: {
                        success:
                          false,

                        error:
                          "No order ID was provided.",
                      },
                    });

                    flushPendingTools();

                    break;
                  }

                  void runOrderStatus(
                    message.call_id,
                    orderId
                  );

                  break;
                }

                if (
                  message.name ===
                  "request_human_support"
                ) {
                  const reason =
                    typeof argumentsData.reason ===
                    "string"
                      ? argumentsData.reason
                      : "Customer requested human assistance";

                  void runHumanEscalation(
                    message.call_id,
                    reason
                  );

                  break;
                }

                console.warn(
                  "Unknown tool:",
                  message.name
                );

                break;
              }

              // ----------------------------------------
              // REPLY DONE
              // ----------------------------------------

              case "reply.done": {
                if (
                  message.status ===
                  "interrupted"
                ) {
                  stopPlayback();

                  pendingToolsRef.current =
                    [];

                  replyDoneRef.current =
                    false;

                  setStatus(
                    "listening"
                  );

                  break;
                }

                replyDoneRef.current =
                  true;

                flushPendingTools();

                if (
                  pendingToolsRef.current
                    .length === 0
                ) {
                  setStatus(
                    "listening"
                  );
                }

                break;
              }

              // ----------------------------------------
              // SESSION ERROR
              // ----------------------------------------

              case "session.error": {
                console.error(
                  "AssemblyAI session error:",
                  message
                );

                const errorMessage =
                  message.message ||
                  message.error ||
                  "Voice session error.";

                setError(
                  errorMessage
                );

                setStatus(
                  "error"
                );

                break;
              }

              // ----------------------------------------
              // SESSION ENDED
              // ----------------------------------------

              case "session.ended": {
                console.log(
                  "AssemblyAI session ended."
                );

                await endAnalyticsSession();

                cleanup();

                setStatus(
                  "idle"
                );

                break;
              }

              default: {
                console.log(
                  "Unhandled AssemblyAI event:",
                  message.type
                );

                break;
              }
            }
          } catch (
            messageError
          ) {
            console.error(
              "Message handling error:",
              messageError
            );
          }
        };

        // ----------------------------------------------
        // SOCKET ERROR
        // ----------------------------------------------

        socket.onerror = (
          event
        ) => {
          console.error(
            "AssemblyAI WebSocket error:",
            event
          );

          setError(
            "Could not connect to VoiceDesk AI."
          );

          setStatus(
            "error"
          );
        };

        // ----------------------------------------------
        // SOCKET CLOSE
        // ----------------------------------------------

        socket.onclose = (
          event
        ) => {
          console.log(
            "AssemblyAI WebSocket closed:",
            event.code,
            event.reason
          );

          sessionReadyRef.current =
            false;
        };
      } catch (startError) {
        console.error(
          "Voice agent start error:",
          startError
        );

        const message =
          startError instanceof Error
            ? startError.message
            : "Something went wrong while starting VoiceDesk AI.";

        setError(message);

        await endAnalyticsSession();

        cleanup();

        setStatus(
          "error"
        );
      }
    }, [
      addTranscript,
      cleanup,
      createAnalyticsSession,
      endAnalyticsSession,
      finalizeUserTranscript,
      flushPendingTools,
      playAudio,
      recordAgentAnalytics,
      runHumanEscalation,
      runKnowledgeSearch,
      runOrderStatus,
      setToolWorking,
      startMicrophone,
      stopPlayback,
      updatePartialUserTranscript,
    ]);

  // ==================================================
  // MICROPHONE BUTTON
  // ==================================================

  const handleMicrophone =
    () => {
      if (
        status === "idle" ||
        status === "error"
      ) {
        void startConversation();
      } else {
        void stopConversation();
      }
    };

  // ==================================================
  // STATUS
  // ==================================================

  const getStatusText =
    () => {
      switch (status) {
        case "connecting":
          return "Connecting...";

        case "listening":
          return "Listening...";

        case "speaking":
          return "VoiceDesk is responding...";

        case "error":
          return "Connection error";

        default:
          return "Start conversation";
      }
    };

  const getStatusDescription =
    () => {
      switch (status) {
        case "connecting":
          return "Connecting securely to VoiceDesk AI...";

        case "listening":
          return "VoiceDesk is listening to you";

        case "speaking":
          return "VoiceDesk is responding...";

        case "error":
          return error;

        default:
          return "Click the microphone to begin";
      }
    };

  // ==================================================
  // SENTIMENT UI
  // ==================================================

  const getSentimentLabel =
    () => {
      if (!sentiment) {
        return "Waiting";
      }

      if (
        sentiment.sentiment ===
        "positive"
      ) {
        return "Positive";
      }

      if (
        sentiment.sentiment ===
        "negative"
      ) {
        return "Negative";
      }

      return "Neutral";
    };

  const getSentimentIcon =
    () => {
      if (!sentiment) {
        return "—";
      }

      if (
        sentiment.sentiment ===
        "positive"
      ) {
        return "😊";
      }

      if (
        sentiment.sentiment ===
        "negative"
      ) {
        return "😟";
      }

      return "😐";
    };

  const getFrustrationLabel =
    () => {
      if (!sentiment) {
        return "Waiting";
      }

      return (
        sentiment.frustration
          .charAt(0)
          .toUpperCase() +
        sentiment.frustration.slice(1)
      );
    };

  // ==================================================
  // UI
  // ==================================================

  return (
    <div className="w-full">

      {/* ============================================
          VOICE CONTROL
      ============================================ */}

      <div className="flex flex-col items-center justify-center py-12">

        <button
          type="button"
          onClick={
            handleMicrophone
          }
          disabled={
            status ===
            "connecting"
          }
          aria-label={
            status === "idle" ||
            status === "error"
              ? "Start voice conversation"
              : "End voice conversation"
          }
          className={`relative flex h-44 w-44 items-center justify-center rounded-full border transition-all duration-500 ${
            status === "listening"
              ? "border-cyan-300 bg-cyan-400/20 shadow-[0_0_80px_rgba(34,211,238,0.35)]"
              : status ===
                "speaking"
              ? "border-purple-300 bg-purple-400/20 shadow-[0_0_80px_rgba(168,85,247,0.35)]"
              : status ===
                "connecting"
              ? "border-yellow-300 bg-yellow-400/10"
              : status ===
                "error"
              ? "border-red-400/40 bg-red-400/10"
              : "border-cyan-400/30 bg-cyan-400/10 hover:bg-cyan-400/20"
          }`}
        >
          <div
            className={`absolute h-32 w-32 rounded-full bg-cyan-400/10 ${
              status === "listening" ||
              status === "speaking"
                ? "animate-pulse"
                : ""
            }`}
          />

          <span className="relative text-5xl">
            🎙️
          </span>
        </button>

        <h3 className="mt-8 text-lg font-medium">
          {getStatusText()}
        </h3>

        <p className="mt-2 text-center text-sm text-slate-500">
          {getStatusDescription()}
        </p>

        {status !== "idle" &&
          status !==
            "connecting" && (
            <button
              type="button"
              onClick={() =>
                void stopConversation()
              }
              className="mt-6 rounded-full border border-red-400/20 bg-red-400/10 px-5 py-2 text-sm text-red-300 transition hover:bg-red-400/20"
            >
              End conversation
            </button>
          )}
      </div>

      {/* ============================================
          STATUS CARDS
      ============================================ */}

      <div className="grid grid-cols-3 gap-3">

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
          <p className="text-xs text-slate-500">
            Speech
          </p>

          <p
            className={`mt-1 text-sm font-medium ${
              status ===
              "listening"
                ? "text-cyan-300"
                : "text-slate-400"
            }`}
          >
            {status ===
            "listening"
              ? "Listening"
              : "Ready"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
          <p className="text-xs text-slate-500">
            AI
          </p>

          <p
            className={`mt-1 text-sm font-medium ${
              status ===
                "listening" ||
              status ===
                "speaking"
                ? "text-emerald-300"
                : "text-slate-400"
            }`}
          >
            {status ===
                "listening" ||
              status ===
                "speaking"
              ? "Online"
              : "Ready"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
          <p className="text-xs text-slate-500">
            RAG
          </p>

          <p
            className={`mt-1 text-sm font-medium ${
              status ===
                "listening" ||
              status ===
                "speaking"
                ? "text-purple-300"
                : "text-slate-400"
            }`}
          >
            Knowledge Ready
          </p>
        </div>

      </div>

      {/* ============================================
          REAL-TIME AI UNDERSTANDING
      ============================================ */}

      <div className="mt-6 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">

        <div className="mb-5 flex items-center justify-between">

          <div>
            <h3 className="text-sm font-medium text-slate-300">
              AI Understanding
            </h3>

            <p className="mt-1 text-xs text-slate-600">
              Real-time customer intent detection
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status === "listening" ||
                status === "speaking"
                  ? "animate-pulse bg-cyan-400"
                  : "bg-slate-600"
              }`}
            />

            <span className="text-xs text-slate-500">
              {status === "listening" ||
              status === "speaking"
                ? "Live"
                : "Standby"}
            </span>
          </div>

        </div>

        <div className="grid gap-3 md:grid-cols-2">

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">

            <p className="text-xs text-slate-500">
              Detected Intent
            </p>

            <div className="mt-2 flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-lg">
                🧠
              </div>

              <p className="text-sm font-semibold text-cyan-300">
                {detectedIntent}
              </p>

            </div>

          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">

            <p className="text-xs text-slate-500">
              Conversation Context
            </p>

            <div className="mt-2">

              {conversationMemory.lastOrderId ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-purple-300">
                    📦 Order {conversationMemory.lastOrderId}
                  </p>
                  {conversationMemory.lastOrderStatus && (
                    <p className="text-xs text-slate-400">
                      Status: {conversationMemory.lastOrderStatus}
                    </p>
                  )}
                  {conversationMemory.expectedDelivery && (
                    <p className="text-xs text-slate-400">
                      Expected: {conversationMemory.expectedDelivery}
                    </p>
                  )}
                </div>
              ) : conversationMemory.lastKnowledgeTopic ? (
                <p className="text-sm font-semibold text-purple-300">
                  📚 {conversationMemory.lastKnowledgeTopic}
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  No active context detected
                </p>
              )}

            </div>

          </div>

        </div>

        {lastCustomerMessage && (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">

            <p className="text-xs text-slate-500">
              Latest Customer Input
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              "{lastCustomerMessage}"
            </p>

          </div>
        )}

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-600">
              Conversation Turn
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-300">
              {conversationMemory.turnCount}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-600">
              Resolution State
            </p>
            <p className={`mt-1 text-sm font-semibold ${
              conversationMemory.resolutionState === "escalated"
                ? "text-red-300"
                : conversationMemory.resolutionState === "resolved"
                ? "text-emerald-300"
                : "text-cyan-300"
            }`}>
              {conversationMemory.resolutionState === "in_progress"
                ? "In progress"
                : conversationMemory.resolutionState === "escalated"
                ? "Escalated"
                : conversationMemory.resolutionState === "resolved"
                ? "Resolved"
                : "Waiting"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-600">
              Active Issue
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-300">
              {conversationMemory.currentIssue || "None detected"}
            </p>
          </div>
        </div>

      </div>

      {/* ============================================
          TOOL ACTIVITY
      ============================================ */}

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">

        <div className="mb-4 flex items-center justify-between">

          <div>
            <h3 className="text-sm font-medium text-slate-300">
              Agent Tool Activity
            </h3>

            <p className="mt-1 text-xs text-slate-600">
              Live actions performed by VoiceDesk AI
            </p>
          </div>

          <span className="text-xs text-slate-600">
            {toolActivity
              ? toolActivity.status ===
                "working"
                ? "Processing"
                : "Completed"
              : "No activity"}
          </span>

        </div>

        {toolActivity ? (

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-xl">
                {toolActivity.icon}
              </div>

              <div>
                <p className="text-sm font-medium text-slate-300">
                  {toolActivity.label}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  {toolActivity.name}
                </p>
              </div>

            </div>

            <div className="flex items-center gap-2">

              {toolActivity.status ===
              "working" ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />

                  <span className="text-xs text-yellow-300">
                    Working
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />

                  <span className="text-xs text-emerald-300">
                    Done
                  </span>
                </>
              )}

            </div>

          </div>

        ) : (

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">

            <p className="text-xs text-slate-600">
              Tool activity will appear when VoiceDesk AI performs an action.
            </p>

          </div>

        )}

      </div>

      {/* ============================================
          LIVE CUSTOMER ANALYSIS
      ============================================ */}

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">

        <div className="mb-5 flex items-center justify-between">

          <div>
            <h3 className="text-sm font-medium text-slate-300">
              Live Customer Analysis
            </h3>

            <p className="mt-1 text-xs text-slate-600">
              Real-time sentiment & frustration
            </p>
          </div>

          <div className="flex items-center gap-2">

            <span
              className={`h-2 w-2 rounded-full ${
                sentiment
                  ? "animate-pulse bg-emerald-400"
                  : "bg-slate-600"
              }`}
            />

            <span className="text-xs text-slate-500">
              {sentiment
                ? "Analyzed"
                : "Waiting"}
            </span>

          </div>

        </div>

        <div className="grid grid-cols-2 gap-3">

          {/* SENTIMENT */}

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">

            <p className="text-xs text-slate-500">
              Sentiment
            </p>

            <div className="mt-2 flex items-center gap-2">

              <span className="text-xl">
                {getSentimentIcon()}
              </span>

              <span
                className={`text-sm font-semibold ${
                  sentiment?.sentiment ===
                  "positive"
                    ? "text-emerald-300"
                    : sentiment?.sentiment ===
                      "negative"
                    ? "text-red-300"
                    : "text-slate-300"
                }`}
              >
                {getSentimentLabel()}
              </span>

            </div>

          </div>

          {/* FRUSTRATION */}

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">

            <p className="text-xs text-slate-500">
              Frustration
            </p>

            <div className="mt-2">

              <span
                className={`text-sm font-semibold ${
                  sentiment?.frustration ===
                  "high"
                    ? "text-red-300"
                    : sentiment?.frustration ===
                      "medium"
                    ? "text-yellow-300"
                    : "text-emerald-300"
                }`}
              >
                {getFrustrationLabel()}
              </span>

            </div>

          </div>

        </div>

        {/* SCORE */}

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">

          <div className="flex items-center justify-between">

            <p className="text-xs text-slate-500">
              Frustration Score
            </p>

            <p className="text-sm font-semibold text-slate-300">
              {sentiment
                ? `${sentiment.frustrationScore} / 100`
                : "—"}
            </p>

          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">

            <div
              className={`h-full rounded-full transition-all duration-700 ${
                sentiment?.frustration ===
                "high"
                  ? "bg-red-400"
                  : sentiment?.frustration ===
                    "medium"
                  ? "bg-yellow-400"
                  : "bg-emerald-400"
              }`}
              style={{
                width: `${
                  sentiment?.frustrationScore ??
                  0
                }%`,
              }}
            />

          </div>

        </div>

        {/* ESCALATION */}

        {sentiment?.escalationRecommended && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4">

            <span className="text-xl">
              ⚠️
            </span>

            <div>

              <p className="text-sm font-semibold text-red-300">
                Escalation Recommended
              </p>

              <p className="mt-1 text-xs text-red-200/60">
                Customer frustration requires additional attention.
              </p>

            </div>

          </div>
        )}

        {!sentiment && (
          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">

            <p className="text-xs text-slate-600">
              Customer sentiment will appear after the first spoken message.
            </p>

          </div>
        )}

      </div>

      {/* ============================================
          LIVE TRANSCRIPT
      ============================================ */}

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">

        <div className="mb-4 flex items-center justify-between">

          <h3 className="text-sm font-medium text-slate-300">
            Live Transcript
          </h3>

          <span
            className={`h-2 w-2 rounded-full ${
              status ===
              "listening"
                ? "bg-emerald-400"
                : status ===
                  "speaking"
                ? "bg-purple-400"
                : status ===
                  "connecting"
                ? "bg-yellow-400"
                : "bg-slate-600"
            }`}
          />

        </div>

        <div className="max-h-56 space-y-3 overflow-y-auto">

          {transcript.length ===
          0 ? (

            <p className="text-sm text-slate-600">
              Your conversation transcript will appear here...
            </p>

          ) : (

            transcript.map(
              (message) => (

                <div
                  key={
                    message.id
                  }
                  className={`rounded-xl border p-3 ${
                    message.speaker ===
                    "user"
                      ? "border-cyan-400/10 bg-cyan-400/5"
                      : "border-purple-400/10 bg-purple-400/5"
                  }`}
                >

                  <p
                    className={`mb-1 text-xs font-medium ${
                      message.speaker ===
                      "user"
                        ? "text-cyan-300"
                        : "text-purple-300"
                    }`}
                  >
                    {message.speaker ===
                    "user"
                      ? "You"
                      : "VoiceDesk"}
                  </p>

                  <p className="text-sm leading-6 text-slate-300">
                    {message.text}
                  </p>

                </div>

              )
            )

          )}

        </div>

      </div>

    </div>
  );
}