"use client";

import { useState } from "react";

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger button (mobile only) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="sm:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
        aria-label="메뉴 열기"
      >
        <span
          className={`block w-5 h-0.5 bg-[var(--color-text)] transition-transform ${
            isOpen ? "rotate-45 translate-y-1" : ""
          }`}
        />
        <span
          className={`block w-5 h-0.5 bg-[var(--color-text)] transition-opacity ${
            isOpen ? "opacity-0" : ""
          }`}
        />
        <span
          className={`block w-5 h-0.5 bg-[var(--color-text)] transition-transform ${
            isOpen ? "-rotate-45 -translate-y-1" : ""
          }`}
        />
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-white border-b border-[var(--color-border)] shadow-lg z-50">
          <nav className="flex flex-col px-4 py-4 gap-3">
            <a
              href="/"
              onClick={() => setIsOpen(false)}
              className="text-sm text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2"
            >
              블로그
            </a>
            <a
              href="https://ai-directory-seven.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="text-sm text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2"
            >
              AI 도구 디렉토리
            </a>
            <a
              href="https://apppro.kr"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="text-sm text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2"
            >
              홈페이지
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
