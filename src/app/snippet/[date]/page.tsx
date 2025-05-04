"use client";

import { useEffect, useState } from "react";
import { format, parse } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "~/lib/auth-context";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "~/lib/firebase";
import Link from "next/link";
import Strings from "~/constants/strings";
import { use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Types for snippet data and user profiles
interface SnippetData {
  snippetId: string;
  userId: string;
  userEmail: string;
  date: string;
  snippet: string;
  created_at: Date;
  modified_at: Date;
  teamName: string;
}

interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
}

export default function SnippetPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  // Use React.use to unwrap the params promise
  const resolvedParams = use(params);
  const dateParam = resolvedParams.date;

  const [mySnippet, setMySnippet] = useState<SnippetData | null>(null);
  const [allSnippets, setAllSnippets] = useState<SnippetData[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>(
    {},
  );
  const [snippet, setSnippet] = useState(""); // Current editing snippet content
  const [originalSnippet, setOriginalSnippet] = useState(""); // 원본 스니펫 저장
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSnippets, setIsLoadingSnippets] = useState(true);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const { user, teamName } = useAuth();

  // Format date from URL param (yyyy-MM-dd)
  const date = parse(dateParam, "yyyy-MM-dd", new Date());
  const formattedDate = format(date, "yyyy-MM-dd");
  const displayDate = format(date, "yyyy년 MM월 dd일", { locale: ko });

  // Check if the date is today
  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = formattedDate === today;
  const [snippetExists, setSnippetExists] = useState(false);

  // Function to fetch user profiles for a set of email addresses
  const fetchUserProfiles = async (emails: Set<string>) => {
    if (emails.size === 0) return;

    setIsLoadingProfiles(true);
    try {
      const emailsArray = Array.from(emails);

      // Firebase allows up to 10 items in an 'in' clause, so we might need to batch queries
      const batchSize = 10;
      const batches = [];

      for (let i = 0; i < emailsArray.length; i += batchSize) {
        const batch = emailsArray.slice(i, i + batchSize);
        batches.push(batch);
      }

      const profiles: Record<string, UserProfile> = {};

      // Process each batch
      for (const batch of batches) {
        const usersQuery = query(
          collection(db, "users"),
          where("email", "in", batch),
        );

        const querySnapshot = await getDocs(usersQuery);

        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.email) {
            profiles[userData.email] = {
              email: userData.email,
              displayName: userData.displayName,
              photoURL: userData.photoURL,
            };
          }
        });
      }

      setUserProfiles(profiles);
    } catch (error) {
      console.error("Error fetching user profiles:", error);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  // Load all snippets for the date from Firestore
  useEffect(() => {
    async function loadAllSnippets() {
      // Always start with loading state
      setIsLoadingSnippets(true);

      // Check if user is logged in
      if (!user) {
        setIsLoadingSnippets(false);
        return;
      }

      try {
        // Even if teamName is not available, we can still show the edit interface for today
        if (!teamName) {
          // If it's today, we can still allow creating a snippet
          if (isToday) {
            setMySnippet(null);
            setSnippet("");
            setOriginalSnippet("");
            setSnippetExists(false);
            setIsEditMode(true);
            setAllSnippets([]);
          }
          setIsLoadingSnippets(false);
          return;
        }

        // Query all snippets for this date in the team
        const snippetsQuery = query(
          collection(db, "snippets"),
          where("teamName", "==", teamName),
          where("date", "==", formattedDate),
        );

        const querySnapshot = await getDocs(snippetsQuery);
        const snippetsArray: SnippetData[] = [];
        const emails = new Set<string>();
        let foundMySnippet = false;

        querySnapshot.forEach((doc) => {
          const data = doc.data() as SnippetData;
          snippetsArray.push({
            ...data,
            created_at:
              data.created_at instanceof Date
                ? data.created_at
                : new Date(data.created_at),
            modified_at:
              data.modified_at instanceof Date
                ? data.modified_at
                : new Date(data.modified_at),
          });

          // Add email to the set for fetching profiles
          if (data.userEmail) {
            emails.add(data.userEmail);
          }

          // Check if this is the current user's snippet
          if (data.userId === user.uid) {
            setMySnippet(data);
            setSnippet(data.snippet);
            setOriginalSnippet(data.snippet);
            foundMySnippet = true;
            setSnippetExists(true);
          }
        });

        // Sort snippets: current user first, others by modified_at in ascending order
        snippetsArray.sort((a, b) => {
          // Current user's snippet always comes first
          if (a.userId === user.uid) return -1;
          if (b.userId === user.uid) return 1;

          // Otherwise sort by modified_at (ascending)
          return a.modified_at.getTime() - b.modified_at.getTime();
        });

        setAllSnippets(snippetsArray);

        // If no snippets found for the user and it's today, enter edit mode
        if (!foundMySnippet) {
          setMySnippet(null);
          setSnippet("");
          setOriginalSnippet("");
          setSnippetExists(false);

          if (isToday) {
            setIsEditMode(true);
          }
        }

        // Fetch user profiles for all the emails
        if (emails.size > 0) {
          await fetchUserProfiles(emails);
        }
      } catch (error) {
        console.error("Error loading snippets:", error);
      } finally {
        // Always set loading to false at the end
        setIsLoadingSnippets(false);
      }
    }

    void loadAllSnippets();
  }, [formattedDate, user, teamName, isToday]);

  // Save the snippet to Firestore
  const handleSave = async () => {
    if (!isEditMode || !user || !isToday) return;

    setIsSaving(true);
    try {
      const userId = user.uid;
      const userEmail = user.email;
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
            teamName: teamName, // Add team name
            userEmail: userEmail, // Add user email
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
          teamName: teamName, // Add team name
          userEmail: userEmail, // Add user email
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
        <h1 className="text-2xl font-semibold text-gray-800">{displayDate}</h1>
        <Link
          href="/"
          className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition hover:bg-gray-200"
        >
          {Strings.returnToCalendar}
        </Link>
      </div>

      {isLoadingSnippets ? (
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
            // View Mode - Show all snippets for this date
            <div className="space-y-6 p-4">
              {allSnippets.length > 0 ? (
                allSnippets.map((snippetData, index) => {
                  const isMySnippet = user && snippetData.userId === user.uid;
                  const userProfile = snippetData.userEmail
                    ? userProfiles[snippetData.userEmail]
                    : undefined;

                  return (
                    <div
                      key={snippetData.snippetId}
                      className="mb-6 border-b border-gray-100 pb-6 last:mb-0 last:border-b-0 last:pb-0"
                    >
                      {/* Show edit button for my snippet if it's today */}
                      {isMySnippet && isToday && (
                        <div className="mb-2 flex justify-end">
                          <button
                            onClick={() => {
                              setSnippet(snippetData.snippet);
                              setIsEditMode(true);
                            }}
                            className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition hover:bg-blue-700"
                          >
                            {Strings.editSnippet}
                          </button>
                        </div>
                      )}

                      {/* User info row with avatar and name */}
                      <div className="mb-3 flex items-center">
                        <div className="mr-2 h-8 w-8 overflow-hidden rounded-full border border-gray-200">
                          {userProfile?.photoURL ? (
                            <img
                              src={userProfile.photoURL}
                              alt={
                                userProfile.displayName || snippetData.userEmail
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-blue-500 text-white">
                              {(
                                (
                                  userProfile?.displayName ??
                                  snippetData.userEmail ??
                                  "?"
                                ).charAt(0) ?? "?"
                              ).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="font-medium">
                          {userProfile?.displayName || snippetData.userEmail}
                        </div>
                      </div>

                      {/* Snippet content */}
                      <article className="prose prose-slate max-w-none pl-10">
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
                              <ol
                                className="my-2 list-decimal pl-5"
                                {...props}
                              />
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
                              <p className="my-2" {...props} />
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
                          {snippetData.snippet}
                        </ReactMarkdown>
                      </article>
                    </div>
                  );
                })
              ) : (
                <div className="flex min-h-[200px] items-center justify-center text-gray-500">
                  {isToday ? Strings.noSnippetToday : Strings.noSnippetForDate}
                </div>
              )}

              {/* Show create button for today if user doesn't have a snippet yet */}
              {isToday && !mySnippet && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                  >
                    {Strings.createSnippet}
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
