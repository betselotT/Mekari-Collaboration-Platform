"use client";

import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { apiClient, getAuthToken } from "../../lib/api";

type Tab = "threads" | "experts" | "leaderboard" | "profile" | "ai";

interface Thread {
  _id: string;
  title: string;
  subject: string;
}

interface Message {
  _id: string;
  body: string;
  createdAt: string;
  isFromAi: boolean;
  sender?: {
    name: string;
  };
}

interface UserProfile {
  name: string;
  email: string;
  bio?: string;
}

const SUBJECTS = [
  // Software / CS-focused
  "Software Engineering",
  "Computer Networks",
  "Data Structures & Algorithms",
  "Databases",
  "Embedded Systems",
  "Web Development",
  "Artificial Intelligence",
  "Machine Learning",
  // Broader engineering disciplines
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Chemical Engineering",
  "Industrial Engineering",
  "Biomedical Engineering",
  "Environmental Engineering",
];

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("threads");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | "all">("all");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [experts, setExperts] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const socket: Socket | null = useMemo(() => {
    if (typeof window === "undefined") return null;
    const token = getAuthToken();
    if (!token) return null;
    return io("http://localhost:4000", {
      auth: { token },
    });
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = "/";
      return;
    }
    async function load() {
      try {
        const [threadsRes, expertsRes, leaderboardRes, profileRes] =
          await Promise.all([
            apiClient.get("/api/threads"),
            apiClient.get("/api/users/experts"),
            apiClient.get("/api/gamification/leaderboard"),
            apiClient.get("/api/users/me"),
          ]);
        setThreads(threadsRes.data.threads);
        setExperts(expertsRes.data.experts);
        setLeaderboard(leaderboardRes.data.leaderboard);
        setProfile(profileRes.data.user);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!socket || !selectedThread) return;
    socket.emit("join-thread", selectedThread._id);

    socket.on("new-message", (msg: any) => {
      setMessages((prev) => [
        ...prev,
        {
          _id: msg.id,
          body: msg.body,
          createdAt: msg.createdAt,
          isFromAi: false,
        },
      ]);
    });

    return () => {
      socket.off("new-message");
    };
  }, [socket, selectedThread]);

  async function openThread(thread: Thread) {
    setSelectedThread(thread);
    const res = await apiClient.get(`/api/threads/${thread._id}/messages`);
    setMessages(res.data.messages);
  }

  async function sendChatMessage() {
    if (!selectedThread || !newMessage.trim()) return;
    await apiClient.post(`/api/threads/${selectedThread._id}/messages`, {
      body: newMessage,
    });
    setNewMessage("");
    // REST fallback: reload messages; in practice Socket.IO will also append
    const res = await apiClient.get(`/api/threads/${selectedThread._id}/messages`);
    setMessages(res.data.messages);
  }

  async function askAi() {
    if (!selectedThread) return;
    setAiLoading(true);
    try {
      const res = await apiClient.post("/api/ai/chat", {
        threadId: selectedThread._id,
        prompt: "Help with this thread context.",
      });
      setMessages((prev) => [
        ...prev,
        {
          _id: res.data.message.id,
          body: res.data.message.body,
          createdAt: res.data.message.createdAt,
          isFromAi: true,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-300">Loading your workspace...</p>;
  }

  return (
    <div className="flex h-full gap-4">
      <aside className="flex w-52 flex-col gap-4 border-r border-slate-800 pr-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Workspace
          </p>
          <nav className="space-y-1">
            {[
              { id: "threads", label: "Threads" },
              { id: "experts", label: "Experts" },
              { id: "leaderboard", label: "Leaderboard" },
              { id: "profile", label: "Profile" },
              { id: "ai", label: "AI assistant" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as Tab)}
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${
                  tab === item.id
                    ? "bg-primary-500 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Subjects
          </p>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedSubject("all")}
              className={`w-full rounded px-2 py-1 text-left text-xs ${
                selectedSubject === "all"
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              All subjects
            </button>
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSubject(s)}
                className={`w-full rounded px-2 py-1 text-left text-xs ${
                  selectedSubject === s
                    ? "bg-slate-800 text-slate-50"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex flex-1 flex-col gap-4 text-sm">
        {tab === "threads" && (
          <div className="grid h-full gap-4 md:grid-cols-[1.2fr,1.4fr]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-50">
                  Threads
                </h2>
              </div>
              <ul className="flex-1 divide-y divide-slate-800 overflow-y-auto rounded border border-slate-800 bg-slate-900/60">
                {threads
                  .filter(
                    (t) =>
                      selectedSubject === "all" || t.subject === selectedSubject
                  )
                  .map((t) => (
                    <li
                      key={t._id}
                      className={`cursor-pointer px-3 py-2 ${
                        selectedThread?._id === t._id
                          ? "bg-slate-800"
                          : "hover:bg-slate-900"
                      }`}
                      onClick={() => openThread(t)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-100">
                          {t.title}
                        </span>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                          {t.subject}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="flex flex-col rounded border border-slate-800 bg-slate-900/60">
              {selectedThread ? (
                <>
                  <div className="border-b border-slate-800 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-100">
                      {selectedThread.title}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Subject: {selectedThread.subject}
                    </p>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
                    {messages.map((m) => (
                      <div key={m._id} className="text-[11px]">
                        <span
                          className={
                            m.isFromAi
                              ? "text-emerald-300"
                              : "text-slate-200"
                          }
                        >
                          {m.isFromAi ? "AI" : m.sender?.name || "User"}:
                        </span>{" "}
                        <span className="text-slate-300">{m.body}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-800 p-2">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-primary-500"
                        placeholder="Type a reply..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendChatMessage();
                          }
                        }}
                      />
                      <button
                        onClick={sendChatMessage}
                        className="rounded bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
                  Select a thread on the left to read and reply.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "experts" && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-50">
              Available experts
            </h2>
            <ul className="divide-y divide-slate-800 rounded border border-slate-800 bg-slate-900/60">
              {experts.map((e) => (
                <li key={e._id} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100">
                      {e.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {e.availabilityStatus}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {e.expertise?.map((ex: any) => ex.subject).join(", ")}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "leaderboard" && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-50">
              Leaderboard
            </h2>
            <ul className="divide-y divide-slate-800 rounded border border-slate-800 bg-slate-900/60">
              {leaderboard.map((u, idx) => (
                <li key={u._id} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">
                      #{idx + 1} {u.name}
                    </span>
                    <span className="text-[11px] text-emerald-300">
                      {u.points} pts
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "profile" && profile && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-50">Profile</h2>
            <p className="text-xs text-slate-300">
              {profile.name} · {profile.email}
            </p>
            {profile.bio && (
              <p className="text-xs text-slate-400">{profile.bio}</p>
            )}
            <p className="mt-4 text-[11px] text-slate-500">
              In a full implementation, you would be able to edit expertise,
              availability, and connect your Google account for Meet links.
            </p>
          </div>
        )}

        {tab === "ai" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-50">
              AI assistant
            </h2>
            <p className="text-xs text-slate-400">
              Select a thread in the Threads tab, then ask the AI assistant to
              add a suggestion into the conversation.
            </p>
            <button
              onClick={askAi}
              disabled={!selectedThread || aiLoading}
              className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {aiLoading
                ? "Asking AI..."
                : selectedThread
                  ? "Ask AI about current thread"
                  : "Select a thread first"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

