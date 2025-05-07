"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/lib/auth-context";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  isBefore,
  getYear,
  getMonth,
  setMonth,
  setYear,
  isBefore as isDateBefore,
  isAfter,
} from "date-fns";
import { ko } from "date-fns/locale";
import Strings from "~/constants/strings";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "~/lib/firebase";

// Define type for user profiles
interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
}

// Define type for snippets
interface Snippet {
  userId: string;
  date: string;
  snippet: string;
  created_at: Date;
  modified_at: Date;
  teamName: string;
  userEmail: string;
}

// Simple Snackbar component
function Snackbar({
  message,
  isVisible,
  onClose,
}: {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="animate-fade-in-up fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform rounded-md bg-gray-800 px-4 py-2 text-white shadow-md">
      {message}
    </div>
  );
}

export default function Home() {
  const { user, loading, logOut, authorized, teamName, teamAlias } = useAuth(); // Get teamAlias from auth context
  const router = useRouter();
  const [today] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(today);
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [userSnippets, setUserSnippets] = useState<Record<string, Snippet[]>>(
    {},
  );
  const [isLoadingSnippets, setIsLoadingSnippets] = useState(false);
  // Add state for user profiles indexed by email
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>(
    {},
  );
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  // Add state to track if all data is fully loaded
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);

  // Generate years for dropdown (10 years back from current year)
  const currentYear = getYear(today);
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  // Generate months for dropdown
  const months = Array.from({ length: 12 }, (_, i) => i);

  // Add CSS variables for avatar overlaps based on screen size
  useEffect(() => {
    // CSS variable for avatar overlaps
    document.documentElement.style.setProperty(
      "--avatar-overlap-small",
      "-14px",
    );
    document.documentElement.style.setProperty(
      "--avatar-overlap-medium",
      "-3px",
    );
    document.documentElement.style.setProperty("--avatar-overlap-large", "0px");
  }, []);

  // Function to extract all unique email addresses from snippets
  const collectSnippetEmails = (
    snippets: Record<string, Snippet[]>,
  ): Set<string> => {
    const emailSet = new Set<string>();

    // Add all emails from snippets
    Object.values(snippets).forEach((dateSnippets) => {
      dateSnippets.forEach((snippet) => {
        if (snippet.userEmail) {
          emailSet.add(snippet.userEmail);
        }
      });
    });

    return emailSet;
  };

  // Function to fetch user profiles for a set of email addresses
  const fetchUserProfiles = useCallback(async (emails: Set<string>) => {
    if (emails.size === 0) return;

    setIsLoadingProfiles(true);
    try {
      const usersQuery = query(
        collection(db, "users"),
        where("email", "in", Array.from(emails)),
      );

      const querySnapshot = await getDocs(usersQuery);
      const profilesMap: Record<string, UserProfile> = {};

      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.email) {
          profilesMap[userData.email] = {
            email: userData.email,
            displayName: userData.displayName ?? undefined,
            photoURL: userData.photoURL ?? undefined,
          };
        }
      });

      setUserProfiles(profilesMap);
    } catch (error) {
      console.error("Error fetching user profiles:", error);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  // Load snippets directly from Firestore
  useEffect(() => {
    async function fetchUserSnippets() {
      if (!user || !teamName) return;

      setIsLoadingSnippets(true);
      try {
        // Get the start and end dates for the current month view
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDateStr = format(monthStart, "yyyy-MM-dd");
        const endDateStr = format(monthEnd, "yyyy-MM-dd");

        // Query snippets for the team and date range
        const snippetsQuery = query(
          collection(db, "snippets"),
          where("teamName", "==", teamName),
          where("date", ">=", startDateStr),
          where("date", "<=", endDateStr),
        );

        const querySnapshot = await getDocs(snippetsQuery);

        // Create a map to store multiple snippets per date
        const snippetsMap: Record<string, Snippet[]> = {};

        querySnapshot.forEach((doc) => {
          const data = doc.data() as Snippet;
          if (!snippetsMap[data.date]) {
            snippetsMap[data.date] = [];
          }
          snippetsMap[data.date]!.push(data);
        });

        setUserSnippets(snippetsMap);

        // Collect emails from all snippets
        const emails = new Set<string>();
        Object.values(snippetsMap).forEach((dateSnippets) => {
          dateSnippets.forEach((snippet) => {
            if (snippet.userEmail) {
              emails.add(snippet.userEmail);
            }
          });
        });

        // Fetch user profiles
        await fetchUserProfiles(emails);
      } catch (error) {
        console.error("Error fetching snippets:", error);
        showSnackbar("스니펫을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoadingSnippets(false);
      }
    }

    void fetchUserSnippets();
  }, [user, teamName, currentDate, fetchUserProfiles]); // fetchUserProfiles 의존성 추가

  useEffect(() => {
    // 로그인되지 않았거나 인증되지 않은 사용자는 로그인 페이지로 리디렉션
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (authorized === false) {
        // 인증되지 않은 사용자는 로그인 페이지로 리디렉션
        router.push("/login");
      }
    }

    // Generate calendar days for current month view
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    setCalendarDays(days);
  }, [user, loading, authorized, router, currentDate]);

  // Update effect to track when data is fully loaded
  useEffect(() => {
    // Data is considered fully loaded when snippets are loaded and profiles are loaded
    setIsFullyLoaded(!isLoadingSnippets && !isLoadingProfiles);
  }, [isLoadingSnippets, isLoadingProfiles]);

  const showSnackbar = (message: string) => {
    setSnackbar({ visible: true, message });
  };

  const hideSnackbar = () => {
    setSnackbar({ visible: false, message: "" });
  };

  const goToPreviousMonth = () => {
    setCurrentDate((prevDate) => subMonths(prevDate, 1));
  };

  const goToNextMonth = () => {
    const nextMonth = addMonths(currentDate, 1);
    // Only allow navigation up to the current month
    if (isBefore(nextMonth, addMonths(startOfMonth(today), 1))) {
      setCurrentDate(nextMonth);
    } else {
      showSnackbar(Strings.noFutureMonths);
    }
  };

  const goToCurrentMonth = () => {
    setCurrentDate(today);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value);
    // Prevent selecting a future year beyond current
    if (newYear > currentYear) {
      showSnackbar(Strings.noFutureMonths);
      return;
    }

    const newDate = setYear(currentDate, newYear);
    // If setting the year would make the date in the future, adjust to current month
    if (
      getYear(newDate) === currentYear &&
      getMonth(newDate) > getMonth(today)
    ) {
      setCurrentDate(setMonth(newDate, getMonth(today)));
    } else {
      setCurrentDate(newDate);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value);
    const newDate = setMonth(currentDate, newMonth);

    // Prevent selecting a future month if in current year
    if (getYear(newDate) === currentYear && newMonth > getMonth(today)) {
      showSnackbar(Strings.noFutureMonths);
      return;
    }

    setCurrentDate(newDate);
  };

  const handleDateClick = (date: Date) => {
    // 오늘 이후의 날짜는 클릭하지 못하게 처리
    if (isAfter(date, today)) {
      showSnackbar("미래 날짜는 선택할 수 없습니다.");
      return;
    }

    // Navigate to the snippet page with the formatted date as a parameter
    const formattedDate = format(date, "yyyy-MM-dd");
    router.push(`/snippet/${formattedDate}`);
  };

  // Define the fetchUserSnippets function to refresh data
  const fetchUserSnippets = async () => {
    if (!user || !teamName) return;

    setIsLoadingSnippets(true);
    try {
      // Get the start and end dates for the current month view
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDateStr = format(monthStart, "yyyy-MM-dd");
      const endDateStr = format(monthEnd, "yyyy-MM-dd");

      // Query snippets for the team and date range
      const snippetsQuery = query(
        collection(db, "snippets"),
        where("teamName", "==", teamName),
        where("date", ">=", startDateStr),
        where("date", "<=", endDateStr),
      );

      const querySnapshot = await getDocs(snippetsQuery);
      const snippetsMap: Record<string, Snippet[]> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data() as Snippet;
        if (!snippetsMap[data.date]) {
          snippetsMap[data.date] = [];
        }
        snippetsMap[data.date]!.push(data);
      });

      setUserSnippets(snippetsMap);

      // Collect emails and fetch user profiles
      const emails = collectSnippetEmails(snippetsMap);
      await fetchUserProfiles(emails);
    } catch (error) {
      console.error("Error refreshing snippets:", error);
    } finally {
      setIsLoadingSnippets(false);
    }
  };

  // 날짜에 스니펫이 있는지 확인하는 함수 (현재 사용되지 않지만 향후 사용 가능함)
  const _hasSnippet = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    return !!userSnippets[dateString];
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-2xl text-gray-700">{Strings.loading}</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  // Get the last teamAlias if available
  const lastTeamAlias =
    teamAlias && teamAlias.length > 0 ? teamAlias[teamAlias.length - 1] : null;

  // Construct the app title with the last teamAlias if available
  const appTitle = lastTeamAlias
    ? `${Strings.appName} - ${lastTeamAlias}`
    : Strings.appName;

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 text-gray-800">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-medium">{appTitle}</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="사용자 아바타"
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                {(
                  (user?.displayName ?? user?.email ?? "?").charAt(0) ?? "?"
                ).toUpperCase()}
              </div>
            )}
            <div className="text-gray-700">
              {user.displayName ?? user.email}
            </div>
          </div>
          <button
            onClick={logOut}
            className="rounded-md bg-gray-100 p-2 text-gray-700 transition hover:bg-gray-200"
            aria-label={Strings.logOut}
            title={Strings.logOut}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl rounded-lg bg-white p-4 shadow-sm md:max-w-5xl md:p-6 lg:max-w-6xl xl:max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition hover:bg-gray-200"
            >
              &lt;
            </button>

            <div className="flex items-center gap-2">
              <select
                value={getYear(currentDate)}
                onChange={handleYearChange}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                    {Strings.yearSuffix}
                  </option>
                ))}
              </select>

              <select
                value={getMonth(currentDate)}
                onChange={handleMonthChange}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700"
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {format(setMonth(new Date(), month), "MMMM", {
                      locale: ko,
                    })}
                  </option>
                ))}
              </select>

              {!isSameMonth(currentDate, today) && (
                <button
                  onClick={goToCurrentMonth}
                  className="ml-2 rounded-md bg-blue-50 px-3 py-1 text-xs text-blue-600 transition hover:bg-blue-100"
                >
                  {Strings.today}
                </button>
              )}
            </div>

            <button
              onClick={goToNextMonth}
              className={`rounded-md px-4 py-2 transition ${
                isSameMonth(currentDate, today)
                  ? "cursor-not-allowed bg-gray-50 text-gray-300"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              disabled={isSameMonth(currentDate, today)}
            >
              &gt;
            </button>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-3xl font-medium text-gray-800">
              {format(currentDate, Strings.monthYearFormat, { locale: ko })}
            </h2>
          </div>

          {/* Data loading overlay */}
          {(isLoadingSnippets || isLoadingProfiles) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-md border border-gray-100 bg-white p-4 text-center text-gray-800 shadow-md">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                  <span>{Strings.loadingSnippets}</span>
                </div>
              </div>
            </div>
          )}

          <div className="relative grid grid-cols-7 gap-2 md:gap-3 lg:gap-4">
            {Strings.daysOfWeek.map((day) => (
              <div
                key={day}
                className="p-2 text-center font-medium text-gray-500 md:p-3 md:text-lg"
              >
                {day}
              </div>
            ))}

            {/* Empty cells for proper day alignment */}
            {calendarDays.length > 0 &&
              Array.from({ length: calendarDays[0]?.getDay() ?? 0 }, (_, i) => (
                <div key={`empty-${i}`} className="p-2 md:p-3"></div>
              ))}

            {/* Calendar days */}
            {calendarDays.map((date) => {
              const isCurrentDay = isToday(date);
              // 과거 날짜 상태는 사용되지 않지만 후속 기능에 필요할 수 있으므로 _접두사 추가
              const _isPastDate = isDateBefore(date, today) && !isCurrentDay;
              const isFutureDate = isAfter(date, today);
              const dateString = format(date, "yyyy-MM-dd");
              const hasSnippetForDate = !!userSnippets[dateString];
              const snippetsForDate = userSnippets[dateString] ?? [];

              // Get unique emails for this date and sort them:
              // 1. Current user's email first
              // 2. Others by modified_at timestamp (ascending)
              let uniqueEmailAuthors: { email: string; modified_at: Date }[] =
                [];

              // First collect all unique authors with their latest modified time
              const authorMap = new Map<string, Date>();
              snippetsForDate.forEach((snippet) => {
                if (snippet.userEmail) {
                  // If we see this author for the first time, or this snippet is newer
                  const currentModifiedTime = authorMap.get(snippet.userEmail);
                  if (
                    !currentModifiedTime ||
                    (snippet.modified_at &&
                      new Date(snippet.modified_at) > currentModifiedTime)
                  ) {
                    authorMap.set(
                      snippet.userEmail,
                      new Date(snippet.modified_at),
                    );
                  }
                }
              });

              // Convert the map to an array of objects
              uniqueEmailAuthors = Array.from(authorMap.entries()).map(
                ([email, modified_at]) => ({
                  email,
                  modified_at,
                }),
              );

              // Sort: current user first, then by modified_at in ascending order
              uniqueEmailAuthors.sort((a, b) => {
                // Current user always comes first
                if (a.email === user?.email) return -1;
                if (b.email === user?.email) return 1;

                // Otherwise sort by modified_at (ascending)
                return a.modified_at.getTime() - b.modified_at.getTime();
              });

              // Get only the emails
              const sortedEmails = uniqueEmailAuthors.map(
                (author) => author.email,
              );

              // Count total avatars
              const totalAvatars = sortedEmails.length;
              // Limit visible avatars to 4
              const visibleAvatars = sortedEmails.slice(0, 4);
              // Calculate extras
              const extraAvatars = totalAvatars > 4 ? totalAvatars - 4 : 0;

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => !isFutureDate && handleDateClick(date)}
                  className={`rounded-md p-2 text-center transition md:p-3 lg:p-4 ${
                    isCurrentDay
                      ? "bg-blue-100 font-medium text-blue-600"
                      : isFutureDate
                        ? "cursor-not-allowed bg-gray-100 text-gray-400"
                        : "cursor-pointer text-gray-700 hover:bg-gray-50"
                  } ${hasSnippetForDate ? "font-bold" : ""} relative min-h-[40px] md:min-h-[60px] lg:min-h-[80px]`}
                >
                  <div className="text-sm md:text-base lg:text-lg">
                    {format(date, "d")}
                  </div>
                  {hasSnippetForDate && !isFutureDate && isFullyLoaded && (
                    <div className="absolute bottom-[5%] left-[5%] flex flex-col items-start">
                      {/* Show +n indicator for additional avatars above the avatars */}
                      {extraAvatars > 0 && (
                        <div
                          className="mb-0.5 flex h-[18%] max-h-5 min-h-3 w-auto min-w-[14px] items-center justify-center rounded-full bg-gray-200 px-1 text-[8px] font-medium text-gray-600 sm:text-[10px] md:text-[12px] lg:text-xs"
                          style={{ zIndex: 45 }}
                          title={`${extraAvatars} more contributor${extraAvatars > 1 ? "s" : ""}`}
                        >
                          +{extraAvatars}
                        </div>
                      )}

                      <div className="flex overflow-visible">
                        {visibleAvatars.map((email, index) => {
                          const userProfile = userProfiles[email];
                          const isCurrentUser = email === user?.email;

                          return (
                            <div
                              key={`${dateString}-${email}`}
                              className={`h-5 w-5 overflow-hidden rounded-full border md:h-6 md:w-6 lg:h-7 lg:w-7 ${isCurrentUser ? "border-blue-300" : "border-white"}`}
                              style={{
                                zIndex: 40 - index,
                                marginLeft:
                                  index > 0 ? "var(--avatar-overlap)" : "0px",
                                boxShadow: isCurrentUser
                                  ? "0 0 0 1px rgba(59, 130, 246, 0.3)"
                                  : "none",
                              }}
                              title={userProfile?.displayName || email}
                            >
                              {userProfile?.photoURL ? (
                                <img
                                  src={userProfile.photoURL}
                                  alt={userProfile.displayName || email}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`flex h-full w-full items-center justify-center text-[6px] text-white sm:text-[8px] md:text-[10px] lg:text-xs ${
                                    isCurrentUser
                                      ? "bg-blue-600"
                                      : "bg-blue-500"
                                  }`}
                                >
                                  {(
                                    (
                                      userProfile?.displayName ??
                                      email ??
                                      "?"
                                    ).charAt(0) ?? "?"
                                  ).toUpperCase()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Snackbar notification */}
      <Snackbar
        message={snackbar.message}
        isVisible={snackbar.visible}
        onClose={hideSnackbar}
      />

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.3s ease-out;
        }

        /* Avatar overlap based on screen size */
        :root {
          --avatar-overlap: -14px; /* Mobile default */
        }

        @media (min-width: 768px) {
          :root {
            --avatar-overlap: -8px; /* Tablet */
          }
        }

        @media (min-width: 1024px) {
          :root {
            --avatar-overlap: -3px; /* Desktop */
          }
        }

        @media (min-width: 1280px) {
          :root {
            --avatar-overlap: 0px; /* Large Desktop */
          }
        }
      `}</style>
    </main>
  );
}
