"use client";

import { Star, StarHalf, MessageSquare, Sparkles } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { useLanguage } from "../../lib/i18n";

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
  const { t } = useLanguage();
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
      color: "border-cyan-200 bg-cyan-50/80 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300",
      dot: "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)] animate-pulse",
      text: "Available now",
    },
    available_in_2h: {
      color: "border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
      dot: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
      text: "Available soon",
    },
    away: {
      color: "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-white/5 dark:bg-white/5 dark:text-neutral-400",
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
    <div className="group relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-md hover:shadow-primary-500/5 dark:border-neutral-800/60 dark:bg-neutral-900">
      {/* Background glow on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/[0.02] to-cyan-500/[0.02] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header section with clean, modern purple gradient */}
      <div className="relative h-28 bg-gradient-to-br from-primary-600 to-indigo-600 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_40%)]" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent dark:from-neutral-900" />
        
        {/* Status Badge in Header */}
        <div
          className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm transition-colors duration-300 ${config.color}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          {t(config.text)}
        </div>
      </div>

      {/* Content */}
      <div className="relative px-5 pb-5">
        {/* Avatar */}
        <div className="mb-4 -mt-10 flex justify-center">
          <div className="rounded-full bg-white p-1 shadow-md dark:bg-neutral-900">
            <Avatar
              size="xl"
              initials={initials}
              src={image}
              className="ring-2 ring-neutral-100 dark:ring-neutral-800"
            />
          </div>
        </div>

        {/* Name and Title */}
        <div className="mb-4 text-center">
          <h3 className="break-words text-base font-bold text-neutral-900 dark:text-white transition-colors group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {name}
          </h3>
          <p className="break-words text-xs text-neutral-500 mt-0.5 dark:text-neutral-400">
            {title}
          </p>
          {company && (
            <p className="text-[11px] text-neutral-400 mt-1 dark:text-neutral-500 font-medium">
              at {company}
            </p>
          )}
        </div>

        {/* Rating Display */}
        <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          {reviewCount > 0 && typeof rating === "number" ? (
            <>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => {
                  const filled = i + 1 <= rating;
                  const half = !filled && rating - i >= 0.5;
                  const Icon = half ? StarHalf : Star;
                  return (
                    <Icon
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        filled || half
                          ? "fill-amber-400 text-amber-400"
                          : "text-neutral-200 dark:text-neutral-700"
                      }`}
                    />
                  );
                })}
              </div>
              <span className="font-bold text-neutral-800 dark:text-neutral-200">
                {rating.toFixed(1)}
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">•</span>
              <button
                type="button"
                onClick={onReviewsClick}
                className="font-medium text-primary-600 hover:text-primary-750 hover:underline dark:text-primary-400 dark:hover:text-primary-300 transition-colors focus:outline-none"
              >
                {reviewCount} {t(reviewCount === 1 ? "review" : "reviews")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onReviewsClick}
              className="inline-flex items-center gap-1 font-medium text-neutral-400 hover:text-primary-650 hover:underline dark:text-neutral-550 dark:hover:text-primary-400 transition-colors focus:outline-none"
            >
              <Sparkles className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-700" />
              <span>{t("Be the first to review")}</span>
            </button>
          )}
        </div>

        {/* Skills Tag Cloud */}
        <div className="mb-5 flex flex-wrap justify-center gap-1.5">
          {skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded-lg border border-primary-500/5 bg-primary-500/[0.03] px-2 py-0.5 text-[10px] font-semibold text-primary-600 dark:border-primary-400/10 dark:bg-primary-400/[0.03] dark:text-primary-300"
            >
              {skill}
            </span>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 min-[360px]:flex-row">
          <Button
            variant="primary"
            className="flex-1 rounded-xl bg-primary-600 text-white text-xs font-semibold shadow-sm transition-all hover:bg-primary-700 hover:scale-[1.01] active:scale-[0.99]"
            onClick={onConsult}
          >
            {t("Consult")}
          </Button>
          <Button
            variant="secondary"
            className="flex-1 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 hover:text-neutral-900 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            onClick={onDm}
          >
            <MessageSquare className="mr-1.5 inline h-3.5 w-3.5 opacity-80" />
            DM
          </Button>
        </div>
      </div>
    </div>
  );
}
