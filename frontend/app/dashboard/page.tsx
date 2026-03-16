import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/dashboard/threads");
}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-200" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {profile.name}
                    </p>
                    <p className="text-[11px] text-primary-600">
                      {profile.email}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {profile.bio ||
                        "Leading collaborative teams to deliver technical excellence."}
                    </p>
                  </div>
                </div>
                <button className="rounded-full bg-slate-900 px-4 py-2 text-[11px] font-medium text-white">
                  Edit Profile
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                AI Assistant
              </h3>
              <p className="mb-4 text-[11px] text-slate-500">
                Select a thread in the Threads tab, then ask the AI to add a
                suggestion to the conversation.
              </p>
              <button
                onClick={askAi}
                disabled={!selectedThread || aiLoading}
                className="rounded-full bg-primary-600 px-5 py-2 text-[11px] font-medium text-white disabled:opacity-60"
              >
                {aiLoading
                  ? "Asking AI..."
                  : selectedThread
                    ? "Ask AI about current thread"
                    : "Select a thread first"}
              </button>
            </div>
          </div>
        )}

        {tab === "ai" && (
          <div className="grid h-[560px] grid-rows-[auto,1fr,auto] gap-4 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  How can I help you today?
                </p>
                <p className="text-[11px] text-slate-500">
                  Ask Mekari AI anything about your current work or threads.
                </p>
              </div>
              {selectedThread && (
                <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] text-slate-600">
                  Current context: {selectedThread.title}
                </div>
              )}
            </div>
            <div className="space-y-3 overflow-y-auto text-[11px]">
              <div className="max-w-xl rounded-2xl bg-slate-100 px-3 py-2 text-slate-800">
                Hello! I can help you debug issues, reason about architecture
                choices, or suggest next steps for your project.
              </div>
              <div className="max-w-xl rounded-2xl bg-primary-600 px-3 py-2 text-white">
                Can you review my latest thread and highlight what I should
                improve?
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] outline-none placeholder:text-slate-400 focus:border-primary-500"
                  placeholder="Ask Mekari AI anything about your work…"
                />
                <button className="rounded-full bg-primary-600 px-5 py-2 text-[11px] font-medium text-white">
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

