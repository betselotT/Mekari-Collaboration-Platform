"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import React from "react";

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  change?: number;
  description?: string;
}

export function StatCard({ icon: Icon, label, value, change, description }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
      {/* Header with icon */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
          {label}
        </h3>
        <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900">
          <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </div>
      </div>

      {/* Value */}
      <div className="mb-2">
        <p className="text-3xl font-bold text-neutral-900 dark:text-white">{value}</p>
      </div>

      {/* Change indicator */}
      {change !== undefined && (
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
              isPositive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(change)}%
          </div>
          {description && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
