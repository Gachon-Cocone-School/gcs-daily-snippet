"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "~/lib/firebase";
import { useAuth } from "./auth-context";
import Image from "next/image";

// 팀 정보 타입 - 이미지 컴포넌트를 저장할 수 있도록 수정
interface TeamMember {
  email: string;
  photoURL?: string;
  displayName?: string;
  priority?: number; // 표시 우선순위 (낮을수록 먼저 표시)
  imageComponent?: React.ReactNode; // Next.js Image 컴포넌트 저장
}

// 글로벌 상태 타입
interface TeamContextType {
  teamMembers: TeamMember[];
  isTeamDataLoaded: boolean;
  refreshTeamData: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isTeamDataLoaded, setIsTeamDataLoaded] = useState(false);

  // 팀원 정보 가져오기 - useCallback으로 래핑하여 메모이제이션
  const fetchTeamData = useCallback(async () => {
    if (!user?.email) return;

    try {
      // 로딩 상태 시작
      setIsTeamDataLoaded(false);

      // 1. 내 소속 팀 찾기
      const teamsQuery = query(collection(db, "teams"));
      const teamsSnapshot = await getDocs(teamsQuery);

      let teamEmails: string[] = [];

      // 내가 속한 팀 찾기
      teamsSnapshot.forEach((doc) => {
        const teamData = doc.data();
        if (
          teamData.emails &&
          Array.isArray(teamData.emails) &&
          teamData.emails.includes(user.email)
        ) {
          // 내 이메일을 제외한 팀원 이메일 목록
          teamEmails = teamData.emails.filter(
            (email: string) => email !== user.email,
          ) as string[];
        }
      });

      if (teamEmails.length === 0) {
        setIsTeamDataLoaded(true);
        return;
      }

      // 2. 팀원 프로필 정보 가져오기 - 한 번에 처리
      const usersQuery = query(collection(db, "users"));
      const usersSnapshot = await getDocs(usersQuery);

      const members: TeamMember[] = [];

      // 팀원 정보 수집
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.email && teamEmails.includes(userData.email as string)) {
          // 이미지 컴포넌트 미리 생성
          let imageComponent = null;
          if (userData.photoURL) {
            imageComponent = (
              <Image
                src={userData.photoURL as string}
                alt={(userData.displayName ?? userData.email) as string}
                width={40}
                height={40}
                className="h-full w-full rounded-full object-cover"
                priority={teamEmails.indexOf(userData.email as string) < 5} // 처음 5명은 우선적으로 로드
                unoptimized={(userData.photoURL as string).startsWith("data:")} // data URL인 경우 최적화 비활성화
              />
            );
          }

          members.push({
            email: userData.email as string,
            photoURL: userData.photoURL as string | undefined,
            displayName: userData.displayName as string | undefined,
            // 이메일 인덱스에 따라 우선순위 설정 (정렬을 위함)
            priority: teamEmails.indexOf(userData.email as string),
            imageComponent,
          });
        }
      });

      // 팀원 정보가 없는 이메일에 대해 기본 객체 추가
      teamEmails.forEach((email, index) => {
        if (!members.some((member) => member.email === email)) {
          members.push({
            email,
            priority: index,
          });
        }
      });

      // 우선순위에 따라 정렬
      members.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

      // 정렬된 팀원 정보 저장
      setTeamMembers(members);
      setIsTeamDataLoaded(true);
    } catch (error) {
      console.error("Error fetching team data:", error);
      setIsTeamDataLoaded(true);
    }
  }, [user]); // Only re-create when user changes

  // 사용자 로그인 시 팀 정보 가져오기
  useEffect(() => {
    if (user) {
      void fetchTeamData();
    } else {
      setTeamMembers([]);
      setIsTeamDataLoaded(false);
    }
  }, [user, fetchTeamData]); // Now fetchTeamData is stable between renders

  // 팀 정보 새로고침 함수
  const refreshTeamData = useCallback(async () => {
    setIsTeamDataLoaded(false);
    await fetchTeamData();
  }, [fetchTeamData]); // Also memoize this function

  return (
    <TeamContext.Provider
      value={{
        teamMembers,
        isTeamDataLoaded,
        refreshTeamData,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
}
