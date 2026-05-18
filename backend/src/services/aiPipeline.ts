import { Thread, IThread } from "../models/Thread";
import { Notification } from "../models/Notification";
import { broadcastToRoom, broadcastToUser, roomName } from "./realtime";
import * as intelligence from "../intelligence/client";
import { findSimilarProblems } from "./similarProblems";

async function escalateFromAnalysis(
  thread: IThread,
  experts: intelligence.ExpertMatch[],
): Promise<void> {
  if (!experts.length) return;

  const expertIds = experts.map((e) => e.expert_id);
  await Thread.findByIdAndUpdate(thread._id, {
    $set: { matchedExperts: expertIds },
  });

  await broadcastToRoom(roomName("thread", String(thread._id)), "expert_matched", {
    threadId: String(thread._id),
    threadTitle: thread.title,
    subject: thread.subject,
    tags: thread.tags,
    experts,
  });

  for (const expert of experts) {
    const notif = await Notification.create({
      userId: expert.expert_id,
      type: "expert_matched",
      message: `You've been matched to help with: "${thread.title}"`,
      link: `/dashboard/threads/${String(thread._id)}`,
      read: false,
    });
    await broadcastToUser(String(expert.expert_id), "notification", {
      id: String(notif._id),
      type: notif.type,
      message: notif.message,
      link: notif.link,
      read: false,
      createdAt: notif.createdAt,
    });
  }
}

export async function runAIPipeline(threadId: string): Promise<void> {
  let thread: IThread | null = null;

  try {
    thread = await Thread.findById(threadId);
    if (!thread) return;

    const result = await intelligence.analyze({
      thread_id: threadId,
      title: thread.title,
      body: thread.body ?? "",
      subject: thread.subject,
      tags: thread.tags,
    });

    const { ai_response, escalation, suggested_tags, new_status } = result;
    const combinedTags = [...new Set([...thread.tags, ...suggested_tags])];
    const similarProblems = await findSimilarProblems({
      threadId,
      title: thread.title,
      body: thread.body ?? "",
      subject: thread.subject,
      tags: combinedTags,
      limit: 5,
    });

    await Thread.findByIdAndUpdate(threadId, {
      $set: {
        aiResponse: {
          explanation: ai_response.explanation,
          steps: ai_response.steps,
          suggestedSolution: ai_response.suggested_solution,
          confidence: ai_response.confidence,
          resolved: ai_response.resolved,
        },
        status: new_status,
        tags: combinedTags,
        similarProblems,
      },
    });

    await broadcastToRoom(roomName("thread", threadId), "ai_response_ready", {
      threadId,
      aiResponse: {
        explanation: ai_response.explanation,
        steps: ai_response.steps,
        suggestedSolution: ai_response.suggested_solution,
        confidence: ai_response.confidence,
        resolved: ai_response.resolved,
      },
      status: new_status,
    });

    await broadcastToRoom(roomName("thread", threadId), "similar_problems_ready", {
      threadId,
      similarProblems,
    });

    if (escalation.should_escalate) {
      await escalateFromAnalysis(thread, result.similar_problems.length > 0 ? [] : []);
      // Fetch matched experts from the analysis result
      if (result.similar_problems.length >= 0) {
        const experts = await intelligence.matchExperts({
          subject: thread.subject,
          tags: [...new Set([...thread.tags, ...suggested_tags])],
          requester_id: String(thread.createdBy),
          limit: 3,
        });
        await escalateFromAnalysis(thread, experts);
      }
    }
  } catch (err) {
    console.error("[aiPipeline] intelligence service error for thread", threadId, err);

    if (thread) {
      try {
        const similarProblems = await findSimilarProblems({
          threadId,
          title: thread.title,
          body: thread.body ?? "",
          subject: thread.subject,
          tags: thread.tags,
          limit: 5,
        });
        await Thread.findByIdAndUpdate(threadId, {
          $set: { similarProblems },
        });
        await broadcastToRoom(roomName("thread", threadId), "similar_problems_ready", {
          threadId,
          similarProblems,
        });
      } catch (similarErr) {
        console.error("[aiPipeline] similar problem fallback failed", similarErr);
      }
    }

    // Fallback: mark thread for expert review without AI response
    await Thread.findByIdAndUpdate(threadId, {
      $set: { status: "PENDING_EXPERT" },
    });

    await broadcastToRoom(roomName("thread", threadId), "ai_response_ready", {
      threadId,
      aiResponse: null,
      status: "PENDING_EXPERT",
      error: "Intelligence service unavailable",
    });
  }
}
