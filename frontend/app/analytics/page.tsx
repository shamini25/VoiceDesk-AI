"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

type SentimentStats = {
  positive: number;
  neutral: number;
  negative: number;
};

type FrustrationStats = {
  low: number;
  medium: number;
  high: number;
};

type ToolUsage = {
  knowledge_search: number;
  order_status: number;
  human_escalation: number;
};

type Session = {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  customer_messages?: number;
  agent_messages?: number;
  total_messages?: number;
  sentiment: SentimentStats;
  frustration: FrustrationStats;
  tool_usage: ToolUsage;
  escalated: boolean;
  escalation_ticket: string | null;
  messages?: unknown[];
};

type AnalyticsSummary = {
  total_sessions: number;
  total_messages: number;
  customer_messages?: number;
  agent_messages?: number;

  sentiment: SentimentStats;

  frustration: FrustrationStats;

  tool_usage: ToolUsage;

  escalations?:
    | number
    | {
        sessions: number;
        tickets: number;
      };

  escalation_sessions?: number;
  escalation_tickets?: number;

  intent_distribution?: Record<string, number>;
  resolution?: {
    resolved: number;
    in_progress: number;
    escalated: number;
    unknown: number;
  };
  resolved_sessions?: number;
  resolution_rate?: number;
  average_messages_per_session?: number;
  order_related_sessions?: number;
  escalation_rate?: number;
  conversation_intelligence?: {
    intent_distribution?: Record<string, number>;
    resolution?: {
      resolved: number;
      in_progress: number;
      escalated: number;
      unknown: number;
    };
    resolved_sessions?: number;
    resolution_rate?: number;
    average_messages_per_session?: number;
    order_related_sessions?: number;
    escalation_rate?: number;
  };
};

type SessionsResponse = {
  success: boolean;
  sessions: Session[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Active";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "Active";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTotalSentiment(sentiment: SentimentStats) {
  return (
    sentiment.positive +
    sentiment.neutral +
    sentiment.negative
  );
}

function getSentimentPercentage(
  value: number,
  total: number
) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function getFrustrationLevel(
  frustration: FrustrationStats
) {
  if (frustration.high > 0) {
    return "High";
  }

  if (frustration.medium > 0) {
    return "Medium";
  }

  return "Low";
}

function getSessionMessageCount(session: Session) {
  if (
    typeof session.total_messages === "number"
  ) {
    return session.total_messages;
  }

  if (
    typeof session.message_count === "number"
  ) {
    return session.message_count;
  }

  if (Array.isArray(session.messages)) {
    return session.messages.length;
  }

  return 0;
}

function getSessionSentiment(
  sentiment: SentimentStats
) {
  if (
    sentiment.negative > sentiment.positive &&
    sentiment.negative > sentiment.neutral
  ) {
    return {
      label: "Negative",
      className: "text-red-300",
      dotClass: "bg-red-400",
    };
  }

  if (
    sentiment.positive > sentiment.negative &&
    sentiment.positive > sentiment.neutral
  ) {
    return {
      label: "Positive",
      className: "text-emerald-300",
      dotClass: "bg-emerald-400",
    };
  }

  return {
    label: "Neutral",
    className: "text-slate-300",
    dotClass: "bg-slate-400",
  };
}

export default function AnalyticsPage() {
  const [summary, setSummary] =
    useState<AnalyticsSummary | null>(null);

  const [sessions, setSessions] =
    useState<Session[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const fetchAnalytics = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        setError("");

        const [
          summaryResponse,
          sessionsResponse,
        ] = await Promise.all([
          fetch(
            `${BACKEND_URL}/api/analytics`,
            {
              cache: "no-store",
            }
          ),

          fetch(
            `${BACKEND_URL}/api/analytics/sessions`,
            {
              cache: "no-store",
            }
          ),
        ]);

        if (!summaryResponse.ok) {
          throw new Error(
            "Unable to load analytics summary."
          );
        }

        if (!sessionsResponse.ok) {
          throw new Error(
            "Unable to load analytics sessions."
          );
        }

        const summaryData: AnalyticsSummary =
          await summaryResponse.json();

        const sessionsData: SessionsResponse =
          await sessionsResponse.json();

        if (!sessionsData.success) {
          throw new Error(
            "Analytics sessions request failed."
          );
        }

        setSummary(summaryData);
        setSessions(
          Array.isArray(sessionsData.sessions)
            ? sessionsData.sessions
            : []
        );

        setLastUpdated(new Date());
      } catch (err) {
        console.error(
          "Analytics fetch error:",
          err
        );

        setError(
          "Unable to connect to the VoiceDesk AI backend. Make sure FastAPI is running."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchAnalytics(true);

    const interval = window.setInterval(() => {
      fetchAnalytics(false);
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchAnalytics]);

  const sentiment = useMemo<SentimentStats>(
    () =>
      summary?.sentiment ?? {
        positive: 0,
        neutral: 0,
        negative: 0,
      },
    [summary]
  );

  const frustration = useMemo<FrustrationStats>(
    () =>
      summary?.frustration ?? {
        low: 0,
        medium: 0,
        high: 0,
      },
    [summary]
  );

  const tools = useMemo<ToolUsage>(
    () =>
      summary?.tool_usage ?? {
        knowledge_search: 0,
        order_status: 0,
        human_escalation: 0,
      },
    [summary]
  );

  const sentimentTotal =
    getTotalSentiment(sentiment);

  const positivePercentage =
    getSentimentPercentage(
      sentiment.positive,
      sentimentTotal
    );

  const neutralPercentage =
    getSentimentPercentage(
      sentiment.neutral,
      sentimentTotal
    );

  const negativePercentage =
    getSentimentPercentage(
      sentiment.negative,
      sentimentTotal
    );

  const escalationCount =
  typeof summary?.escalation_sessions === "number"
    ? summary.escalation_sessions
    : typeof summary?.escalations === "number"
    ? summary.escalations
    : typeof summary?.escalations === "object" &&
      summary?.escalations !== null &&
      "sessions" in summary.escalations &&
      typeof summary.escalations.sessions === "number"
    ? summary.escalations.sessions
    : sessions.filter(
        (session) => session.escalated
      ).length;

  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort(
        (a, b) =>
          new Date(b.started_at).getTime() -
          new Date(a.started_at).getTime()
      )
      .slice(0, 8);
  }, [sessions]);

  const totalToolCalls =
    tools.knowledge_search +
    tools.order_status +
    tools.human_escalation;

  const conversationIntelligence = summary?.conversation_intelligence;
  const intentDistribution =
    summary?.intent_distribution ??
    conversationIntelligence?.intent_distribution ??
    {};
  const resolution =
    summary?.resolution ??
    conversationIntelligence?.resolution ?? {
      resolved: 0,
      in_progress: 0,
      escalated: 0,
      unknown: 0,
    };
  const resolutionRate =
    typeof summary?.resolution_rate === "number"
      ? summary.resolution_rate
      : typeof conversationIntelligence?.resolution_rate === "number"
      ? conversationIntelligence.resolution_rate
      : 0;
  const averageMessagesPerSession =
    typeof summary?.average_messages_per_session === "number"
      ? summary.average_messages_per_session
      : typeof conversationIntelligence?.average_messages_per_session === "number"
      ? conversationIntelligence.average_messages_per_session
      : summary?.total_sessions
      ? summary.total_messages / summary.total_sessions
      : 0;
  const orderRelatedSessions =
    typeof summary?.order_related_sessions === "number"
      ? summary.order_related_sessions
      : typeof conversationIntelligence?.order_related_sessions === "number"
      ? conversationIntelligence.order_related_sessions
      : 0;
  const escalationRate =
    typeof summary?.escalation_rate === "number"
      ? summary.escalation_rate
      : typeof conversationIntelligence?.escalation_rate === "number"
      ? conversationIntelligence.escalation_rate
      : summary?.total_sessions
      ? (escalationCount / summary.total_sessions) * 100
      : 0;
  const sortedIntentDistribution = Object.entries(intentDistribution).sort(
    ([, a], [, b]) => b - a
  );
  const intentTotal = Object.values(intentDistribution).reduce(
    (total, value) => total + value,
    0
  );
  const resolutionTotal =
    resolution.resolved +
    resolution.in_progress +
    resolution.escalated +
    resolution.unknown;
  const resolutionItems = [
    { key: "resolved", label: "Resolved", value: resolution.resolved, className: "text-emerald-300", barClassName: "bg-emerald-400" },
    { key: "in_progress", label: "In Progress", value: resolution.in_progress, className: "text-amber-300", barClassName: "bg-amber-400" },
    { key: "escalated", label: "Escalated", value: resolution.escalated, className: "text-orange-300", barClassName: "bg-orange-400" },
    { key: "unknown", label: "Unknown", value: resolution.unknown, className: "text-slate-300", barClassName: "bg-slate-400" },
  ];

  if (loading && !summary) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
          >
            <span className="text-lg">
              ←
            </span>
            Back to Voice Agent
          </Link>

          <div className="flex min-h-[600px] items-center justify-center">
            <div className="text-center">

              <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />

              <h2 className="text-lg font-semibold">
                Loading Analytics
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Preparing your conversation intelligence dashboard...
              </p>

            </div>
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">

      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/[0.04] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/[0.04] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-8">

        {/* Top navigation */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
          >
            <span className="text-lg">
              ←
            </span>
            Back to Voice Agent
          </Link>

          <div className="flex items-center gap-3">

            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />

              <span className="text-xs font-medium text-emerald-300">
                System Online
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                fetchAnalytics(false)
              }
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-300"
            >
              ↻ Refresh
            </button>

          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/[0.05] px-5 py-4">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-start gap-3">
                <span className="text-lg">
                  ⚠️
                </span>

                <div>
                  <p className="text-sm font-medium text-red-300">
                    Backend connection error
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {error}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  fetchAnalytics(true)
                }
                className="w-fit rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-400/15"
              >
                Try Again
              </button>

            </div>
          </div>
        )}

        {/* Header */}
        <section className="mb-8">

          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />

            <span className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
              VoiceDesk AI
            </span>
          </div>

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Analytics Dashboard
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Monitor customer conversations, sentiment,
                frustration, AI tools, and human escalation
                activity in real time.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Last Updated
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString(
                      "en-IN",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }
                    )
                  : "—"}
              </p>
            </div>

          </div>
        </section>

        {/* KPI cards */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Sessions */}
          <div className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-400/20 hover:bg-white/[0.05]">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Total Sessions
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight">
                  {summary?.total_sessions ?? 0}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Recorded conversations
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.06] text-xl">
                🎙️
              </div>

            </div>
          </div>

          {/* Messages */}
          <div className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-violet-400/20 hover:bg-white/[0.05]">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Total Messages
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight">
                  {summary?.total_messages ?? 0}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Customer + AI responses
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/10 bg-violet-400/[0.06] text-xl">
                💬
              </div>

            </div>
          </div>

          {/* Positive sentiment */}
          <div className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-emerald-400/20 hover:bg-white/[0.05]">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Positive Sentiment
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-300">
                  {positivePercentage}%
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Customer sentiment
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06] text-xl">
                😊
              </div>

            </div>
          </div>

          {/* Escalations */}
          <div className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-orange-400/20 hover:bg-white/[0.05]">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Escalations
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight text-orange-300">
                  {escalationCount}
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Sessions requiring support
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/10 bg-orange-400/[0.06] text-xl">
                🚨
              </div>

            </div>
          </div>

        </section>

        {/* Phase 2 — Conversation Intelligence */}
        <section className="mb-8">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.8)]" />
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300">Phase 2</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Conversation Intelligence</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Understand customer intent, resolution progress, order-related conversations, and escalation patterns.</p>
            </div>
            <span className="w-fit rounded-lg border border-violet-400/15 bg-violet-400/[0.05] px-3 py-1.5 text-xs text-violet-300">Live analytics</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.025] p-5"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Resolution Rate</p><p className="mt-3 text-3xl font-bold text-emerald-300">{resolutionRate.toFixed(1)}%</p><p className="mt-2 text-xs text-slate-600">{resolution.resolved} resolved sessions</p></div>
            <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.025] p-5"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Avg. Messages</p><p className="mt-3 text-3xl font-bold text-cyan-300">{averageMessagesPerSession.toFixed(1)}</p><p className="mt-2 text-xs text-slate-600">Messages per session</p></div>
            <div className="rounded-2xl border border-violet-400/10 bg-violet-400/[0.025] p-5"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Order Related</p><p className="mt-3 text-3xl font-bold text-violet-300">{orderRelatedSessions}</p><p className="mt-2 text-xs text-slate-600">Sessions involving orders</p></div>
            <div className="rounded-2xl border border-orange-400/10 bg-orange-400/[0.025] p-5"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Escalation Rate</p><p className="mt-3 text-3xl font-bold text-orange-300">{escalationRate.toFixed(1)}%</p><p className="mt-2 text-xs text-slate-600">{escalationCount} escalated sessions</p></div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Intent Distribution</h3><p className="mt-1 text-xs text-slate-500">Customer intents detected across sessions</p></div><span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-500">{intentTotal} detected</span></div>
              {sortedIntentDistribution.length === 0 ? (
                <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-8 text-center"><p className="text-sm text-slate-500">No intent data available yet.</p></div>
              ) : (
                <div className="mt-6 space-y-5">
                  {sortedIntentDistribution.map(([intent, value]) => {
                    const percentage = intentTotal > 0 ? Math.round((value / intentTotal) * 100) : 0;
                    const label = intent.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
                    return <div key={intent}><div className="mb-2 flex items-center justify-between gap-4"><span className="text-sm font-medium text-slate-300">{label}</span><div className="flex items-center gap-2"><span className="text-xs text-slate-600">{value}</span><span className="text-xs font-semibold text-cyan-300">{percentage}%</span></div></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-cyan-400 transition-all duration-500" style={{ width: `${percentage}%` }} /></div></div>;
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold">Resolution Analytics</h3><p className="mt-1 text-xs text-slate-500">Current outcome of recorded conversations</p></div><span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-500">{resolutionTotal} sessions</span></div>
              <div className="mt-6 space-y-5">
                {resolutionItems.map((item) => {
                  const percentage = resolutionTotal > 0 ? Math.round((item.value / resolutionTotal) * 100) : 0;
                  return <div key={item.key}><div className="mb-2 flex items-center justify-between gap-4"><span className={`text-sm font-medium ${item.className}`}>{item.label}</span><div className="flex items-center gap-2"><span className="text-xs text-slate-600">{item.value}</span><span className="text-xs font-semibold text-slate-400">{percentage}%</span></div></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className={`h-full rounded-full transition-all duration-500 ${item.barClassName}`} style={{ width: `${percentage}%` }} /></div></div>;
                })}
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4"><p className="text-2xl font-bold text-emerald-300">{resolution.resolved}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">Resolved</p></div><div className="rounded-xl border border-orange-400/10 bg-orange-400/[0.04] p-4"><p className="text-2xl font-bold text-orange-300">{resolution.escalated}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">Escalated</p></div></div>
            </div>
          </div>
        </section>

        {/* Analytics grid */}
        <section className="mb-8 grid gap-6 lg:grid-cols-2">

          {/* Sentiment card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="font-semibold">
                  Customer Sentiment
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Overall emotional distribution
                </p>
              </div>

              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-500">
                {sentimentTotal} signals
              </span>

            </div>

            <div className="mt-7 flex flex-col items-center gap-8 sm:flex-row">

              {/* Donut */}
              <div
                className="relative h-44 w-44 shrink-0 rounded-full"
                style={{
                  background:
                    sentimentTotal > 0
                      ? `conic-gradient(
                          #34d399 0% ${positivePercentage}%,
                          #94a3b8 ${positivePercentage}% ${
                            positivePercentage +
                            neutralPercentage
                          }%,
                          #f87171 ${
                            positivePercentage +
                            neutralPercentage
                          }% 100%
                        )`
                      : "conic-gradient(#1e293b 0% 100%)",
                }}
              >
                <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-[#080d20]">

                  <span className="text-3xl font-bold">
                    {sentimentTotal}
                  </span>

                  <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                    signals
                  </span>

                </div>
              </div>

              {/* Legend */}
              <div className="w-full space-y-4">

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                    <span className="text-sm text-slate-300">
                      Positive
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-emerald-300">
                      {positivePercentage}%
                    </span>

                    <span className="ml-2 text-xs text-slate-600">
                      {sentiment.positive}
                    </span>
                  </div>

                </div>

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />

                    <span className="text-sm text-slate-300">
                      Neutral
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-slate-300">
                      {neutralPercentage}%
                    </span>

                    <span className="ml-2 text-xs text-slate-600">
                      {sentiment.neutral}
                    </span>
                  </div>

                </div>

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />

                    <span className="text-sm text-slate-300">
                      Negative
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-red-300">
                      {negativePercentage}%
                    </span>

                    <span className="ml-2 text-xs text-slate-600">
                      {sentiment.negative}
                    </span>
                  </div>

                </div>

              </div>
            </div>
          </div>

          {/* Frustration card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="font-semibold">
                  Frustration Analysis
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Detected customer frustration levels
                </p>
              </div>

              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-500">
                {getFrustrationLevel(frustration)}
              </span>

            </div>

            <div className="mt-7 space-y-5">

              {/* Low */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">

                  <span className="text-emerald-300">
                    Low
                  </span>

                  <span className="text-slate-500">
                    {frustration.low}
                  </span>

                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{
                      width: `${
                        sentimentTotal > 0
                          ? Math.min(
                              100,
                              (frustration.low /
                                Math.max(
                                  1,
                                  frustration.low +
                                    frustration.medium +
                                    frustration.high
                                )) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Medium */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">

                  <span className="text-amber-300">
                    Medium
                  </span>

                  <span className="text-slate-500">
                    {frustration.medium}
                  </span>

                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
                    style={{
                      width: `${
                        sentimentTotal > 0
                          ? Math.min(
                              100,
                              (frustration.medium /
                                Math.max(
                                  1,
                                  frustration.low +
                                    frustration.medium +
                                    frustration.high
                                )) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* High */}
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">

                  <span className="text-red-300">
                    High
                  </span>

                  <span className="text-slate-500">
                    {frustration.high}
                  </span>

                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-red-400 transition-all duration-500"
                    style={{
                      width: `${
                        sentimentTotal > 0
                          ? Math.min(
                              100,
                              (frustration.high /
                                Math.max(
                                  1,
                                  frustration.low +
                                    frustration.medium +
                                    frustration.high
                                )) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

            </div>

            <div className="mt-7 grid grid-cols-3 gap-3">

              <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4 text-center">
                <p className="text-2xl font-bold text-emerald-300">
                  {frustration.low}
                </p>

                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                  Low
                </p>
              </div>

              <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-4 text-center">
                <p className="text-2xl font-bold text-amber-300">
                  {frustration.medium}
                </p>

                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                  Medium
                </p>
              </div>

              <div className="rounded-xl border border-red-400/10 bg-red-400/[0.04] p-4 text-center">
                <p className="text-2xl font-bold text-red-300">
                  {frustration.high}
                </p>

                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                  High
                </p>
              </div>

            </div>
          </div>

        </section>

        {/* Tool usage */}
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.025] p-6">

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

            <div>
              <h2 className="font-semibold">
                AI Tool Usage
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Actions performed by VoiceDesk AI during customer conversations
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-500">
              {totalToolCalls} total tool calls
            </div>

          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            {/* Knowledge */}
            <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">

              <div className="flex items-center justify-between">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.06] text-xl">
                  🔎
                </div>

                <span className="text-3xl font-bold text-cyan-300">
                  {tools.knowledge_search}
                </span>

              </div>

              <h3 className="mt-5 text-sm font-semibold">
                Knowledge Search
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-600">
                RAG knowledge base searches used to answer customer questions.
              </p>

            </div>

            {/* Orders */}
            <div className="rounded-2xl border border-violet-400/10 bg-violet-400/[0.03] p-5">

              <div className="flex items-center justify-between">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/10 bg-violet-400/[0.06] text-xl">
                  📦
                </div>

                <span className="text-3xl font-bold text-violet-300">
                  {tools.order_status}
                </span>

              </div>

              <h3 className="mt-5 text-sm font-semibold">
                Order Status
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-600">
                Order lookups performed using the support order tool.
              </p>

            </div>

            {/* Human */}
            <div className="rounded-2xl border border-orange-400/10 bg-orange-400/[0.03] p-5">

              <div className="flex items-center justify-between">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/10 bg-orange-400/[0.06] text-xl">
                  👨‍💼
                </div>

                <span className="text-3xl font-bold text-orange-300">
                  {tools.human_escalation}
                </span>

              </div>

              <h3 className="mt-5 text-sm font-semibold">
                Human Support
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-600">
                Customer requests that triggered human support escalation.
              </p>

            </div>

          </div>
        </section>

        {/* Recent sessions */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.025]">

          <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center">

            <div>
              <h2 className="font-semibold">
                Recent Sessions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Select a session to view full conversation intelligence.
              </p>
            </div>

            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-500">
              {sessions.length} sessions
            </span>

          </div>

          {recentSessions.length === 0 ? (
            <div className="px-6 py-20 text-center">

              <div className="mb-4 text-4xl">
                🎙️
              </div>

              <h3 className="font-semibold">
                No sessions yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                Start a VoiceDesk AI conversation to begin collecting analytics data.
              </p>

              <Link
                href="/"
                className="mt-6 inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/15"
              >
                Start Voice Agent
              </Link>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[850px]">

                <thead>
                  <tr className="border-b border-white/5 text-left">

                    <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                      Session
                    </th>

                    <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                      Date
                    </th>

                    <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                      Messages
                    </th>

                    <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                      Sentiment
                    </th>

                    <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                      Frustration
                    </th>

                    <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                      Tools
                    </th>

                    <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-slate-600">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {recentSessions.map(
                    (session) => {
                      const sessionSentiment =
                        getSessionSentiment(
                          session.sentiment
                        );

                      const frustrationLevel =
                        getFrustrationLevel(
                          session.frustration
                        );

                      const messageCount =
                        getSessionMessageCount(
                          session
                        );

                      const toolCount =
                        session.tool_usage
                          .knowledge_search +
                        session.tool_usage
                          .order_status +
                        session.tool_usage
                          .human_escalation;

                      return (
                        <tr
                          key={session.session_id}
                          className="group border-b border-white/5 transition hover:bg-white/[0.025]"
                        >

                          {/* Session ID */}
                          <td className="px-6 py-4">

                            <Link
                              href={`/analytics/${encodeURIComponent(
                                session.session_id
                              )}`}
                              className="inline-flex items-center gap-2"
                            >
                              <span className="h-2 w-2 rounded-full bg-cyan-400 opacity-60 transition group-hover:opacity-100 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.7)]" />

                              <span className="font-mono text-xs font-medium text-cyan-300 transition group-hover:text-cyan-200 group-hover:underline">
                                {session.session_id}
                              </span>
                            </Link>

                          </td>

                          {/* Date */}
                          <td className="px-6 py-4">

                            <p className="text-xs text-slate-300">
                              {formatShortDate(
                                session.started_at
                              )}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-600">
                              {formatDate(
                                session.started_at
                              ).split(", ")[1] ||
                                ""}
                            </p>

                          </td>

                          {/* Messages */}
                          <td className="px-6 py-4">

                            <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-300">
                              {messageCount}
                            </span>

                          </td>

                          {/* Sentiment */}
                          <td className="px-6 py-4">

                            <div className="flex items-center gap-2">

                              <span
                                className={`h-2 w-2 rounded-full ${sessionSentiment.dotClass}`}
                              />

                              <span
                                className={`text-xs font-medium ${sessionSentiment.className}`}
                              >
                                {sessionSentiment.label}
                              </span>

                            </div>

                          </td>

                          {/* Frustration */}
                          <td className="px-6 py-4">

                            <span
                              className={`text-xs font-medium ${
                                frustrationLevel ===
                                "High"
                                  ? "text-red-300"
                                  : frustrationLevel ===
                                    "Medium"
                                  ? "text-amber-300"
                                  : "text-emerald-300"
                              }`}
                            >
                              {frustrationLevel}
                            </span>

                          </td>

                          {/* Tools */}
                          <td className="px-6 py-4">

                            <span className="text-xs text-slate-400">
                              {toolCount}
                            </span>

                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">

                            {session.escalated ? (
                              <span className="inline-flex items-center gap-2 rounded-lg border border-orange-400/15 bg-orange-400/[0.05] px-2.5 py-1.5 text-[10px] font-medium text-orange-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                                Escalated
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] px-2.5 py-1.5 text-[10px] font-medium text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Normal
                              </span>
                            )}

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>
            </div>
          )}

        </section>

        {/* Conversation Intelligence CTA */}
        {recentSessions.length > 0 && (
          <section className="mt-8 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.025] p-6">

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              <div className="flex items-start gap-4">

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] text-xl">
                  🧠
                </div>

                <div>
                  <h3 className="font-semibold">
                    Conversation Intelligence
                  </h3>

                  <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                    Open any session to inspect the complete transcript,
                    customer sentiment, frustration signals, AI tools,
                    and escalation information.
                  </p>
                </div>

              </div>

              <Link
                href={`/analytics/${encodeURIComponent(
                  recentSessions[0].session_id
                )}`}
                className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/15 hover:text-cyan-200"
              >
                View Latest Session
                <span>→</span>
              </Link>

            </div>

          </section>
        )}

        {/* Footer */}
        <footer className="mt-10 border-t border-white/5 pt-6">

          <div className="flex flex-col gap-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">

            <p>
              VoiceDesk AI • Conversation Intelligence
            </p>

            <div className="flex items-center gap-4">

              <Link
                href="/"
                className="transition hover:text-cyan-300"
              >
                Voice Agent
              </Link>

              <span>•</span>

              <span>
                Auto-refresh: 10s
              </span>

            </div>

          </div>

        </footer>

      </div>
    </main>
  );
}