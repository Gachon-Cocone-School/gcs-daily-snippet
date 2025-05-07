/**
 * Application string constants
 * This file contains all the text strings used throughout the application
 */

export const Strings = {
  // Common
  appName: "Daily",
  loading: "로딩중...",
  titleFormat: "{appName} - {teamAlias}", // New format string for title with team alias

  // Auth related
  signInWithGoogle: "구글 계정으로 로그인",
  memberOnly: "GCS 멤버만 사용가능합니다",
  authChecking: "멤버십 확인 중...",
  notAuthorized: "인증되지 않은 사용자입니다. GCS 멤버만 사용 가능합니다.",
  authError: "인증 확인 중 오류가 발생했습니다.",
  logOut: "로그아웃",

  // Login page
  appTagline:
    "가천코코네스쿨 학생들을 위한 daily snippets 입니다. 매일을 기록하고 나만의 스프링보드를 만들어보아요.",

  // Calendar
  today: "오늘",
  daysOfWeek: ["일", "월", "화", "수", "목", "금", "토"],
  yearSuffix: "년",
  monthYearFormat: "yyyy년 MM월",
  returnToCalendar: "뒤로",

  // Snippet
  editSnippet: "수정",
  deleteSnippet: "삭제",
  createSnippet: "작성",
  saveSnippet: "저장",
  cancelEdit: "취소",
  savingSnippet: "저장 중...",
  noSnippetToday: "아직 오늘의 스니펫이 없습니다.",
  noSnippetForDate: "이 날짜에 스니펫이 없습니다.",
  snippetPlaceholder: "Tab 키를 누르면 제안된 스니펫이 적용됩니다.",
  snippetTemplate:
    "# 오늘 한 일\n\n- [ ] 작업 1\n- [ ] 작업 2\n- [ ] 작업 3\n\n# 메모\n\n내용을 입력하세요...",

  // Markdown
  markdownSupported: "마크다운 문법을 사용할 수 있습니다",
  markdownSyntaxGuide: `# 제목 (# ~ ######)
* 또는 - 불릿 목록
1. 2. 3. 숫자 목록
[링크 텍스트](URL)
![이미지 설명](이미지 URL)
\`코드 블록\`
**굵게** 또는 *기울임*`,

  // Messages
  noFutureMonths: "이번달 이후는 볼 수 없습니다.",
  loadingSnippets: "스니펫 데이터 조회중...",
};

export default Strings;
