"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArrowLeft, ArrowRight, MessageSquareText, Search, Tag, X } from "lucide-react";
import { apiClient } from "../../lib/api";
import { formatTechnicalTag, useLanguage } from "../../lib/i18n";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ThreadCard } from "./ThreadCard";

type SearchThread = {
  _id: string;
  title: string;
  subject?: string;
  body?: string;
  preview?: string;
  tags?: string[];
  status?: string;
  messageCount?: number;
  updatedAt?: string;
  createdAt?: string;
  createdBy?: {
    name?: string;
  };
};

type KnowledgeDoc = {
  _id: string;
  questionId?: string;
  title: string;
  tags?: string[];
  threadSummary?: string;
  solution?: string;
};

type SearchResults = {
  threads: SearchThread[];
  knowledgeDocs: KnowledgeDoc[];
  total: number;
  knowledgeTotal: number;
  totalResults: number;
  pages: number;
  knowledgePages: number;
};

const EMPTY_RESULTS: SearchResults = {
  threads: [],
  knowledgeDocs: [],
  total: 0,
  knowledgeTotal: 0,
  totalResults: 0,
  pages: 0,
  knowledgePages: 0,
};

function parseTagInput(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

export function ThreadRepositorySearch({
  onSearchStateChange,
}: {
  onSearchStateChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t } = useLanguage();
  const activeQuery = searchParams?.get("q") || "";
  const activeTags = searchParams?.get("tags") || "";
  const activePage = Math.max(1, Number.parseInt(searchParams?.get("searchPage") || "1", 10) || 1);
  const [query, setQuery] = useState(activeQuery);
  const [tagInput, setTagInput] = useState(activeTags);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTags = useMemo(() => parseTagInput(activeTags), [activeTags]);
  const hasSearch = Boolean(activeQuery.trim() || selectedTags.length);
  const totalPages = Math.max(results.pages, results.knowledgePages);

  function navigate(nextQuery: string, nextTags: string[], page = 1) {
    const params = new URLSearchParams(searchParams?.toString());
    params.delete("q");
    params.delete("tags");
    params.delete("searchPage");
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextTags.length) params.set("tags", nextTags.join(","));
    if (page > 1) params.set("searchPage", String(page));
    const search = params.toString();
    router.push(search ? `/dashboard/threads?${search}` : "/dashboard/threads");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(query, parseTagInput(tagInput));
  }

  function clearSearch() {
    setQuery("");
    setTagInput("");
    navigate("", []);
  }

  function searchTag(tag: string) {
    const tags = [...new Set([...selectedTags, tag])];
    setTagInput(tags.join(", "));
    navigate(activeQuery, tags);
  }

  useEffect(() => {
    onSearchStateChange?.(hasSearch);
  }, [hasSearch, onSearchStateChange]);

  useEffect(() => {
    setQuery(activeQuery);
    setTagInput(activeTags);

    if (!hasSearch) {
      setResults(EMPTY_RESULTS);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    apiClient
      .get<SearchResults>("/api/search", {
        params: {
          q: activeQuery || undefined,
          tags: activeTags || undefined,
          page: activePage,
        },
      })
      .then((response) => {
        if (active) setResults({ ...EMPTY_RESULTS, ...response.data });
      })
      .catch((err) => {
        if (!active) return;
        setResults(EMPTY_RESULTS);
        setError(err?.response?.data?.error?.message || t("Search failed. Please try again."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activePage, activeQuery, activeTags, hasSearch, t]);

  return (
    <section className="mb-6">
      <form
        onSubmit={submitSearch}
        className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 sm:flex-row sm:items-center"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("Search threads and solved answers")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search threads and solved answers")}
            className="w-full rounded-lg border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:bg-neutral-50 dark:text-neutral-100 dark:focus:bg-neutral-800"
          />
        </label>
        <label className="relative min-w-0 sm:w-64">
          <span className="sr-only">{t("Filter by tags")}</span>
          <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder={t("Filter by tags")}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="flex-1 sm:flex-none">
            {t("Search")}
          </Button>
          {hasSearch && (
            <Button type="button" variant="outline" size="sm" onClick={clearSearch} title={t("Clear search")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {selectedTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {t("Filtering tags")}
          </span>
          {selectedTags.map((tag) => (
            <Badge key={tag}>{formatTechnicalTag(tag, language)}</Badge>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {hasSearch && (
        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("Searching...")}</p>
          ) : results.totalResults === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t("No threads or solved answers matched your search.")}
            </p>
          ) : (
            <div className="space-y-7">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t("{count} search results", { count: results.totalResults })}
              </p>
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    <h3 className="font-bold text-neutral-950 dark:text-white">{t("Knowledge repository")}</h3>
                  </div>
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {results.knowledgeTotal} {t("results")}
                  </span>
                </div>

                {results.knowledgeDocs.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                    {t("No captured solutions matched.")}
                  </p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {results.knowledgeDocs.map((doc) => (
                      <article key={doc._id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-950">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <h4 className="font-bold text-neutral-950 dark:text-white">{doc.title}</h4>
                          <Badge variant="primary">{t("Knowledge")}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                          {doc.threadSummary || doc.solution || t("Captured solution document")}
                        </p>
                        {doc.solution && doc.threadSummary && (
                          <p className="mt-3 line-clamp-3 text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-semibold">{t("Solution")}:</span> {doc.solution}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(doc.tags || []).map((tag) => (
                            <button key={tag} type="button" onClick={() => searchTag(tag)}>
                              <Badge className="transition-colors hover:bg-primary-100 hover:text-primary-800 dark:hover:bg-primary-900 dark:hover:text-primary-200">
                                {formatTechnicalTag(tag, language)}
                              </Badge>
                            </button>
                          ))}
                        </div>
                        {doc.questionId && (
                          <Link href={`/dashboard/threads/${doc.questionId}`} className="mt-4 inline-flex text-sm font-semibold text-primary-600 hover:underline dark:text-primary-400">
                            {t("Open source thread")}
                          </Link>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    <h3 className="font-bold text-neutral-950 dark:text-white">{t("Active threads")}</h3>
                  </div>
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {results.total} {t("results")}
                  </span>
                </div>

                {results.threads.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                    {t("No active threads matched.")}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {results.threads.map((thread) => (
                      <ThreadCard
                        key={thread._id}
                        title={thread.title}
                        category={String(thread.subject || t("threads.defaultCategory")).toUpperCase()}
                        description={thread.preview || thread.body || t("threads.defaultDescription")}
                        author={thread.createdBy?.name || t("threads.unknownAuthor")}
                        timestamp={new Date(thread.updatedAt || thread.createdAt || Date.now()).toLocaleString()}
                        replyCount={Math.max(0, (thread.messageCount || 1) - 1)}
                        tags={thread.tags || []}
                        status={thread.status}
                        href={`/dashboard/threads/${thread._id}`}
                      />
                    ))}
                  </div>
                )}
              </section>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activePage <= 1}
                    onClick={() => navigate(activeQuery, selectedTags, activePage - 1)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("Previous")}
                  </Button>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {t("Page {page} of {pages}", { page: activePage, pages: totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activePage >= totalPages}
                    onClick={() => navigate(activeQuery, selectedTags, activePage + 1)}
                  >
                    {t("Next")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
