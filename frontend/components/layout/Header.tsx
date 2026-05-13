"use client";

import { Bell, MessageCircle, User, Search } from "lucide-react";
import { ThemeToggle } from "../theme/ThemeToggle";

interface HeaderProps {
  title?: string;
  searchPlaceholder?: string;
}

export function Header({ title = "Dashboard", searchPlaceholder = "Search..." }: HeaderProps) {
  return (
    <header className="fixed right-0 top-0 z-30 flex h-16 w-[calc(100%-240px)] items-center justify-between border-b border-neutral-200 bg-white px-8 dark:border-neutral-700 dark:bg-neutral-900">
      {/* Left side - Title and Search */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-white">{title}</h1>
        <div className="relative hidden md:flex">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="input pl-10"
            style={{ width: "300px" }}
          />
        </div>
      </div>

      {/* Right side - Actions and Profile */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors dark:text-neutral-400 dark:hover:bg-neutral-800">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        
        <button className="relative p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors dark:text-neutral-400 dark:hover:bg-neutral-800">
          <MessageCircle className="h-5 w-5" />
        </button>

        <ThemeToggle />

        <div className="ml-2 flex items-center gap-3 border-l border-neutral-200 pl-4 dark:border-neutral-700">
          <div className="text-right">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">Alex Mekari</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">Administrator</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-400 to-red-500 flex items-center justify-center text-white font-bold">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
