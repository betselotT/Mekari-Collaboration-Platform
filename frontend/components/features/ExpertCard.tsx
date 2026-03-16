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
}

export function ExpertCard({
  name,
  title,
  company,
  rating,
  image,
  skills,
  status,
  onConsult,
}: ExpertCardProps) {
  const statusConfig = {
    available: { color: "bg-emerald-500", text: "AVAILABLE NOW" },
    available_in_2h: { color: "bg-amber-500", text: "AVAILABLE IN 2H" },
    away: { color: "bg-neutral-400", text: "AWAY" },
  };

  const config = statusConfig[status];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden transition-all hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800">
      {/* Header with status */}
      <div className="relative h-32 bg-gradient-to-br from-emerald-300 to-teal-400">
        <div className={`absolute top-3 right-3 rounded-full px-2 py-1 text-xs font-bold text-white ${config.color}`}>
          {config.text}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="flex justify-center -mt-16 mb-4">
          <Avatar size="lg" initials={name.split(" ").map(n => n[0]).join("")} />
        </div>

        {/* Name and Title */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{name}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{title}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500">at {company}</p>
        </div>

        {/* Rating */}
        <div className="flex items-center justify-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < Math.floor(rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-neutral-300 dark:text-neutral-600"
              }`}
            />
          ))}
          <span className="ml-2 text-sm font-semibold text-neutral-900 dark:text-white">{rating}</span>
        </div>

        {/* Skills */}
        <div className="mb-4 flex flex-wrap gap-2 justify-center">
          {skills.map((skill) => (
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
          <button className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-50 dark:hover:bg-neutral-700">
            <MessageSquare className="h-4 w-4 inline mr-2" />
          </button>
        </div>
      </div>
    </div>
  );
}
