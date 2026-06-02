"use client";

import { Hash } from "lucide-react";
import { Avatar } from "../ui/Avatar";

type SenderIdentity = {
  _id: string;
  name: string;
  avatarUrl?: string;
  role?: string;
};

type SenderIdentityAvatarProps = {
  sender?: SenderIdentity;
  align?: "left" | "right";
  initials: string;
};

function accountLabel(role?: string) {
  if (role === "expert") return "Mentor";
  if (role === "learner" || role === "user") return "Learner";
  return role || "User";
}

export function SenderIdentityAvatar({
  sender,
  align = "left",
  initials,
}: SenderIdentityAvatarProps) {
  if (!sender) {
    return <Avatar size="sm" initials={initials} />;
  }

  return (
    <span className="group relative inline-flex shrink-0" tabIndex={0}>
      <Avatar size="sm" src={sender.avatarUrl} initials={initials} />
      <span
        className={`pointer-events-none absolute bottom-full z-50 mb-2 hidden w-52 rounded-lg border border-neutral-200 bg-white p-3 text-left shadow-xl group-hover:block group-focus:block dark:border-neutral-700 dark:bg-neutral-900 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        <span className="block truncate text-sm font-bold text-neutral-900 dark:text-white">
          {sender.name}
        </span>
        <span className="mt-2 inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
          {accountLabel(sender.role)}
        </span>
        <span className="mt-3 flex items-center gap-1.5 border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <Hash className="h-3.5 w-3.5" />
          Account ...{sender._id.slice(-4)}
        </span>
      </span>
    </span>
  );
}
