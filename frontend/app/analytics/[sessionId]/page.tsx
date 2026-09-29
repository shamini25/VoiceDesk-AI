"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Message = {
  timestamp: string;
  speaker: "customer" | "agent";
  text: string;
  sentiment?: string | null;
  frustration?: string | null;
  frustration_score?: number | null;
  escalation_recommended?: boolean;
};

type Session = {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  customer_messages: number;
  agent_messages: number;
  total_messages?: number;

  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };

  frustration: {
    low: number;
    medium: number;
    high: number;
  };

  tool_usage: {
    knowledge_search: number;
    order_status: number;
    human_escalation: number;
  };

  escalated: boolean;
  escalation_ticket: string | null;

  messages: Message[];
};

type SessionSummary = {
  session_id: string;
  customer_issue: string | null;
  intent: string | null;
  order: {
    order_id: string | null;
    status: string | null;
    expected_delivery: string | null;
  };
  conversation: {
    customer_messages: number;
    agent_messages: number;
    total_messages: number;
  };
  sentiment: {
    overall: string;
    positive: number;
    neutral: number;
    negative: number;
  };
  frustration: {
    level: string;
    low: number;
    medium: number;
    high: number;
  };
  resolution: {
    state: string;
    outcome: string;
    escalated: boolean;
    ticket: string | null;
  };
  actions: string[];
  follow_up: string;
  highlights: string[];
  customer_conversation: string;
};

type SummaryResponse = {
  success: boolean;
  summary: SessionSummary;
};


function formatDate(value: string | null) {
  if (!value) return "In progress";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOverallSentiment(
  sentiment: Session["sentiment"]
) {
  if (sentiment.negative > sentiment.positive &&
      sentiment.negative > sentiment.neutral) {
    return "Negative";
  }

  if (sentiment.positive > sentiment.negative &&
      sentiment.positive > sentiment.neutral) {
    return "Positive";
  }

  return "Neutral";
}

function getOverallFrustration(
  frustration: Session["frustration"]
) {
  if (frustration.high > 0) return "High";
  if (frustration.medium > 0) return "Medium";
  return "Low";
}

function sentimentClass(sentiment?: string | null) {
  if (sentiment === "negative") {
    return "border-red-400/20 bg-red-400/10 text-red-300";
  }

  if (sentiment === "positive") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  return "border-slate-400/20 bg-slate-400/10 text-slate-300";
}

function frustrationClass(frustration?: string | null) {
  if (frustration === "high") {
    return "text-red-300";
  }

  if (frustration === "medium") {
    return "text-amber-300";
  }

  if (frustration === "low") {
    return "text-emerald-300";
  }

  return "text-slate-400";
}

export default function SessionDetailsPage() {
  const params = useParams();

  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] =
    useState<SessionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] =
    useState(true);
  const [summaryError, setSummaryError] =
    useState("");


  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      try {
        setLoading(true);
        setSummaryLoading(true);
        setError("");
        setSummaryError("");

        const encodedSessionId =
          encodeURIComponent(sessionId);

        const [sessionResponse, summaryResponse] =
          await Promise.all([
            fetch(
              `http://127.0.0.1:8000/api/analytics/session/${encodedSessionId}`
            ),
            fetch(
              `http://127.0.0.1:8000/api/analytics/session/${encodedSessionId}/summary`
            ),
          ]);

        if (!sessionResponse.ok) {
          throw new Error("Session could not be found.");
        }

        const sessionData =
          await sessionResponse.json();

        if (
          !sessionData.success ||
          !sessionData.session
        ) {
          throw new Error("Invalid session response.");
        }

        setSession(sessionData.session);

        if (summaryResponse.ok) {
          const summaryData =
            (await summaryResponse.json()) as SummaryResponse;

          if (
            summaryData.success &&
            summaryData.summary
          ) {
            setSummary(summaryData.summary);
          } else {
            setSummaryError(
              "Session summary is not available yet."
            );
          }
        } else {
          setSummaryError(
            "Session summary is not available yet."
          );
        }
      } catch (err) {
        console.error(err);
        setError(
          "Unable to load this session. Please check the backend."
        );
      } finally {
        setLoading(false);
        setSummaryLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link
            href="/analytics"
            className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
          >
            <span className="text-lg">←</span>
            Back to Analytics
          </Link>

          <div className="flex min-h-[500px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />

              <p className="text-sm text-slate-400">
                Loading conversation intelligence...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link
            href="/analytics"
            className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
          >
            <span className="text-lg">←</span>
            Back to Analytics
          </Link>

          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-10 text-center">
            <div className="mb-4 text-4xl">⚠️</div>

            <h1 className="text-xl font-semibold">
              Session Not Found
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              {error || "This analytics session does not exist."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const overallSentiment = getOverallSentiment(session.sentiment);
  const overallFrustration = getOverallFrustration(session.frustration);

  const totalMessages =
    session.messages?.length ||
    session.message_count ||
    0;

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

        {/* Back */}
        <Link
          href="/analytics"
          className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
        >
          <span className="text-lg">←</span>
          Back to Analytics
        </Link>

        {/* Header */}
        <section className="mb-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />

                <span className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
                  Conversation Intelligence
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Session Details
              </h1>

              <p className="mt-2 font-mono text-sm text-slate-500">
                {session.session_id}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-slate-500">
                Session Status
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    session.ended_at
                      ? "bg-slate-400"
                      : "bg-emerald-400"
                  }`}
                />

                <span className="text-sm font-medium">
                  {session.ended_at
                    ? "Completed"
                    : "Active"}
                </span>
              </div>
            </div>

          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>
              Started:{" "}
              <span className="text-slate-300">
                {formatDate(session.started_at)}
              </span>
            </span>

            <span className="hidden sm:inline">•</span>

            <span>
              Ended:{" "}
              <span className="text-slate-300">
                {formatDate(session.ended_at)}
              </span>
            </span>
          </div>
        </section>

        {/* AI SESSION SUMMARY */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.06] via-white/[0.025] to-violet-400/[0.05]">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-sm">
                    ✨
                  </span>
                  <div>
                    <h2 className="font-semibold text-white">
                      AI Session Summary
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Consolidated conversation intelligence for this support session
                    </p>
                  </div>
                </div>
              </div>

              {summary && (
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                  {summary.conversation.total_messages} messages analyzed
                </div>
              )}
            </div>
          </div>

          {summaryLoading ? (
            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : summary ? (
            <div className="p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Customer Issue
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm font-medium leading-6 text-slate-200">
                    {summary.customer_issue || "No specific issue captured"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Order Context
                  </p>
                  {summary.order.order_id ? (
                    <>
                      <p className="mt-2 text-sm font-semibold text-purple-300">
                        📦 {summary.order.order_id}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {summary.order.status || "Status unavailable"}
                      </p>
                      {summary.order.expected_delivery && (
                        <p className="mt-1 text-xs text-slate-500">
                          Expected: {summary.order.expected_delivery}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">
                      No order referenced
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Customer Sentiment
                  </p>
                  <p
                    className={`mt-2 text-xl font-bold ${
                      summary.sentiment.overall.toLowerCase() === "negative"
                        ? "text-red-300"
                        : summary.sentiment.overall.toLowerCase() === "positive"
                        ? "text-emerald-300"
                        : "text-slate-200"
                    }`}
                  >
                    {summary.sentiment.overall}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Frustration:{" "}
                    <span className={frustrationClass(summary.frustration.level.toLowerCase())}>
                      {summary.frustration.level}
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Resolution
                  </p>
                  <p
                    className={`mt-2 text-xl font-bold ${
                      summary.resolution.state === "escalated"
                        ? "text-orange-300"
                        : summary.resolution.state === "resolved"
                        ? "text-emerald-300"
                        : "text-cyan-300"
                    }`}
                  >
                    {summary.resolution.state === "in_progress"
                      ? "In Progress"
                      : summary.resolution.state.charAt(0).toUpperCase() +
                        summary.resolution.state.slice(1)}
                  </p>
                  {summary.resolution.ticket && (
                    <p className="mt-1 font-mono text-xs text-orange-300">
                      {summary.resolution.ticket}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    What Happened
                  </p>

                  <div className="mt-3 space-y-2">
                    {summary.highlights?.length ? (
                      summary.highlights.map((highlight, index) => (
                        <div
                          key={`${highlight}-${index}`}
                          className="flex gap-3 text-sm leading-6 text-slate-300"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                          <span>{highlight}</span>
                        </div>
                      ))
                    ) : summary.customer_conversation ? (
                      <p className="text-sm leading-7 text-slate-300">
                        {summary.customer_conversation}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No customer conversation was captured.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Actions Taken
                  </p>

                  <div className="mt-3 space-y-2">
                    {summary.actions?.length ? (
                      summary.actions.map((action, index) => (
                        <div
                          key={`${action}-${index}`}
                          className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2.5"
                        >
                          <span className="text-emerald-300">✓</span>
                          <span className="text-sm leading-5 text-slate-300">
                            {action}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No actions recorded.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Intent
                  </p>
                  <p className="mt-2 text-sm font-medium text-violet-300">
                    {summary.intent || "General customer support"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Outcome
                  </p>
                  <p className="mt-2 text-sm font-medium text-cyan-300">
                    {summary.resolution.outcome}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Follow-up
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {summary.follow_up}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-300">
                    {summary.conversation.customer_messages}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Customer
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
                  <p className="text-2xl font-bold text-violet-300">
                    {summary.conversation.agent_messages}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Agent
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-200">
                    {summary.conversation.total_messages}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Total
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-400">
                {summaryError || "No session summary is available."}
              </div>
            </div>
          )}
        </section>

        {/* KPI cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Total Messages
            </p>

            <p className="mt-3 text-3xl font-bold">
              {totalMessages}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {session.customer_messages} customer •{" "}
              {session.agent_messages} agent
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Sentiment
            </p>

            <p
              className={`mt-3 text-3xl font-bold ${
                overallSentiment === "Negative"
                  ? "text-red-300"
                  : overallSentiment === "Positive"
                  ? "text-emerald-300"
                  : "text-slate-200"
              }`}
            >
              {overallSentiment}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {session.sentiment.positive} positive •{" "}
              {session.sentiment.neutral} neutral •{" "}
              {session.sentiment.negative} negative
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Frustration
            </p>

            <p
              className={`mt-3 text-3xl font-bold ${frustrationClass(
                overallFrustration.toLowerCase()
              )}`}
            >
              {overallFrustration}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Low {session.frustration.low} • Medium{" "}
              {session.frustration.medium} • High{" "}
              {session.frustration.high}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Escalation
            </p>

            <p
              className={`mt-3 text-3xl font-bold ${
                session.escalated
                  ? "text-orange-300"
                  : "text-emerald-300"
              }`}
            >
              {session.escalated ? "Yes" : "No"}
            </p>

            <p className="mt-1 truncate text-xs text-slate-500">
              {session.escalation_ticket || "No escalation ticket"}
            </p>
          </div>

        </section>

        {/* Main content */}
        <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">

          {/* Conversation */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025]">

            <div className="border-b border-white/10 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">
                    Conversation
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Complete session transcript
                  </p>
                </div>

                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400">
                  {totalMessages} messages
                </span>
              </div>
            </div>

            <div className="max-h-[650px] space-y-5 overflow-y-auto p-6">

              {session.messages.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mb-3 text-3xl">💬</div>

                  <p className="text-sm text-slate-400">
                    No conversation messages recorded.
                  </p>
                </div>
              ) : (
                session.messages.map((message, index) => {
                  const isCustomer =
                    message.speaker === "customer";

                  return (
                    <div
                      key={`${message.timestamp}-${index}`}
                      className={`flex gap-3 ${
                        isCustomer
                          ? "justify-start"
                          : "justify-end"
                      }`}
                    >

                      {isCustomer && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-sm">
                          👤
                        </div>
                      )}

                      <div
                        className={`max-w-[82%] ${
                          isCustomer
                            ? ""
                            : "items-end"
                        }`}
                      >
                        <div
                          className={`mb-1 flex items-center gap-2 ${
                            !isCustomer
                              ? "justify-end"
                              : ""
                          }`}
                        >
                          <span className="text-xs font-medium text-slate-400">
                            {isCustomer
                              ? "Customer"
                              : "VoiceDesk AI"}
                          </span>

                          <span className="text-[10px] text-slate-600">
                            {new Date(
                              message.timestamp
                            ).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div
                          className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                            isCustomer
                              ? "rounded-tl-md border-white/10 bg-white/[0.05] text-slate-200"
                              : "rounded-tr-md border-cyan-400/15 bg-cyan-400/[0.06] text-slate-200"
                          }`}
                        >
                          {message.text}
                        </div>

                        {isCustomer &&
                          (message.sentiment ||
                            message.frustration) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.sentiment && (
                                <span
                                  className={`rounded-md border px-2 py-1 text-[10px] ${sentimentClass(
                                    message.sentiment
                                  )}`}
                                >
                                  Sentiment:{" "}
                                  {message.sentiment}
                                </span>
                              )}

                              {message.frustration && (
                                <span
                                  className={`rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] ${frustrationClass(
                                    message.frustration
                                  )}`}
                                >
                                  Frustration:{" "}
                                  {message.frustration}
                                  {message.frustration_score !==
                                    null &&
                                    message.frustration_score !==
                                      undefined &&
                                    ` • ${message.frustration_score}`}
                                </span>
                              )}
                            </div>
                          )}
                      </div>

                      {!isCustomer && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-sm">
                          🤖
                        </div>
                      )}

                    </div>
                  );
                })
              )}

            </div>
          </div>

          {/* Intelligence panel */}
          <div className="space-y-6">

            {/* Sentiment */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">

              <h2 className="font-semibold">
                Sentiment Analysis
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Customer emotional signals
              </p>

              <div className="mt-6 space-y-4">

                <div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-emerald-300">
                      Positive
                    </span>
                    <span className="text-slate-500">
                      {session.sentiment.positive}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{
                        width: `${
                          totalMessages
                            ? (session.sentiment.positive /
                                Math.max(
                                  1,
                                  session.customer_messages
                                )) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-slate-300">
                      Neutral
                    </span>
                    <span className="text-slate-500">
                      {session.sentiment.neutral}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-slate-400"
                      style={{
                        width: `${
                          totalMessages
                            ? (session.sentiment.neutral /
                                Math.max(
                                  1,
                                  session.customer_messages
                                )) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-red-300">
                      Negative
                    </span>
                    <span className="text-slate-500">
                      {session.sentiment.negative}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{
                        width: `${
                          totalMessages
                            ? (session.sentiment.negative /
                                Math.max(
                                  1,
                                  session.customer_messages
                                )) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Frustration */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">

              <h2 className="font-semibold">
                Frustration Analysis
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Detected customer frustration levels
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">

                <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-300">
                    {session.frustration.low}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Low
                  </p>
                </div>

                <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-4 text-center">
                  <p className="text-2xl font-bold text-amber-300">
                    {session.frustration.medium}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Medium
                  </p>
                </div>

                <div className="rounded-xl border border-red-400/10 bg-red-400/[0.04] p-4 text-center">
                  <p className="text-2xl font-bold text-red-300">
                    {session.frustration.high}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    High
                  </p>
                </div>

              </div>
            </div>

            {/* Tools */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">

              <h2 className="font-semibold">
                Tools Used
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Agent actions during this session
              </p>

              <div className="mt-5 space-y-3">

                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔎</span>
                    <span className="text-sm text-slate-300">
                      Knowledge Search
                    </span>
                  </div>

                  <span className="font-semibold text-cyan-300">
                    {session.tool_usage.knowledge_search}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📦</span>
                    <span className="text-sm text-slate-300">
                      Order Status
                    </span>
                  </div>

                  <span className="font-semibold text-cyan-300">
                    {session.tool_usage.order_status}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">👨‍💼</span>
                    <span className="text-sm text-slate-300">
                      Human Support
                    </span>
                  </div>

                  <span className="font-semibold text-orange-300">
                    {session.tool_usage.human_escalation}
                  </span>
                </div>

              </div>
            </div>

            {/* Escalation */}
            <div
              className={`rounded-2xl border p-6 ${
                session.escalated
                  ? "border-orange-400/20 bg-orange-400/[0.05]"
                  : "border-white/10 bg-white/[0.025]"
              }`}
            >

              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {session.escalated ? "🚨" : "🛡️"}
                </div>

                <div>
                  <h2 className="font-semibold">
                    {session.escalated
                      ? "Human Escalation"
                      : "No Escalation"}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Support handoff status
                  </p>
                </div>
              </div>

              {session.escalated ? (
                <div className="mt-5 rounded-xl border border-orange-400/10 bg-black/10 p-4">

                  <p className="text-xs text-slate-500">
                    Ticket ID
                  </p>

                  <p className="mt-1 font-mono text-sm font-semibold text-orange-300">
                    {session.escalation_ticket ||
                      "Not available"}
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />

                    <span className="text-xs text-slate-300">
                      Pending Human Support
                    </span>
                  </div>

                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-400">
                  This session did not require human escalation.
                </p>
              )}

            </div>

          </div>
        </section>

        {/* Footer navigation */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/analytics"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
          >
            ← Return to Analytics Dashboard
          </Link>
        </div>

      </div>
    </main>
  );
}