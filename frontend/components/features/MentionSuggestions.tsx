"use client";

import { AtSign } from "lucide-react";

export type MentionCandidate = {
  _id: string;
  name: string;
  role?: string;
};

type MentionSuggestionsProps = {
  candidates: MentionCandidate[];
  currentUserId?: string;
  value: string;
  onSelect: (value: string, userId: string) => void;
};

function activeMention(value: string) {
  const match = value.match(/(^|\s)@([^@\n]*)$/);
  if (!match) return null;

  return {
    start: value.length - match[0].length + match[1].length,
    query: match[2].trim().toLowerCase(),
  };
}

export function MentionSuggestions({
  candidates,
  currentUserId,
  value,
  onSelect,
}: MentionSuggestionsProps) {
  const mention = activeMention(value);
  if (!mention) return null;

  const candidateById = new Map(
    candidates
      .filter((candidate) => candidate._id && candidate.name && candidate._id !== currentUserId)
      .map((candidate) => [candidate._id, candidate])
  );
  const nameCounts = new Map<string, number>();
  for (const candidate of candidateById.values()) {
    const name = candidate.name.toLowerCase();
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }
  const matches = Array.from(candidateById.values()).filter((candidate) =>
    candidate.name.toLowerCase().includes(mention.query)
  );
  if (matches.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-sm overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
      {matches.slice(0, 6).map((candidate) => (
        <button
          key={candidate._id}
          type="button"
          onClick={() => onSelect(`${value.slice(0, mention.start)}@${candidate.name} `, candidate._id)}
          className="flex w-full items-center gap-2 border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
        >
          <AtSign className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
          <span className="min-w-0 truncate text-sm font-medium text-neutral-900 dark:text-white">
            {candidate.name}
          </span>
          {(candidate.role || nameCounts.get(candidate.name.toLowerCase()) !== 1) && (
            <span className="ml-auto text-xs capitalize text-neutral-500">
              {nameCounts.get(candidate.name.toLowerCase()) === 1
                ? candidate.role
                : `Account ...${candidate._id.slice(-4)}`}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
