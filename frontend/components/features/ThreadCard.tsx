"use client";

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
}

export function ThreadCard({
  title,
  category,
  description,
  author,
  timestamp,
  replyCount,
  tags = [],
}: ThreadCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800">
      {/* Category Badge */}
      <div className="mb-3">
        <Badge variant="info">{category}</Badge>
      </div>

      {/* Title */}
      <h3 className="mb-2 text-base font-bold text-neutral-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400 cursor-pointer">
        {title}
      </h3>

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
