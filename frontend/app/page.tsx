"use client";

import Link from "next/link";
import VoiceAgent from "./components/VoiceAgent";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#081522]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-lg font-bold text-slate-950">
              V
            </div>

            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                VoiceDesk AI
              </h1>

              <p className="text-xs text-slate-400">
                Intelligent Voice Support
              </p>
            </div>
          </Link>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            
            {/* Analytics */}
            <Link
              href="/analytics"
              className="hidden rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/20 sm:inline-flex"
            >
              📊 Analytics
            </Link>

            {/* System Status */}
            <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              System Online
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        {/* Hero */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              AI CUSTOMER SUPPORT
            </span>

            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
              ● Live
            </span>
          </div>

          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Your intelligent voice
            <span className="text-cyan-400"> support assistant.</span>
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            Talk naturally with VoiceDesk AI. Get instant answers from the
            knowledge base, check your order status, and connect with a human
            support representative when needed.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">

          {/* Voice Agent */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-cyan-950/10">
            <div className="mb-8">
              <p className="mb-2 text-sm font-medium text-cyan-400">
                VOICE AGENT
              </p>

              <h2 className="text-3xl font-semibold">
                Talk to VoiceDesk
              </h2>

              <p className="mt-2 max-w-xl text-slate-400">
                Speak naturally with your AI customer support assistant.
                VoiceDesk listens, understands and responds in real time.
              </p>
            </div>

            {/* Existing Voice Agent */}
            <VoiceAgent />
          </div>

          {/* Conversation */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-sm font-medium text-cyan-400">
                  LIVE SESSION
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  Conversation
                </h2>
              </div>

              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
                Voice Agent
              </span>
            </div>

            <div className="flex min-h-[390px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-2xl">
                💬
              </div>

              <h3 className="font-medium">
                Live conversation
              </h3>

              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                Your voice conversation and AI responses will appear
                in the Voice Agent panel.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            [
              "🎙️",
              "Real-time Voice",
              "Natural voice conversations",
            ],
            [
              "🧠",
              "AI Understanding",
              "Intelligent responses",
            ],
            [
              "📚",
              "Knowledge Base",
              "RAG-powered answers",
            ],
            [
              "🚨",
              "Human Escalation",
              "Smart agent handoff",
            ],
          ].map(([icon, title, description]) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-white/[0.05]"
            >
              <div className="text-2xl">{icon}</div>

              <h3 className="mt-4 font-medium">
                {title}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>

        {/* Analytics CTA */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-cyan-400/10 bg-cyan-400/[0.04] p-6 sm:flex-row">
          <div>
            <p className="text-sm font-medium text-cyan-400">
              VOICEDESK INTELLIGENCE
            </p>

            <h3 className="mt-1 text-xl font-semibold">
              Monitor your support performance
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              View sessions, sentiment, frustration, tool usage and
              human escalations.
            </p>
          </div>

          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            View Analytics
            <span>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}