"use client";

import { useEffect, useState } from "react";
import { format, parse } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "~/lib/auth-context";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "~/lib/firebase";
import Link from "next/link";
import Strings from "~/constants/strings";
import { use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function SnippetPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  // Use React.use to unwrap the params promise
  const resolvedParams = use(params);
  const dateParam = resolvedParams.date;

  const [snippet, setSnippet] = useState("");
  const [originalSnippet, setOriginalSnippet] = useState(""); // 원본 스니펫 저장
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const { user } = useAuth();

  // Format date from URL param (yyyy-MM-dd)
  const date = parse(dateParam, "yyyy-MM-dd", new Date());
  const formattedDate = format(date, "yyyy-MM-dd");
  const displayDate = format(date, "yyyy년 MM월 dd일", { locale: ko });

  // Check if the date is today
  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = formattedDate === today;
  const [snippetExists, setSnippetExists] = useState(false);

  // Load the snippet from Firestore
  useEffect(() => {
    async function loadSnippet() {
      if (!user) return;

      setIsLoading(true);
      try {
        const userId = user.uid;
        const snippetId = `${userId}_${formattedDate}`;
        const snippetRef = doc(db, "snippets", snippetId);
        const snippetDoc = await getDoc(snippetRef);

        if (snippetDoc.exists()) {
          const snippetText = snippetDoc.data().snippet;
          setSnippet(snippetText);
          setOriginalSnippet(snippetText); // 원본 스니펫 저장
          setSnippetExists(true);
        } else {
          setSnippet("");
          setOriginalSnippet(""); // 빈 스니펫도 원본으로 저장
          setSnippetExists(false);
          // If it's today and no snippet exists, automatically enter edit mode
          if (isToday) {
            setIsEditMode(true);
          }
        }
      } catch (error) {
        console.error("Error loading snippet:", error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSnippet();
  }, [formattedDate, user, isToday]);

  // Save the snippet to Firestore
  const handleSave = async () => {
    if (!isEditMode || !user || !isToday) return;

    setIsSaving(true);
    try {
      const userId = user.uid;
      const snippetId = `${userId}_${formattedDate}`;
      const now = new Date();

      // Check if the snippet already exists
      const snippetRef = doc(db, "snippets", snippetId);
      const snippetDoc = await getDoc(snippetRef);

      if (snippetDoc.exists()) {
        // Update existing snippet
        await setDoc(
          snippetRef,
          {
            snippet: snippet,
            modified_at: now,
          },
          { merge: true },
        );
      } else {
        // Create new snippet
        await setDoc(snippetRef, {
          snippetId,
          userId,
          date: formattedDate,
          snippet,
          created_at: now,
          modified_at: now,
        });
      }

      setOriginalSnippet(snippet); // 저장 후 원본 업데이트
      setSnippetExists(true);
      setIsEditMode(false); // Return to view mode after saving
    } catch (error) {
      console.error("Error saving snippet:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // 취소 버튼 - 원본 내용으로 복원
  const handleCancel = () => {
    // 원본 스니펫으로 복원
    setSnippet(originalSnippet);
    setIsEditMode(false); // 보기 모드로 돌아가기
  };

  // Keyboard shortcuts for saving (Ctrl+Enter or Command+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (isEditMode && isToday) {
          void handleSave();
        }
      } else if (e.key === "Escape" && isEditMode) {
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [snippet, isEditMode, isToday]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">
          {displayDate} 스니펫
        </h1>
        <Link
          href="/"
          className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition hover:bg-gray-200"
        >
          {Strings.returnToCalendar}
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {isEditMode ? (
            // Edit Mode - Plain text editor
            <div className="p-4">
              <div className="mb-2 text-sm text-gray-500">
                <div>{Strings.markdownSupported}</div>
                <div className="rounded-md bg-gray-50 p-2 font-mono text-xs whitespace-pre text-gray-400">
                  {Strings.markdownSyntaxGuide}
                </div>
              </div>
              <textarea
                value={snippet}
                onChange={(e) => setSnippet(e.target.value)}
                className="mb-4 h-80 w-full resize-none rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder={Strings.snippetPlaceholder}
              ></textarea>

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition hover:bg-gray-200"
                >
                  {Strings.cancelEdit}
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className={`rounded-md px-4 py-2 text-white transition ${
                    isSaving
                      ? "cursor-not-allowed bg-blue-400"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isSaving ? Strings.savingSnippet : Strings.saveSnippet}
                </button>
              </div>
            </div>
          ) : (
            // View Mode - Markdown renderer
            <div className="p-4">
              {snippetExists ? (
                <article className="prose prose-slate max-w-none p-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1
                          className="mt-4 mb-2 text-2xl font-bold"
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2
                          className="mt-4 mb-2 text-xl font-bold"
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3
                          className="mt-3 mb-2 text-lg font-bold"
                          {...props}
                        />
                      ),
                      h4: ({ node, ...props }) => (
                        <h4
                          className="mt-3 mb-1 text-base font-bold"
                          {...props}
                        />
                      ),
                      h5: ({ node, ...props }) => (
                        <h5
                          className="mt-2 mb-1 text-sm font-bold"
                          {...props}
                        />
                      ),
                      h6: ({ node, ...props }) => (
                        <h6
                          className="mt-2 mb-1 text-xs font-bold"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="my-2 list-disc pl-5" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="my-2 list-decimal pl-5" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="my-1" {...props} />
                      ),
                      a: ({ node, ...props }) => (
                        <a
                          className="text-blue-500 hover:underline"
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="my-2" {...props}
                        />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote
                          className="my-2 border-l-4 border-gray-300 pl-4 italic"
                          {...props}
                        />
                      ),
                      code: ({ node, ...props }) => (
                        <code
                          className="rounded bg-gray-100 px-1 py-0.5"
                          {...props}
                        />
                      ),
                      pre: ({ node, ...props }) => (
                        <pre
                          className="overflow-auto rounded bg-gray-100 p-3"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {snippet}
                  </ReactMarkdown>
                </article>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center text-gray-500">
                  {isToday ? Strings.noSnippetToday : Strings.noSnippetForDate}
                </div>
              )}

              {isToday && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                  >
                    {snippetExists
                      ? Strings.editSnippet
                      : Strings.createSnippet}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
