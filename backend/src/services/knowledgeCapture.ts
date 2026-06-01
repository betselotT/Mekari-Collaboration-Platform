import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import { KnowledgeDoc } from "../models/KnowledgeDoc";
import * as intelligence from "../intelligence/client";

const FALLBACK_SUMMARY =
  "A technical question was raised on this thread. The community investigated the issue and identified the root cause. A solution was marked and the thread was resolved.";

async function captureKnowledgeLocally(input: {
  threadId: string;
  title: string;
  body: string;
  tags: string[];
  solution: string;
  aiResponse: Record<string, unknown>;
}) {
  if (!input.solution.trim()) return;

  await KnowledgeDoc.updateOne(
    { questionId: input.threadId },
    {
      $setOnInsert: {
        questionId: input.threadId,
        title: input.title,
        body: input.body,
        tags: input.tags,
        solution: input.solution,
        aiResponse: input.aiResponse,
        threadSummary: FALLBACK_SUMMARY,
      },
    },
    { upsert: true }
  );
}

export async function captureKnowledge(threadId: string): Promise<void> {
  try {
    const thread = await Thread.findById(threadId);
    if (!thread) return;

    const messages = await Message.find({ thread: threadId })
      .sort({ createdAt: 1 })
      .lean();

    const solutionMsg = thread.solutionMsgId
      ? messages.find((m) => String(m._id) === String(thread.solutionMsgId))
      : messages[messages.length - 1];

    const aiResponseDict = thread.aiResponse
      ? {
          explanation: thread.aiResponse.explanation,
          steps: thread.aiResponse.steps,
          suggestedSolution: thread.aiResponse.suggestedSolution,
          confidence: thread.aiResponse.confidence,
          resolved: thread.aiResponse.resolved,
        }
      : {};

    const input = {
      threadId,
      title: thread.title,
      body: thread.body ?? "",
      tags: [...new Set([thread.subject, ...thread.tags].filter(Boolean))],
      solution: solutionMsg?.body ?? "",
      aiResponse: aiResponseDict,
    };

    try {
      await intelligence.captureKnowledge({
        thread_id: input.threadId,
        title: input.title,
        body: input.body,
        subject: thread.subject,
        tags: input.tags,
        solution: input.solution,
        ai_response_dict: input.aiResponse,
      });
    } catch (err) {
      console.error("[captureKnowledge] intelligence service unavailable, using local fallback", err);
      await captureKnowledgeLocally(input);
    }
  } catch (err) {
    console.error("[captureKnowledge] error for thread", threadId, err);
  }
}
