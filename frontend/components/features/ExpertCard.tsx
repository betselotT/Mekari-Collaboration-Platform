"use client";

import { Star, MessageSquare } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export interface ExpertCardProps {
  name: string;
  title: string;
  company: string;
  rating: number;
  image?: string;
  skills: string[];
  status: "available" | "available_in_2h" | "away";
  onConsult?: () => void;
  onDm?: () => void;
}

export function ExpertCard(props: ExpertCardProps) {
  const { name, title, company, rating, image, skills, status, onConsult, onDm } = props;

  const statusConfig: Record<ExpertCardProps["status"], { color: string; text: string }> = {
    available: { color: "bg-emerald-500", text: "AVAILABLE NOW" },
    available_in_2h: { color: "bg-amber-500", text: "AVAILABLE SOON" },
    away: { color: "bg-neutral-400", text: "AWAY" },
  };

  const config = statusConfig[status];

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white transition-all hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800">
      {/* Header with status */}
      <div className="relative h-32 bg-gradient-to-br from-emerald-300 to-teal-400">
        <div
          className={`absolute top-3 right-3 rounded-full px-2 py-1 text-xs font-bold text-white ${config.color}`}
        >
          {config.text}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="mb-4 -mt-16 flex justify-center">
          <Avatar size="lg" initials={initials} src={image} />
        </div>

        {/* Name and Title */}
        <div className="mb-4 text-center">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{name}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{title}</p>
          {company && (
            <p className="text-xs text-neutral-500 dark:text-neutral-500">at {company}</p>
          )}
        </div>

        {/* Rating */}
        <div className="mb-4 flex items-center justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < Math.floor(rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-neutral-300 dark:text-neutral-600"
              }`}
            />
          ))}
          <span className="ml-2 text-sm font-semibold text-neutral-900 dark:text-white">
            {rating.toFixed(1)}
          </span>
        </div>

        {/* Skills */}
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {skills.slice(0, 4).map((skill) => (
            <Badge key={skill} variant="info">
              {skill.toUpperCase()}
            </Badge>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={onConsult}>
            Consult
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onDm}>
            <MessageSquare className="mr-1.5 inline h-4 w-4" />
            DM
          </Button>
        </div>
      </div>
    </div>
  );
}
