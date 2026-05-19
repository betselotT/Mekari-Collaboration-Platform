"use client";

import { Star, StarHalf, MessageSquare, Sparkles } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

export interface ExpertCardProps {
  name: string;
  title: string;
  company: string;
  rating?: number;
  reviewCount?: number;
  image?: string;
  skills: string[];
  status: "available" | "available_in_2h" | "away";
  onConsult?: () => void;
  onDm?: () => void;
  onReviewsClick?: () => void;
}

export function ExpertCard(props: ExpertCardProps) {
  const {
    name,
    title,
    company,
    rating,
    reviewCount = 0,
    image,
    skills,
    status,
    onConsult,
    onDm,
    onReviewsClick,
  } = props;

  const statusConfig: Record<ExpertCardProps["status"], { color: string; dot: string; text: string }> = {
    available: {
      color: "border-emerald-200/70 bg-emerald-50/90 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
      dot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]",
      text: "Available now",
    },
    available_in_2h: {
      color: "border-amber-200/70 bg-amber-50/90 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
      dot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]",
      text: "Available soon",
    },
    away: {
      color: "border-neutral-200/80 bg-white/80 text-neutral-600 dark:border-white/10 dark:bg-white/10 dark:text-neutral-300",
      dot: "bg-neutral-400",
      text: "Away",
    },
  };

  const config = statusConfig[status];

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white/90 shadow-sm ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-500/10 hover:ring-emerald-200/70 dark:border-white/10 dark:bg-neutral-900/90 dark:hover:border-emerald-400/20 dark:hover:shadow-emerald-950/30 dark:hover:ring-emerald-400/20">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-8 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
      </div>

      {/* Header with status */}
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.22),transparent_26%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/85 to-transparent dark:from-neutral-900/90" />
        <div
          className={`absolute right-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full px-2 py-1 text-xs font-bold text-white ${config.color}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          {config.text}
        </div>
      </div>

      {/* Content */}
      <div className="relative px-5 pb-5">
        {/* Avatar */}
        <div className="mb-4 -mt-12 flex justify-center">
          <div className="rounded-full bg-white/80 p-1.5 shadow-xl shadow-neutral-900/10 ring-1 ring-white/80 backdrop-blur dark:bg-neutral-900/80 dark:ring-white/10">
            <Avatar
              size="xl"
              initials={initials}
              src={image}
              className="ring-4 ring-white shadow-lg dark:ring-neutral-900"
            />
          </div>
        </div>

        {/* Name and Title */}
        <div className="mb-4 text-center">
          <h3 className="break-words text-lg font-bold text-neutral-900 dark:text-white">{name}</h3>
          <p className="break-words text-sm text-neutral-600 dark:text-neutral-400">{title}</p>
          {company && (
            <p className="text-xs text-neutral-500 dark:text-neutral-500">at {company}</p>
          )}
        </div>

        {/* Rating */}
        <button
          type="button"
          onClick={onReviewsClick}
          className="mb-4 flex w-full items-center justify-center gap-1 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-2.5 text-sm shadow-inner shadow-white/40 transition-all hover:border-amber-200 hover:bg-amber-50/70 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:border-amber-400/20 dark:hover:bg-amber-400/10"
        >
          {reviewCount > 0 && typeof rating === "number" ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = i + 1 <= rating;
                const half = !filled && rating - i >= 0.5;
                const Icon = half ? StarHalf : Star;
                return (
                  <Icon
                    key={i}
                    className={`h-4 w-4 ${
                      filled || half
                        ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                        : "text-neutral-300 dark:text-neutral-600"
                    }`}
                  />
                );
              })}
              <span className="ml-2 font-bold text-neutral-950 dark:text-white">
                {rating.toFixed(1)}
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                ({reviewCount})
              </span>
            </>
          ) : (
            <span className="font-semibold text-neutral-500 dark:text-neutral-400">
              No reviews yet
            </span>
          )}
        </button>

        {/* Skills */}
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-cyan-200/70 bg-cyan-50/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-700 shadow-sm dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200"
            >
              {skill}
            </span>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 min-[360px]:flex-row">
          <Button variant="primary" className="flex-1" onClick={onConsult}>
            Consult
          </Button>
          <Button
            variant="secondary"
            className="flex-1 rounded-2xl shadow-sm transition-transform hover:scale-[1.02]"
            onClick={onDm}
          >
            <MessageSquare className="mr-1.5 inline h-4 w-4" />
            DM
          </Button>
        </div>
      </div>
    </div>
  );
}
