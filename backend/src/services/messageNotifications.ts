import { User } from "../models/User";
import { createNotification } from "./notifications";

type MessageNotificationInput = {
  body: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  mentionedUserIds?: string[];
  parentSenderId?: string;
  link: string;
  contextLabel: string;
  defaultType: string;
  defaultTitle: string;
  defaultMessage: string;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueRecipientIds(recipientIds: string[], senderId: string) {
  return [...new Set(recipientIds.map(String))].filter((userId) => userId !== String(senderId));
}

async function mentionedRecipientIds(body: string, recipientIds: string[], selectedUserIds: string[]) {
  if (!body.includes("@") || recipientIds.length === 0) return new Set<string>();

  const users = await User.find({ _id: { $in: recipientIds } }).select("_id name").lean();
  const selectedIds = new Set(selectedUserIds.filter((userId) => recipientIds.includes(userId)));
  const nameCounts = new Map<string, number>();
  for (const user of users) {
    const name = user.name.trim().toLowerCase();
    if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  return new Set(
    users
      .filter((user) => {
        const name = user.name.trim();
        if (!name) return false;
        const hasVisibleMention = new RegExp(
          `(^|\\s)@${escapeRegex(name)}(?=$|[\\s.,!?;:()])`,
          "i"
        ).test(body);
        return (
          hasVisibleMention &&
          (selectedIds.has(String(user._id)) || nameCounts.get(name.toLowerCase()) === 1)
        );
      })
      .map((user) => String(user._id))
  );
}

export async function notifyMessageRecipients(input: MessageNotificationInput) {
  const recipientIds = uniqueRecipientIds(input.recipientIds, input.senderId);
  const mentionIds = await mentionedRecipientIds(input.body, recipientIds, input.mentionedUserIds || []);

  await Promise.all(
    recipientIds.map((userId) => {
      if (mentionIds.has(userId)) {
        return createNotification({
          userId,
          category: "chat",
          type: "mention",
          title: "You were mentioned",
          message: `${input.senderName} mentioned you in ${input.contextLabel}`,
          link: input.link,
        });
      }

      if (userId === String(input.parentSenderId || "")) {
        return createNotification({
          userId,
          category: "chat",
          type: "reply",
          title: "New reply",
          message: `${input.senderName} replied to your message in ${input.contextLabel}`,
          link: input.link,
        });
      }

      return createNotification({
        userId,
        category: "chat",
        type: input.defaultType,
        title: input.defaultTitle,
        message: input.defaultMessage,
        link: input.link,
      });
    })
  );
}
