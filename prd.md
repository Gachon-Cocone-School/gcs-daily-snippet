# 기술 spec

- Apple Human Interface Guideline 컨셉의 깔끔하고 심플한 UX를 유지한다.
- t3 표준 폴더 구조를 유지한다.
- CSR 로 구현한다.
- firebase 로그인 기능 사용.
- firestore database 사용.
- firebase 의 웹 앱으로 연동

# 로그인 스펙

- firebase 의 Google login 만 지원함.

# main 화면 구성

- 메인 화면은 그냥 달력만 보여준다.
- 달력은 월 단위로 보여주고 오늘에 해당하는 월의 달력을 보여준다.
  - 날짜 기준은 korean time 이다.
- 이전달을 봤다가 다시 돌아올 수 있게 <- -> 버튼이 있고,
- 년도와 월을 직접 dropbox 에서 고를 수 있게 한다.
- 단 이번달 이후는 볼 수 없어야 한다.

# firestore collection 구조

- snippets collection 이 있음.
  - 개별 snippet 은 아래의 필드를 가짐.
    - snippetId : string --> userId + date 가 고유키가 됨.
    - userId : string
    - date : string
    - snippet : string
    - created_at: datetime
    - modified_at: datetime

# snippet 관리 기능.

- 오늘 날짜를 클릭하면 snippet 페이지로 이동한다.
- snippet 페이지는 기본적으로 view 모드로 표시된다.
  - view 모드에서는 snippet 내용을 읽을 수만 있다.
  - 오늘 날짜의 경우, view 모드에서 '수정' 버튼이 표시된다.
  - '수정' 버튼을 클릭하면 edit 모드로 전환된다.
- edit 모드에서는 text area에서 snippet을 입력/수정할 수 있다.
  - '저장' 버튼을 누르면 collection에 저장되고 다시 view 모드로 전환된다.
- 아직 snippet이 없을 경우에는 자동으로 edit 모드로 시작된다.
- 오늘 날짜 이전의 snippet 페이지는 view 모드로만 표시되며 수정 기능은 제공되지 않는다.

# 인증 기능 강화

- 구글계정 로그인 한 후에 구글 이메일을 읽는다.
- firestore collection 에 있는 members 에 email 이 등록된 사용자라면 인증이 성공하고 아닌 경우에는 "GCS 멤버만 사용가능합니다" 라는 메시지를 보여준다.
- string table 로 뺴서 처리해야 함

# 팀명 저장하기

- 로그인을 할떄 user 가 소속된 teamName 을 teams 컬렉션에서 찾아서 Client side state 에 저장해.
  - teams 컬렉션에는 teamName 과 emails 필드가 있어.
  - emails 필드는 array 고 여기에 내 email 이 있으면 그 팀이 내팀이야.
- 그리고 snippet 을 저장/업데이트 할때 teamName 과 userEmail 을 저장해줘.
