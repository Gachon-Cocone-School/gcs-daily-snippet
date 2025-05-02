"use client";

import { useEffect, useState } from "react";
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
  parseISO,
  isBefore as isDateBefore,
  isAfter,
} from "date-fns";
import { ko } from "date-fns/locale";
import Strings from "~/constants/strings";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "~/lib/firebase";

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
  const { user, loading, logOut, authorized } = useAuth();
  const router = useRouter();
  const [today] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(today);
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [userSnippets, setUserSnippets] = useState<Record<string, any>>({});
  const [isLoadingSnippets, setIsLoadingSnippets] = useState(false);

  // Generate years for dropdown (10 years back from current year)
  const currentYear = getYear(today);
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  // Generate months for dropdown
  const months = Array.from({ length: 12 }, (_, i) => i);

  // Load snippets directly from Firestore
  useEffect(() => {
    async function fetchUserSnippets() {
      if (!user) return;

      setIsLoadingSnippets(true);
      try {
        const userId = user.uid;
        const snippetsQuery = query(
          collection(db, "snippets"),
          where("userId", "==", userId),
        );

        const querySnapshot = await getDocs(snippetsQuery);
        const snippetsMap: Record<string, any> = {};

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          snippetsMap[data.date] = data;
        });

        setUserSnippets(snippetsMap);
      } catch (error) {
        console.error("Error fetching snippets:", error);
        showSnackbar("스니펫을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoadingSnippets(false);
      }
    }

    void fetchUserSnippets();
  }, [user]);

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
    if (!user) return;

    setIsLoadingSnippets(true);
    try {
      const userId = user.uid;
      const snippetsQuery = query(
        collection(db, "snippets"),
        where("userId", "==", userId),
      );

      const querySnapshot = await getDocs(snippetsQuery);
      const snippetsMap: Record<string, any> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        snippetsMap[data.date] = data;
      });

      setUserSnippets(snippetsMap);
    } catch (error) {
      console.error("Error refreshing snippets:", error);
    } finally {
      setIsLoadingSnippets(false);
    }
  };

  const hasSnippet = (date: Date) => {
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

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 text-gray-800">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-medium">{Strings.appName}</h1>
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
                {(user.displayName || user.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="text-gray-700">
              {user.displayName || user.email}
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-sm">
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

          <div className="grid grid-cols-7 gap-2">
            {Strings.daysOfWeek.map((day) => (
              <div
                key={day}
                className="p-2 text-center font-medium text-gray-500"
              >
                {day}
              </div>
            ))}

            {/* Empty cells for proper day alignment */}
            {calendarDays.length > 0 &&
              Array.from(
                { length: new Date(calendarDays[0]).getDay() },
                (_, i) => <div key={`empty-${i}`} className="p-2"></div>,
              )}

            {/* Calendar days */}
            {calendarDays.map((date) => {
              const isCurrentDay = isToday(date);
              const isPastDate = isDateBefore(date, today) && !isCurrentDay;
              const isFutureDate = isAfter(date, today);
              const hasSnippetForDate = hasSnippet(date);

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => !isFutureDate && handleDateClick(date)}
                  className={`rounded-md p-3 text-center transition ${
                    isCurrentDay
                      ? "bg-blue-100 font-medium text-blue-600"
                      : isFutureDate
                        ? "cursor-not-allowed bg-gray-100 text-gray-400"
                        : "cursor-pointer text-gray-700 hover:bg-gray-50"
                  } ${hasSnippetForDate ? "font-bold" : ""} relative`}
                >
                  {format(date, "d")}
                  {hasSnippetForDate && !isFutureDate && (
                    <div className="absolute bottom-1 left-1 h-4 w-4 overflow-hidden rounded-full border border-white">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-blue-500 text-[6px] text-white">
                          {(user.displayName ||
                            user.email ||
                            "?")[0].toUpperCase()}
                        </div>
                      )}
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
      `}</style>
    </main>
  );
}
