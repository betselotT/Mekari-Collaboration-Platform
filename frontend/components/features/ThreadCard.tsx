"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { formatTechnicalTag, TranslationKey, useLanguage } from "../../lib/i18n";

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

const STATUS_BADGE: Record<string, { labelKey: TranslationKey; variant: "success" | "warning" | "info" | "default" | "error" | "primary" }> = {
  SOLVED: { labelKey: "threads.solved", variant: "success" },
  AI_RESOLVED: { labelKey: "threads.aiResolved", variant: "info" },
  PENDING_EXPERT: { labelKey: "threads.needsExpert", variant: "warning" },
  OPEN: { labelKey: "threads.open", variant: "default" },
  CLOSED: { labelKey: "threads.closed", variant: "error" },
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
  const { language, t } = useLanguage();
  const statusMeta = status ? STATUS_BADGE[status] : null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800">
      {/* Category + Status Badges */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Badge variant="info">{category}</Badge>
        {statusMeta && <Badge variant={statusMeta.variant}>{t(statusMeta.labelKey)}</Badge>}
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
              {formatTechnicalTag(tag, language)}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="sm" initials={author.split(" ").map(n => n[0]).join("")} />
          <div className="min-w-0 text-xs">
            <p className="truncate font-medium text-neutral-900 dark:text-white">{author}</p>
            <p className="truncate text-neutral-500 dark:text-neutral-400">{timestamp}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">{replyCount} {t("threads.replyLabel")}</span>
        </div>
      </div>
    </div>
  );
}
