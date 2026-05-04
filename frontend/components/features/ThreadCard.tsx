"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";

export interface ThreadCardProps {
  title: string;
  category: string;
  description: string;
  author: string;
  timestamp: string;
  replyCount: number;
  avatars?: string[];
  tags?: string[];
  href?: string;
  status?: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "info" | "default" | "error" | "primary" }> = {
  SOLVED: { label: "Solved", variant: "success" },
  AI_RESOLVED: { label: "AI Resolved", variant: "info" },
  PENDING_EXPERT: { label: "Needs Expert", variant: "warning" },
  OPEN: { label: "Open", variant: "default" },
  CLOSED: { label: "Closed", variant: "error" },
};

export function ThreadCard({
  title,
  category,
  description,
  author,
  timestamp,
  replyCount,
  tags = [],
  href,
  status,
}: ThreadCardProps) {
  const statusMeta = status ? STATUS_BADGE[status] : null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800">
      {/* Category + Status Badges */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Badge variant="info">{category}</Badge>
        {statusMeta && <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>}
      </div>

      {/* Title */}
      {href ? (
        <Link href={href}>
          <h3 className="mb-2 text-base font-bold text-neutral-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400 cursor-pointer">
            {title}
          </h3>
        </Link>
      ) : (
        <h3 className="mb-2 text-base font-bold text-neutral-900 dark:text-white">
          {title}
        </h3>
      )}

      {/* Description */}
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
        {description}
      </p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {tags.map((tag) => (
            <Badge key={tag} variant="default" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <Avatar size="sm" initials={author.split(" ").map(n => n[0]).join("")} />
          <div className="text-xs">
            <p className="font-medium text-neutral-900 dark:text-white">{author}</p>
            <p className="text-neutral-500 dark:text-neutral-400">{timestamp}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">{replyCount} replies</span>
        </div>
      </div>
    </div>
  );
}
