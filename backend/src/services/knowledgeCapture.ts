import { Thread } from "../models/Thread";
import { Message } from "../models/Message";
import * as intelligence from "../intelligence/client";

export async function captureKnowledge(threadId: string): Promise<void> {
  try {
    const thread = await Thread.findById(threadId);
    if (!thread) return;

    const messages = await Message.find({ thread: threadId })
      .sort({ createdAt: 1 })
      .populate("sender", "name")
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

    await intelligence.captureKnowledge({
      thread_id: threadId,
      title: thread.title,
      body: thread.body ?? "",
      subject: thread.subject,
      tags: [...new Set([thread.subject, ...thread.tags].filter(Boolean))],
      solution: solutionMsg?.body ?? "",
      ai_response_dict: aiResponseDict,
    });
  } catch (err) {
    console.error("[captureKnowledge] error for thread", threadId, err);
  }
}
