"use client";

import { DashboardLayout } from "../../../components/layout";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Zap, Send, Paperclip, Smile, Clock, CheckCircle, Info, AlertCircle } from "lucide-react";
import { useState } from "react";

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    {
      type: "ai",
      content: "Hello! I've loaded your current payroll configuration context. I can help you with formula adjustments, tax calculations, or generating summary reports. What would you like to start with?",
      timestamp: "Just now",
    },
    {
      type: "user",
      content: "Can you explain why the PPh 21 calculation for the marketing department changed this month?",
      timestamp: "2 mins ago",
    },
    {
      type: "ai",
      content: "Based on your requirements for 'complex state' and 'frequent updates', **Redux Toolkit (RTK)** is definitely the stronger choice. Here's why:\n\n**Performance:** RTK uses optimized selectors that prevent unnecessary re-renders.\n\n**DevTools:** Superior debugging experience with time-travel.\n\n**RTK Query:** Simplifies data fetching and caching significantly.\n\n**Context API** is better suited for low-frequency updates like themes or auth user info.",
      timestamp: "10:31 AM",
    },
  ]);

  const suggestions = [
    {
      icon: Clock,
      title: "Recalculate tax for Batch Q3",
      description: "Review changes in tax regulations for the current period.",
    },
    {
      icon: CheckCircle,
      title: "Generate Payroll Summary",
      description: "Create a PDF report of all disbursements for management.",
    },
    {
      icon: AlertCircle,
      title: "Validate Overtime Formulas",
      description: "Check if the new overtime policy is correctly implemented.",
    },
    {
      icon: Info,
      title: "Compare with Last Month",
      description: "View detailed variance report between Aug and Sep payroll.",
    },
  ];

  return (
    <DashboardLayout title="Mekari AI" searchPlaceholder="Search...">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <span>MEKARI</span>
        <span>›</span>
        <span>AI ASSISTANT</span>
      </div>

      {/* Main heading */}
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-neutral-900 dark:text-white">
          How can I help you today?
        </h2>
      </div>

      {/* Current Context Card */}
      <Card hoverable className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">Current Context</p>
            <p className="text-lg font-bold text-neutral-900 dark:text-white">
              Payroll Configuration • Batch Q3 2024
            </p>
          </div>
          <a href="#" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Change Context
          </a>
        </div>
      </Card>

      {/* Chat Area */}
      <div className="mb-8 h-96 rounded-lg border border-neutral-200 bg-neutral-50 p-6 overflow-y-auto dark:border-neutral-700 dark:bg-neutral-800">
        <div className="space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs rounded-lg px-4 py-3 ${
                  msg.type === "user"
                    ? "bg-primary-600 text-white"
                    : "bg-white text-neutral-900 dark:bg-neutral-700 dark:text-white"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`mt-2 text-xs ${
                    msg.type === "user"
                      ? "text-primary-100"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="mb-8">
        <h3 className="mb-4 text-sm font-semibold text-neutral-600 dark:text-neutral-400">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <Card key={suggestion.title} hoverable className="cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900">
                    <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-900 dark:text-white">
                      {suggestion.title}
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-8 right-8 left-60 max-w-md">
        <div className="flex gap-2 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <input
            type="text"
            placeholder="Ask Mekari AI anything about your payroll..."
            className="input flex-1 m-0 p-0 border-0"
          />
          <Button variant="primary" size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500 text-center dark:text-neutral-400">
          Mekari AI can make mistakes. Check important info.
        </p>
      </div>
    </DashboardLayout>
  );
}
