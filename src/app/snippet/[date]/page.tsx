"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  deleteDoc,
} from "firebase/firestore";
import { db } from "~/lib/firebase";
import Link from "next/link";
import Strings from "~/constants/strings";
import { use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";

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
  // isLoadingProfiles 상태는 내부적으로 사용됨
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previousSnippet, setPreviousSnippet] = useState<string | null>(null);
  const [previousSnippetPlaceholder, setPreviousSnippetPlaceholder] = useState<
    string | null
  >(null);
  const [hasFetchedPrevious, setHasFetchedPrevious] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user, teamName } = useAuth();

  // Format date from URL param (yyyy-MM-dd)
  const date = parse(dateParam, "yyyy-MM-dd", new Date());
  const formattedDate = format(date, "yyyy-MM-dd");
  const displayDate = format(date, "yyyy년 MM월 dd일", { locale: ko });

  // Check if the date is today
  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = formattedDate === today;

  // Calculate yesterday's date
  const yesterday = format(
    new Date(new Date().setDate(new Date().getDate() - 1)),
    "yyyy-MM-dd",
  );
  const isYesterday = formattedDate === yesterday;

  // Function to check if editing is allowed based on time (today or yesterday before 09:00 KST)
  const isEditingAllowed = useCallback(() => {
    if (isToday) return true;

    if (isYesterday) {
      // Check if current time is before 09:00 KST
      const now = new Date();
      // Create a date object with KST timezone offset (+9 hours)
      const kstNow = new Date(
        now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000,
      );
      const kstHours = kstNow.getHours();

      return kstHours < 9; // Allow editing if before 09:00 KST
    }

    return false;
  }, [isToday, isYesterday]);

  const [snippetExists, setSnippetExists] = useState(false);

  // Function to fetch user profiles for a set of email addresses
  const fetchUserProfiles = useCallback(async (emails: Set<string>) => {
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
              displayName: userData.displayName ?? undefined,
              photoURL: userData.photoURL ?? undefined,
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
  }, []);

  // Function to fetch the most recent snippet (not just yesterday's)
  const fetchMostRecentSnippet = useCallback(async () => {
    if (!user || !teamName || !isToday || hasFetchedPrevious || snippetExists)
      return;

    try {
      // Query to find the user's most recent snippet
      const snippetsQuery = query(
        collection(db, "snippets"),
        where("userId", "==", user.uid),
        where("teamName", "==", teamName),
        // Date earlier than today
        where("date", "<", formattedDate),
      );

      const querySnapshot = await getDocs(snippetsQuery);

      if (querySnapshot.empty) {
        // Use snippet template if no previous snippet exists
        setPreviousSnippet(Strings.snippetTemplate);
        setPreviousSnippetPlaceholder(Strings.snippetTemplate);
        return;
      }

      // Find the most recent snippet by comparing dates
      let mostRecentDate = "";
      let mostRecentSnippetText = "";

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const snippetDate = data.date || "";
        const snippetText = data.snippet || "";

        if (!mostRecentDate || snippetDate > mostRecentDate) {
          mostRecentDate = snippetDate;
          mostRecentSnippetText = snippetText;
        }
      });

      if (mostRecentSnippetText) {
        setPreviousSnippet(mostRecentSnippetText);
        setPreviousSnippetPlaceholder(mostRecentSnippetText);
      } else {
        // Fallback to template
        setPreviousSnippet(Strings.snippetTemplate);
        setPreviousSnippetPlaceholder(Strings.snippetTemplate);
      }
    } catch (error) {
      console.error("Error fetching most recent snippet:", error);
      // Use template in case of error
      setPreviousSnippet(Strings.snippetTemplate);
      setPreviousSnippetPlaceholder(Strings.snippetTemplate);
    } finally {
      setHasFetchedPrevious(true);
    }
  }, [
    user,
    teamName,
    formattedDate,
    isToday,
    hasFetchedPrevious,
    snippetExists,
  ]);

  // Apply previous snippet when Tab key is pressed
  const handleTabKeyForPreviousSnippet = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        e.key === "Tab" &&
        previousSnippet &&
        isToday &&
        isEditMode &&
        !snippetExists
      ) {
        e.preventDefault();
        setSnippet(previousSnippet);
      }
    },
    [previousSnippet, isToday, isEditMode, snippetExists],
  );

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
            // Only set edit mode if there are no snippets for today
            setIsEditMode(false);
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

          // Only automatically enter edit mode if there are no snippets at all for today
          if (isToday && snippetsArray.length === 0) {
            setIsEditMode(true);
          } else {
            setIsEditMode(false);
          }
        } else {
          // If user has a snippet, always start in view mode
          setIsEditMode(false);
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
  }, [formattedDate, user, teamName, isToday, fetchUserProfiles]);

  // Fetch previous snippet when entering edit mode
  useEffect(() => {
    if (isEditMode && isToday && !snippetExists && !hasFetchedPrevious) {
      void fetchMostRecentSnippet();
    }
  }, [
    isEditMode,
    isToday,
    snippetExists,
    hasFetchedPrevious,
    fetchMostRecentSnippet,
  ]);

  // Save the snippet to Firestore
  const handleSave = useCallback(async () => {
    if (!isEditMode || !user || !isEditingAllowed()) return;

    setIsSaving(true);
    try {
      const userId = user.uid;
      const userEmail = user.email;
      const snippetId = `${userId}_${formattedDate}`;
      const now = new Date();

      // Check if the snippet already exists
      const snippetRef = doc(db, "snippets", snippetId);
      const snippetDoc = await getDoc(snippetRef);

      // 새로운 스니펫 데이터 객체 생성
      const updatedSnippetData: SnippetData = {
        snippetId,
        userId,
        userEmail: userEmail || "",
        date: formattedDate,
        snippet: snippet,
        created_at: snippetDoc.exists()
          ? snippetDoc.data().created_at instanceof Date
            ? snippetDoc.data().created_at
            : new Date(snippetDoc.data().created_at)
          : now,
        modified_at: now,
        teamName: teamName || "",
      };

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

      // 로컬 상태 업데이트
      setOriginalSnippet(snippet); // 저장 후 원본 업데이트
      setSnippetExists(true);
      setMySnippet(updatedSnippetData);

      // 현재 사용자의 프로필 정보가 없거나 불완전한 경우 업데이트
      if (
        userEmail &&
        (!userProfiles[userEmail]?.email || !userProfiles[userEmail]?.photoURL)
      ) {
        // Firebase에서 최신 사용자 정보 가져오기
        const userDoc = await getDoc(doc(db, "users", userId));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // 로컬 userProfiles 상태 업데이트
          setUserProfiles((prevProfiles) => ({
            ...prevProfiles,
            [userEmail]: {
              email: userEmail,
              displayName:
                userData.displayName ?? user.displayName ?? undefined,
              photoURL: userData.photoURL ?? user.photoURL ?? undefined,
            },
          }));
        } else {
          // Firebase에 사용자 프로필이 없다면 현재 user 객체로 업데이트
          setUserProfiles((prevProfiles) => ({
            ...prevProfiles,
            [userEmail]: {
              email: userEmail,
              displayName: user.displayName ?? undefined,
              photoURL: user.photoURL ?? undefined,
            },
          }));
        }
      }

      // allSnippets 배열도 업데이트
      if (snippetDoc.exists()) {
        // 기존 스니펫 업데이트
        setAllSnippets((prevSnippets) =>
          prevSnippets.map((s) =>
            s.snippetId === snippetId ? updatedSnippetData : s,
          ),
        );
      } else {
        // 새 스니펫 추가
        setAllSnippets((prevSnippets) => [updatedSnippetData, ...prevSnippets]);
      }

      setIsEditMode(false); // Return to view mode after saving
    } catch (error) {
      console.error("Error saving snippet:", error);
    } finally {
      setIsSaving(false);
    }
  }, [
    isEditMode,
    user,
    isEditingAllowed,
    snippet,
    formattedDate,
    teamName,
    userProfiles,
    setOriginalSnippet,
    setSnippetExists,
    setMySnippet,
    setUserProfiles,
    setAllSnippets,
    setIsEditMode,
  ]);

  // 취소 버튼 - 원본 내용으로 복원
  const handleCancel = useCallback(() => {
    // 원본 스니펫으로 복원
    setSnippet(originalSnippet);
    setIsEditMode(false); // 보기 모드로 돌아가기
  }, [originalSnippet]);

  // Delete the snippet from Firestore
  const handleDelete = async () => {
    if (!user || !isEditingAllowed() || !mySnippet) return;

    if (!confirm("스니펫을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const snippetId = `${user.uid}_${formattedDate}`;
      const snippetRef = doc(db, "snippets", snippetId);

      await deleteDoc(snippetRef);

      // Update local state
      setMySnippet(null);
      setSnippet("");
      setOriginalSnippet("");
      setSnippetExists(false);
      setIsEditMode(false);

      // Update all snippets list
      setAllSnippets((prevSnippets) =>
        prevSnippets.filter((s) => s.snippetId !== snippetId),
      );
    } catch (error) {
      console.error("Error deleting snippet:", error);
    } finally {
      setIsDeleting(false);
    }
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
  }, [snippet, isEditMode, isToday, handleSave, handleCancel]);

  return (
    <div className="container mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
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
        <div className="flex flex-grow items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
        </div>
      ) : (
        <div className="flex flex-grow flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
          {isEditMode ? (
            // Edit Mode - Plain text editor
            <div className="flex flex-grow flex-col p-4">
              <div className="mb-2 text-sm text-gray-500">
                <div>{Strings.markdownSupported}</div>
                <div className="rounded-md bg-gray-50 p-2 font-mono text-xs whitespace-pre text-gray-400">
                  {Strings.markdownSyntaxGuide}
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={snippet}
                onChange={(e) => setSnippet(e.target.value)}
                onKeyDown={handleTabKeyForPreviousSnippet}
                className="mb-4 min-h-[20rem] w-full flex-grow resize-none rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder={
                  previousSnippetPlaceholder
                    ? `${Strings.snippetPlaceholder}\n\n${previousSnippetPlaceholder.slice(0, 150)}${previousSnippetPlaceholder.length > 150 ? "..." : ""}`
                    : Strings.snippetPlaceholder
                }
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
            <div className="flex-grow space-y-6 p-4">
              {allSnippets.length > 0 ? (
                allSnippets.map((_snippetData, _index) => {
                  const isMySnippet = user && _snippetData.userId === user.uid;
                  const userProfile = _snippetData.userEmail
                    ? userProfiles[_snippetData.userEmail]
                    : undefined;

                  return (
                    <div
                      key={_snippetData.snippetId}
                      className="mb-6 border-b border-gray-100 pb-6 last:mb-0 last:border-b-0 last:pb-0"
                    >
                      {/* Show edit and delete buttons for my snippet if editing is allowed */}
                      {isMySnippet && isEditingAllowed() && (
                        <div className="mb-2 flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSnippet(_snippetData.snippet);
                              setIsEditMode(true);
                            }}
                            className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition hover:bg-blue-700"
                          >
                            {Strings.editSnippet}
                          </button>
                          <button
                            onClick={() => void handleDelete()}
                            disabled={isDeleting}
                            className={`rounded-md px-3 py-1 text-sm text-white transition ${
                              isDeleting
                                ? "cursor-not-allowed bg-red-400"
                                : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            {Strings.deleteSnippet}
                          </button>
                        </div>
                      )}

                      {/* User info row with avatar and name */}
                      <div className="mb-3 flex items-center">
                        <div className="mr-2 h-8 w-8 overflow-hidden rounded-full border border-gray-200">
                          {userProfile?.photoURL ? (
                            <Image
                              src={userProfile.photoURL}
                              alt={
                                userProfile.displayName ||
                                _snippetData.userEmail
                              }
                              className="h-full w-full object-cover"
                              width={32}
                              height={32}
                              unoptimized={userProfile.photoURL.startsWith(
                                "data:",
                              )}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-blue-500 text-white">
                              {(
                                (
                                  userProfile?.displayName ??
                                  _snippetData.userEmail ??
                                  "?"
                                ).charAt(0) ?? "?"
                              ).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="font-medium">
                          {userProfile?.displayName || _snippetData.userEmail}
                        </div>
                      </div>

                      {/* Snippet content */}
                      <article className="prose prose-slate max-w-none pl-10">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ ...props }) => (
                              <h1
                                className="mt-4 mb-2 text-2xl font-bold"
                                {...props}
                              />
                            ),
                            h2: ({ ...props }) => (
                              <h2
                                className="mt-4 mb-2 text-xl font-bold"
                                {...props}
                              />
                            ),
                            h3: ({ ...props }) => (
                              <h3
                                className="mt-3 mb-2 text-lg font-bold"
                                {...props}
                              />
                            ),
                            h4: ({ ...props }) => (
                              <h4
                                className="mt-3 mb-1 text-base font-bold"
                                {...props}
                              />
                            ),
                            h5: ({ ...props }) => (
                              <h5
                                className="mt-2 mb-1 text-sm font-bold"
                                {...props}
                              />
                            ),
                            h6: ({ ...props }) => (
                              <h6
                                className="mt-2 mb-1 text-xs font-bold"
                                {...props}
                              />
                            ),
                            ul: ({ ...props }) => (
                              <ul className="my-2 list-disc pl-5" {...props} />
                            ),
                            ol: ({ ...props }) => (
                              <ol
                                className="my-2 list-decimal pl-5"
                                {...props}
                              />
                            ),
                            li: ({ ...props }) => (
                              <li className="my-1" {...props} />
                            ),
                            a: ({ ...props }) => (
                              <a
                                className="text-blue-500 hover:underline"
                                {...props}
                              />
                            ),
                            p: ({ ...props }) => (
                              <p className="my-2" {...props} />
                            ),
                            blockquote: ({ ...props }) => (
                              <blockquote
                                className="my-2 border-l-4 border-gray-300 pl-4 italic"
                                {...props}
                              />
                            ),
                            code: ({ ...props }) => (
                              <code
                                className="rounded bg-gray-100 px-1 py-0.5"
                                {...props}
                              />
                            ),
                            pre: ({ ...props }) => (
                              <pre
                                className="overflow-auto rounded bg-gray-100 p-3"
                                {...props}
                              />
                            ),
                          }}
                        >
                          {_snippetData.snippet}
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
