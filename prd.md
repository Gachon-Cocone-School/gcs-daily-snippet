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

# snippets 조회 기준 바꾸기

- snippets 컬렉션에서 아래의 기준으로 where 로 검색해야 함
  - teamName 이 내 팀 이름과 같아야 함.
  - date 가 조회하는 달력과 같은 달이어야 함.
  - 기존의 userId 기준으로 검색하는 건 지워야 함.

# email 로 접근하는 photo 와 display name 기능

- snippets 조회 후 모든 email 주소를 모아서 set 으로 만든다.
- set 에 있는 email 주소에 해당하는 photo url, display name 을 users 컬렉션에서 찾아온다.
- photo url 에 해당하는 이미지를 로딩해서 이미지 콤포넌트를 만든다.
- 이상의 정보를 client side 에 캐싱하고 email 로 접근 가능한 맵으로 만든다.
- 달력에 해당 날짜에 해당하는 snippet 에 email 에 해당하는 photo 를 보여준다.

# loading 로직 정리

- 현재는
  - 메인화면 로딩할때 Loading ... 이 끝나고
  - 달력이 보인 후 조금 있다가 임시 아바타(이니셜 아바타)가 보인후
  - 진짜 아바타가 보임.
- TOBE

  - 메인화면 Loading ... 이 끝나고
  - 달력이 보인후 "스니펫 데이터 조회중..." 메시자가 보이고
  - snippets 조회 후 photo url 로 아마타 이미지 로딩까지 sync 모드로 진행함.
  - 그리고 달력에 진짜 아바타를 한꺼번에 보여줘야함.

- "스니펫 데이터 조회중..." 메시자를 달력 가운데 z order 바꿔서 보여지게 하고
- 스트링 테이블로 뺴줘.

# 달력에 보이는 아바타 순서 및 위치 조정.

- 아바타 순서는 나를 제일 먼저 보여줘.
- 그리고 나머지는 modified_at 으로 오름차순 정렬해줘.
- 아바타는 최대 4개를 보여주고 그 이상은 +1, +2 식으로 보여줘.
- 반응형으로 달력안에 아바타 보이도록 조정해줘.

# snippet edit 화면 변경

- 제목을 "2025년 05월 03일 스니펫" 에서 스니펫 빼고 날짜만 보여줘.
- 해당 날짜의 스니펫을 모두 보여줘.
  - 순서는 내꺼, 다름사람은 modified_at 오름차순으로 보여줘
- 개별 스니펫은 아래처럼 보여줘.
  - 아바타 + display name
  - 스니펫
- 내꺼만 수정 가능하게 해줘는데 수정 버튼은 내꺼 위에 보여줘

# snippet edit 화면 수정 사항

- snippet 작성 화면이 먼저 뜨는데 보여주는 화면이 먼저 떠야해.
  - 오늘의 snippet 이 하나도 없을 경우에만 작성 화면이 먼저 떠야해.
- snippet 삭제 기능도 넣어줘. 수정 버튼 옆에 추가해줘.

# snippet edit 화면 편의 기능

- snippet 작성시 이전 데이터가 있을 경우에는 마지막 snippet 을 읽어 와서 기본 place holder 대신 보여주고 탭키를 누르면 적용해줘.
- 탭키를 누르면 적용된다는걸 아이콘 같은걸로 보여줘.
- 이젠 데이터가 없으면 snippetTemplate 스트링테이블 값을 읽어서 보여줘.
