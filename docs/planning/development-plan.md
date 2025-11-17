# 개발 계획

## 상태 표기
- `[ ]` Planned (계획)
- `[~]` In progress (진행 중)
- `[x]` Complete (완료)

## Milestone 0: Project Foundations
- `[x]` React + Vite TypeScript 템플릿으로 프로젝트 스캐폴딩. (2025-11-04, AI)
- `[x]` 핵심 의존성 추가 (`@tiptap/react`, `@tiptap/starter-kit`, `@mui/material`, `mui-tiptap`, 확장 세트). (2025-11-04, AI)
- `[ ]` `AGENTS.md` 지침에 맞춰 lint/format/test 스크립트 구성.
- `[x]` 기본 레이아웃 셸 구현 (RichTextEditorProvider 결선, 제목 필드/TOC 슬롯 구성). (2025-11-05, AI)

## Milestone 1: Core Editor Shell
- `[x]` `tiptap-mui`의 `RichTextEditorProvider`, `MenuControlsContainer`, `RichTextField` 통합. (2025-11-05, AI)
- `[x]` 기본 확장 세트 활성화 (paragraph, headings, lists, bold/italic/underline, code, blockquote). (2025-11-05, AI)
- `[x]` 에디터 본문과 연동되는 제어형 제목 필드 구현. (2025-11-05, AI)
- `[x]` 툴바 고정, 반응형 분할 레이아웃 등 MUI 테마/스타일 적용. (2025-11-05, AI)

## Milestone 2: Advanced Authoring Features
- `[~]` 고급 확장 추가 (tables, task lists, images, highlight, text alignment, syntax highlight code block). (기본 확장 세트 적용, 이후 시각 편집 기능 확장 예정)
- `[x]` 에디터 업데이트를 구독해 섹션으로 스크롤하는 TOC 컴포넌트 구현. (2025-11-05, AI)
- `[x]` 선택 및 드래그 재정렬이 가능한 좌측 블록 핸들 구현 (노션 스타일, hover 노출, 컨텍스트 Popper). (2025-11-05, AI → `@tiptap/extension-drag-handle-react` 기반으로 교체)
- `[ ]` 멀티 블록 선택 및 이동(Shift+클릭, 키보드 이동) 지원 추가.
- `[ ]` 코드 블록 언어 선택 드롭다운 및 자동 감지 옵션 제공.
- `[ ]` 이미지 업로드 UX 개선 (썸네일, 캡션, alt 입력).
- `[ ]` Task List UX 보완 (완료 항목 스타일, 전체 토글).
- `[~]` 툴바에서 `mui-tiptap`가 제공하는 테이블, 리스트, 텍스트 스타일, Undo/Redo 등 기능을 모두 노출. (2025-11-05, AI)
- `[ ]` 텍스트/배경 색상 선택기 추가 (참고 이미지 `2025-11-10 13 19 45.png`).
  - `[ ]` TipTap `Color`/`Highlight` 확장을 활성화하고, 커맨드를 `EditorToolbar`에서 호출할 수 있도록 통합.
  - `[ ]` 툴바에 드롭다운 버튼(예: `A` 아이콘) 추가, 클릭 시 Popover에 세 섹션(Text Color, Background Color, Suggested)을 6x2 그리드 형태로 렌더링.
  - `[ ]` 색상 팔레트는 디자인 참고 이미지 색상표를 그대로 사용(텍스트용 8색, 배경용 파스텔 8색, 추천 12색 등)하고, 선택된 색상은 테두리/체크 표시.
  - `[ ]` `Clear` 액션을 제공해 텍스트/배경 색상을 기본값으로 초기화.
  - `[ ]` 키보드 접근성(포커스 이동, Enter/Space 선택)과 i18n 문자열(`textColor`, `backgroundColor`, `suggested`, `clearColor`)을 추가.
  - `[ ]` Playwright/Vitest로 색상 적용 → caret 이동 → 스타일 유지/해제 시나리오 테스트.
  - `[ ]` 최근 사용 스타일 목록(최대 6개) 저장/표시: 색상을 적용할 때마다 MRU 큐 업데이트, 팝오버 상단에 `Recent` 섹션으로 노출.
  - `[ ]` FE 실행 단계
    1. `src/editor/extensions/color.ts`를 추가해 TipTap `Color`/`Highlight` 확장을 설정하고 `EditorProvider`에 등록한다(팔레트, class/style 옵션 포함).
    2. `src/components/editor/EditorToolbarColorMenu.tsx` 신설:
       - 팝오버/팔레트 UI 렌더, i18n 키 사용, 키보드 내비게이션 처리.
       - `useColorMenuState` 훅(또는 명령 래퍼)로 현재 색상/clear 동작 및 최근 색상 목록(MRU 6개) 관리(LocalStorage fallback).
    3. `EditorToolbar.tsx`에 드롭다운 버튼을 추가하고 compact/overflow 모드까지 반영.
    4. Vitest로 `useColorMenuState`의 명령 호출을 테스트하고, Playwright로 실제 UI 흐름을 자동화한다.
- `[ ]` 문단(AI Heading) 스타일 드롭다운을 첨부 이미지(`2025-11-10 13 26 15.png`)와 동일하게 구현.
  1. `src/components/editor/EditorToolbarParagraphMenu.tsx` 생성  
     - props: `editor`, `onClose`, `anchorEl`.  
     - 내부 데이터: `const paragraphOptions = [{ id: 'paragraph', label: 'text', icon: 'T' }, { id: 'heading1', label: 'heading.level1', icon: 'H1' }, ... H6 ]`.  
     - TipTap 명령: `editor.chain().focus().setParagraph()` 또는 `toggleHeading({ level: n })`.  
     - 현재 활성 상태는 `editor.isActive('paragraph')`/`isActive('heading', { level })` 로 계산해 `selectedId`.
  2. UI 요구사항  
     - Popover 컨테이너는 이미지처럼 high-contrast border + shadow.  
     - 각 항목은 2열(왼쪽 아이콘, 오른쪽 라벨/설명) 구조, hover/selected 시 배경색 변경.  
     - 상단 입력창(`Text layout` placeholder)에서 문자열을 입력하면 `paragraphOptions`를 필터링(대소문자 무시); ESC clears filter.  
     - 현재 선택된 항목은 초록색 하이라이트, 오른쪽에 체크 아이콘.  
     - Keyboard: Up/Down 이동, Enter 선택, ESC 닫기. Focus trap Popover.
  3. Toolbar 통합  
     - `EditorToolbar.tsx`에서 기존 paragraph button을 제거하고 `ToolbarDropdownButton icon={<ParagraphIcon/>} label={intl.t('toolbar.paragraph')}` 로 교체.  
     - compact/overflow 모드 동일 동작.  
     - 드롭다운 열릴 때 `EditorToolbarParagraphMenu`를 렌더하고, 닫기 이벤트로 상태 reset.
  4. 테스트  
     - Vitest: paragraphMenu util/command가 올바른 TipTap 명령 호출하는지 모킹.  
     - Playwright: h1 선택→텍스트 변환 확인, 검색 후 h3 선택, ESC 닫기 등 e2e 시나리오.
 - `[ ]` Emoji/Icon 삽입 메뉴(참고: `2025-11-10 13 28 20.png`) 추가.
   - 파일 구성  
     1. `src/lib/emojiCatalog.ts`:  
        ```ts
        export type EmojiEntry = { id: string; char: string; name: string; category: 'smileys' | 'hands' | ... };
        export const emojiCategories = [...];
        export const emojiList: EmojiEntry[] = [...];
        ```
     2. `src/components/editor/EditorEmojiMenu.tsx`:  
        - props: `editor`, `anchorEl`, `onClose`.  
        - state: `activeTab` ('emoji' | 'icons'), `search`, `recentEmojis` (max 12, persisted via `localStorage['recentEmojis']`).  
        - layout: Tab header (Emoji / Icons), search input, scrollable grid, footer category bar (emoji).  
        - each emoji button: `button aria-label={entry.name}`; on click → `editor.chain().focus().insertContent(entry.char).run()`; update MRU queue.
        - “Icons” 탭: `src/lib/iconCatalog.ts`에서 가져온 단색 아이콘들(SVG). Insert as inline span with class (`editor.commands.insertContent('<span class="icon icon-star"></span>')`).  
        - Recent section: 상단에 `recentEmojis` grid, `Clear recents` 버튼(모달 확인).
        - Keyboard: tabs focusable, grid arrow navigation(aria-activedescendant), Enter/Space insert.
   - Toolbar 통합:  
     - `EditorToolbar.tsx`에 emoji icon button 추가. Popover anchor state `emojiMenuAnchor`.  
     - Overflow/mobile에도 동일. Tooltip text from i18n `toolbar.emoji`.
   - 데이터/스타일  
     - emoji grid item size 40px, gap 4px, background on hover.  
     - Category bar icons(emoji or icon font) align bottom; clicking sets `activeCategory` filter.  
     - Search input filters by `name` and `keywords`.
   - 테스트  
     - Vitest: `useRecentEmojis` hook (push/pop, dedup, persist).  
     - Playwright: open menu → insert emoji → verify in doc → recent list includes inserted item → clear recents 버튼 동작.
- `[x]` 테이블 컨텍스트가 활성일 때 떠 있는 Table 메뉴(Popper) 제공. (2025-11-05, AI)
- `[ ]` `/` Slash Command 팔레트 구현 (노션 스타일 블록 삽입 UX).
  - `[ ]` 빈 블록 선두에서 `/` 입력 시 트리거를 가로채고 검색 질의 상태로 전환, 탭/엔터/ESC 키 이벤트 핸들링 정의.
  - `[ ]` 캐럿이 비어 있는 블록 선두일 때 힌트 플레이스홀더(예: “Type `/` to open commands”) 표시, `/` 입력 시 자동 숨김.
  - `[ ]` caret 위치를 기준으로 떠 있는 Popper/Panel 렌더러 작성 (뷰포트 경계 내 위치 클램프, 마우스 클릭 외부 시 닫힘).
  - `[ ]` “Proposed Features” 퀵 액션(텍스트, Heading1~6, bullet/number list, task list, quote, code, formula, 링크, 표) 그리드 레이아웃 구현.
  - `[ ]` “Basic Block”/“More Block” 섹션 그룹과 서브메뉴(예: Text & Headline, Align & Indent) 지원 자료구조 설계.
  - `[ ]` 명령 카탈로그(아이콘, 라벨, 키워드, 실행 함수) JSON/TS 정의 및 필터링 로직 구현(검색어에 따른 그룹 유지).
  - `[ ]` 실행 시 슬래시 트리거 삭제 후 해당 TipTap 명령 실행(heading/paragraph 전환, 리스트 토글, 코드 블록 삽입 등).
  - `[ ]` 마우스/키보드 내비게이션 포커스 스타일 + 접근성 속성(aria-activedescendant 등) 적용.
  - `[x]` `/h1`–`/h6` 명령으로 현재 블록을 Heading 레벨 1~6으로 변환하는 기본 흐름 구현(Enter/Space 트리거 포함).
  - `[ ]` `/h1`–`/h6` 외 slash 명령 UI 목록과 라벨/설명 팝오버 or 모달 설계.
  - `[ ]` `/?` 입력 시 슬래시 명령 + 자주 쓰는 단축키 요약 모달(스크롤 가능, ESC/X/닫기 버튼으로 종료) 구현.
  - `[ ]` 헤딩·문단 전환 단축키(`Ctrl+Alt+0~6`) 정의 및 TipTap 키맵에 연결.
  - `[ ]` Vitest/Playwright 기반으로 슬래시 호출 → 항목 선택 → 블록 변환 흐름 스펙 추가.
  - `[ ]` 초기에는 `/ai` 단일 명령 흐름을 완성(프롬프트 입력 → 드래프트 표시 → 취소/확정)하고, 동작 검증 후에 `/summarize`, `/table` 등 다른 추천 명령을 확장.
  - `[ ]` AI 특화 슬래시 명령(`/ai`, `/summarize`, 등) UX 정의: 입력 라인 하이라이트(연한 파랑) + 캐럿 뒤 안내 문구(예: “AI가 도와드릴까요? 내용을 입력해 주세요.”).
  - `[ ]` 슬래시 명령은 `/` 누른 즉시 메뉴가 열리고, 명령어는 공백 없이 입력 후 스페이스로 확정(`/ai␠` → 프롬프트 모드). 엔터는 메뉴 확정용이며 파라미터 입력 전까지 사용하지 않음.
  - `[ ]` Dummy AI API 함수(`requestAiCompletion`) 연결: 1~5초 랜덤 지연을 둬 네트워크 호출처럼 보이게 한 뒤, 로딩 스피너 표시 → 응답 후 임시 드래프트 삽입.
  - `[ ]` AI 응답은 Markdown/HTML 어느 형식이든 TipTap `insertContent`로 안전하게 삽입할 수 있도록 변환 헬퍼를 마련(`@tiptap/extension-markdown` 또는 HTML 파서 활용).
  - `[ ]` 드래프트 블록 상단에 “적용 취소” 아이콘 버튼 노출, 다른 위치 클릭하거나 추가 입력이 발생하면 버튼 자동 제거.
  - `[ ]` 드래프트 삽입 직후 캐럿은 첫 번째 드래프트 단락의 선두에 유지, Slash 명령 실행 위치와 동일하게 고정.
  - `[ ]` 취소 시 드래프트 제거, 확정 시 일반 텍스트로 전환; Playwright 시나리오로 회귀 검사.
- `[ ]` 텍스트/배경 색상 선택기 커스터마이징 (3단 그리드 UI).
  - `[ ]` 기존 `MenuButtonTextColor`/`MenuButtonHighlightColor` 대신 공용 ColorPicker 컴포넌트 설계(팝오버 기반).
  - `[ ]` 섹션 레이아웃 구성: `Text Color`/`Background Color`/`Suggested` 3단, 각 섹션별 팔레트 배열 및 상태 관리.
  - `[ ]` 선택 상태(테두리 강조)·Clear 액션·키보드 내비게이션 지원.
  - `[ ]` UX 변경에 맞춰 색상 팔레트 정의(HEX 값, 대비 확인) 및 TipTap mark 명령 연동.
  - `[ ]` Storybook or Jest DOM 테스트로 팔레트 렌더링·선택·clear 동작 검증.
  - `[ ]` 컴포넌트 API를 범용화해 향후 하이라이트/테이블 등 모든 색상 피커를 동일 UI로 대체할 수 있도록 설계.
- `[ ]` 인라인 텍스트 메뉴(플로팅 미니 툴바) 구현. (참고 이미지 `2025-11-10 13 31 15.png`)
    1. 트리거  
       - 문단 핸들(점 아이콘) 클릭 또는 텍스트 선택 시 `useInlineToolbar` 훅이 selection 정보를 수집.  
       - 비텍스트 노드/빈 블록에서는 숨김, 다른 UI(슬래시·메뉴)보다 우선순위 낮음.
    2. 버튼 구성 (왼→오 순)  
       - Paragraph dropdown(아이콘 `T`), Bold, Italic, Underline, Strikethrough, Color menu, Align dropdown, List dropdown, Emoji button.  
       - 모든 드롭다운/컬러/이모지 버튼은 상단 툴바에서 구현한 컴포넌트를 재사용(같은 Popover anchor/props).  
       - 상태는 `editor.isActive`/`getAttributes`로 반영.
    3. 레이아웃/위치  
       - 박스: radius 9999px, 배경 #f7f9fa, 그림자, 내부 padding 6px.  
       - 위치 계산: selection rect 중앙 기준, 화면 밖이면 좌/우/위 플립. 스크롤/리사이즈 시 `requestAnimationFrame`으로 재계산.  
       - 모바일 너비 < 640px 에서는 화면 하단 고정 바 형태로 전환.
    4. 상호작용  
       - 키보드: Tab/Shift+Tab으로 이동, Arrow keys optional, Enter/Space 실행, ESC 닫기.  
       - 메뉴 외 클릭, ESC, focus out 시 닫힘.
    5. 테스트  
       - Vitest: `useInlineToolbar` 훅(selection 감지/좌표 계산) 단위 테스트.  
       - Playwright: 문단 핸들 클릭 → Bold 토글 → Paragraph 드롭다운에서 H2 선택 → Color 적용 → 메뉴 자동 닫힘 회귀 시나리오.
- `[ ]` 링크 삽입/편집 레이어 구현.
    - `[ ]` 인라인 메뉴의 링크 버튼 클릭 시 caret 위치에 팝업 호출, Display Text/Link 입력 UI 제공.
    - `[ ]` 신규 링크 시 Display Text는 현재 선택 텍스트, Link 입력에는 포커스 자동 이동(placeholder: EN `Insert URL or Search pages`, KO 번역).
    - `[ ]` 기존 링크 편집 시 URL 미리 채움, 링크 hover 시 미니 툴바(열기/편집/복사/삭제) 노출.
    - `[ ]` 내부 페이지/헤딩 검색 자동완성(최대 5건, 긴 제목은 `…` 처리) 및 키보드 선택 지원.
    - `[ ]` 초기 상태에서 더미 문서 링크 2~3개 + 현재 문서 헤딩 목록을 제안 목록으로 표시, 선택 시 URL/앵커 자동 채움.
    - `[ ]` Insert/Cancel 동작: 링크 적용 후 팝업 닫기, Cancel 시 변경 취소.
    - `[ ]` 링크 복사 시 토스트 노출, 삭제 시 즉시 plain text로 변환.
    - `[ ]` Vitest/Playwright로 입력/검색/편집/삭제 시나리오 검증.
    - 참고 자료: ![Link layer spec](docs/assets/editor-link-layer-spec.png)
- `[ ]` 에디터 상단 툴바 가변 표시(Show/Hide) 토글.
    - `[ ]` 툴바 좌측에 접기 버튼 추가, 클릭 시 툴바 전체 숨김.
    - `[ ]` 숨김 상태에서도 사용자가 다시 펼칠 수 있는 부동 버튼(tooltip: Show toolbar) 노출.
    - `[ ]` 토글 상태는 로컬 스토리지 등으로 기억, 여러 에디터 인스턴스에 일관 적용.
    - `[ ]` 애니메이션과 레이아웃 변화를 점검, 슬래시 힌트 등 다른 UI와 겹치지 않도록 조정.
    - `[ ]` 접근성: 버튼 라벨/aria-expanded 제공, 키보드로 토글 가능.
    - 참고 자료: ![Toolbar toggle spec](docs/assets/editor-toolbar-toggle-spec.png)
- `[ ]` TOC 패널 좌측 고정 및 툴바 토글 버튼 도입.
  - `[ ]` TOC 컨테이너를 레이아웃 좌측 컬럼으로 이동, 에디터 본문은 우측 주요 영역으로 확장.
  - `[ ]` 툴바 좌측에 TOC 표시 토글 버튼 추가(아이콘/라벨, tooltip 포함).
  - `[ ]` 토글 상태에 따라 TOC 패널 show/hide 애니메이션 및 레이아웃 전환 정의.
  - `[ ]` 모바일/좁은 폭 대응: 토글 기본 비활성 + 오버레이 레이어로 표시.
  - `[ ]` 접근성: 버튼 aria-controls/expanded, 패널 focus trap 없이도 키보드 탐색 가능.
  - `[ ]` 회귀 방지 테스트(레이아웃 스냅샷 or Playwright) 추가.
  - 참고 자료: ![TOC left layout](docs/assets/editor-layout-toc-left.png)
- `[ ]` TOC 축소/확장 레이아웃 및 항목 표시 규칙 구현.
  - `[ ]` 좌측 패널 접힘 상태에서는 슬림 아이콘만 유지, 펼칠 때 헤딩 리스트 표시.
  - `[ ]` 헤딩 텍스트 길이 초과 시 `…` 처리, hover 시 전체 제목 tooltip.
  - `[ ]` 현재 선택된 헤딩으로 자동 스크롤, 포커스/키보드 이동 지원.
  - `[ ]` 상단 토글 버튼과 패널 상태 연동(드래그/애니메이션 포함).
  - 참고 자료: ![TOC collapse spec](docs/assets/editor-toc-layout-spec.png)

## Milestone 3: Polish & QA
- `[ ]` 제목/본문 상호작용, 툴바 명령, TOC 갱신, 블록 드래그에 대한 단위/통합 테스트 작성.
- `[ ]` 포커스 관리, aria-label, 키보드 대안 등을 포함한 접근성 검토.
- `[ ]` 저장소 README 또는 별도 가이드에 사용 방법과 확장 포인트 정리.
- `[ ]` PR용 데모 콘텐츠와 스크린샷 준비.

## Backend & Sharing Roadmap

- `[ ]` 초기 DB는 서버 없이 SQLite로 구축하고, Prisma 기반 마이그레이션을 PostgreSQL/Supabase로 전환 가능하도록 설계한다.
- `[ ]` 워크스페이스/사용자/권한/공유 설계 초안은 `docs/planning/workspace-permission-design.md` 문서를 최신 상태로 유지하고, 구현 전 리뷰한다.
- `[ ]` 백엔드 전 단계는 `docs/planning/workspace-permission-design.md`의 Testing & TDD Requirements에 따라 테스트 선행(TDD) 및 전 시나리오 자동화 케이스를 정의한 뒤 구현한다.

### 계정/워크스페이스
- `[ ]` 인증/가입 플로우 구축(이메일/비밀번호 + OAuth 검토) 및 기본 워크스페이스 생성.
- `[ ]` 일반적인 회원 기능(프로필 편집, 비밀번호 재설정, 이메일 검증, 2FA 옵션) 요구사항을 명세하고 API/UI에 반영.
- `[ ]` 마스터 프로필(글로벌 계정)은 로그인/복구용 최소 정보(이메일, 패스워드, 복구 연락처 등)만 보관하고, 표시 이름·언어·역할 등 나머지 속성은 워크스페이스별 프로필을 따르도록 분리.
- `[ ]` 사용자 인증은 외부 OAuth 프로바이더(예: Google, Microsoft 등)에 위임하고, 토큰 교환 이후에는 우리 서비스가 자체 세션/쿠키로 인증 상태를 유지하며 프로필/워크스페이스 정보를 관리하도록 설계.
- `[ ]` 백엔드도 Node.js 기반(Express/Fastify/Nest 등)으로 구성해 FE와 동일 스택을 활용하며, 모노레포에서 FE(Vite 빌드)와 API 서버를 함께 운영하되 배포는 역할별로 분리한다.
- `[ ]` 공개 워크스페이스 검색/필터 API, 가입 신청/자동 가입 옵션 구현.
- `[ ]` 워크스페이스 메타데이터 스키마 정의(이름, 설명, 커버/아이콘, 기본 로케일, 공개 범위, 생성자, 생성일, 마지막 활동, 플랜/좌석, 기본 권한 정책).
- `[ ]` 워크스페이스 역할(`owner`, `admin`, `member`)과 엔터프라이즈 권한 표 정의.
- `[ ]` 계정:Workspace = 1:N 관계 정의(사용자는 여러 워크스페이스를 생성/가입 가능)하고, 워크스페이스별로 별도 프로필/역할/알림 설정을 저장하도록 모델링.
- `[ ]` 워크스페이스마다 `owner`는 정확히 1명만 유지하고, `admin`이 할 수 있는 모든 권한 + 워크스페이스 삭제 권한을 가진다는 점을 명시.
- `[ ]` `owner`가 워크스페이스를 떠나거나 탈퇴하려면 다른 사용자에게 소유권을 위임하는 UI/API(소유권 이전 → 본인 탈퇴) 흐름을 제공.
- `[ ]` 글로벌 계정 탈퇴 시 모든 워크스페이스 멤버십에서 제거되고, 각 워크스페이스에서 `owner` 역할을 맡고 있다면 탈퇴 전 반드시 소유권 이전 또는 워크스페이스 삭제를 완료하도록 강제.
- `[ ]` 워크스페이스 단위 초대/수락/거절 API, 초대 메일 발송, 관리자 초대/해임 UI 연동.
  - `[ ]` `owner/admin`이 이메일 기반 초대장을 생성하면 JWT 등 서명 토큰을 포함한 링크를 메일로 발송하고, 필요 시 초대 메일 재발송 기능 제공.
- `[ ]` 워크스페이스별 도메인 허용 리스트를 설정해 특정 이메일 도메인은 별도 승인 없이 즉시 가입되도록 옵션 제공(예: `@company.com` 자동 허용).
- `[ ]` 워크스페이스 가입 신청 → 승인/거절 흐름 설계: 신청자는 `pending` 상태로 저장되고, `owner/admin`이 승인할 때까지 접근 제한.
- `[ ]` 워크스페이스별 멤버 프로필 스키마 정의(표시 이름, 유저네임, 아바타, 연락처, 언어/시간대, 알림 설정, 소셜 연동, 접근 로그) 및 글로벌 마스터 프로필과의 동기화 규칙 문서화.

### 문서 저장/불러오기
- `[ ]` JSON 기반 문서 저장 API (`editor.getJSON()` → 저장 / `setContent` → 복원)와 버전 관리.
- `[ ]` Markdown/HTML 임포트 → JSON 변환 유틸(붙여넣기 훅 포함).
- `[ ]` 저장/불러오기 UI, 로딩/에러 상태 표시, Autosave 전략 설계.
- `[ ]` 워크스페이스별 문서를 디렉터리(폴더) 구조로 분류하고, 문서 단위 태그를 부여/검색/필터링할 수 있는 분류 모델 정의.
- `[ ]` 디렉터리 권한 정책 정의: `owner/admin`이 만든 보호 폴더는 일반 사용자가 수정/삭제할 수 없고, 읽기/문서 생성만 가능하도록 ACL을 분리.

### Backend Milestones (10단계)
1. **B1 – Identity Foundation**
   - `[ ]` 마스터 계정 가입/로그인, 이메일 인증, 비밀번호 재설정/복구 채널, 기본 보안 로그.
2. **B2 – Workspace Skeleton**
   - `[ ]` 워크스페이스 생성/삭제/조회, 메타데이터(이름·설명·커버·기본 로케일) 편집, 계정:Workspace 1:N 모델 확정.
3. **B3 – Member Profiles & Roles**
   - `[ ]` 워크스페이스별 멤버 프로필(표시 이름, 언어, 알림 설정) 저장, 글로벌 계정과 동기화 규칙, 역할(`owner/admin/member`) 및 owner 단일성, 소유권 이전/탈퇴 제약.
4. **B4 – Invitations & Domain Policies**
   - `[ ]` 이메일 초대(JWT 링크, 재발송), 도메인 허용 즉시 가입, 가입 신청 `pending` 상태 및 승인/거절 UI.
5. **B5 – Document Persistence MVP**
   - `[ ]` JSON 저장/불러오기 API, 폴더/태그 분류, 보호 폴더 ACL, 기본 공유 범위(개인/워크스페이스), Viewer/Editor 권한.
6. **B6 – Content Utilities & Autosave**
   - `[ ]` Markdown/HTML 임포트(붙여넣기), Autosave 초안, 수동 버전 스냅샷, 문서 메타(설명/키워드) 및 템플릿 복제, PDF/Markdown export.
7. **B7 – Sharing & Notification Enhancements**
   - `[ ]` 공유 링크(만료/비밀번호 옵션), 문서별 알림 설정, 감사 로그 초안, 디렉터리별 권한 UI.
8. **B8 – Collaboration Layer**
   - `[ ]` 주석 스레드/멘션/이모지, 기본 활동 피드, Find & Replace/검색 통합, 첨부/임베드 확장 1차(이미지/파일/외부 카드).
9. **B9 – Realtime & Offline Editing**
   - `[ ]` 멀티 커서/실시간 동기화, 충돌 감지, 오프라인 캐시/재동기화, 문서 잠금/체크아웃, 문서 상태 워크플로우(초안→검토→승인).
10. **B10 – Advanced Productivity & AI**
    - `[ ]` 제안 모드/Track Changes, 고급 버전 히스토리(diff/복원), 첨부/임베드 2차(비디오·다이어그램), 단축키 팔레트/Slash 확장/AI 보조, 공유 링크 고급 ACL(Viewer/Commenter/Editor 구분).

#### 실행 현황 (A–F 세부 단계)
- `[x]` **A1 – Account Storage**: Prisma 계정 테이블/리포지토리/비밀번호 해시 검증 완료 (2025-11-17).
- `[x]` **A2 – Session & Auth API**: 로그인/로그아웃/세션 토큰/재발급 흐름과 테스트 완료 (2025-11-17).
- `[x]` **A3 – Account Deletion & Recovery**: 비밀번호 재설정/계정 삭제/세션 무효화 플로우 완료 (2025-11-17).
- `[x]` **B1 – Workspace Creation Basics**: 워크스페이스 생성/조회/소유자 자동 지정 구현 및 테스트 (2025-11-17).
- `[x]` **B2 – Workspace Metadata & Delete**: 메타데이터 수정/삭제(Soft delete) API 및 검증 시나리오 완료 (2025-11-17).
- `[x]` **C1 – Membership Model**: WorkspaceMembership 스키마, 역할/상태 제약, 목록/추가 테스트 완료 (2025-11-17).
- `[x]` **C2 – Invitations & Join Requests**: 초대/가입요청/도메인 허용/만료 처리 및 테스트 완료 (2025-11-17).
- `[x]` **C3 – Role Transitions & Ownership Transfer**: 역할 변경/소유권 이전/탈퇴 제약 테스트 포함 완료 (2025-11-17).
- `[x]` **D1 – Folder & Document Metadata**: Step-S9 사양 + Prisma 스키마 확장 + 폴더/문서/리비전 서비스/TDD 완료 (2025-11-17).
- `[x]` **D2 – Document Permissions (Internal)**: DocumentPermission 테이블, 기본 접근 정책, 권한 평가 서비스/TDD 완료 (2025-11-17).
- `[x]` **D3 – Document Actions & Validation**: 문서 GET/PATCH/DELETE + 리비전 조회, 낙관적 잠금, 플랜 훅/테스트 완료 (2025-11-17).
- `[x]` **E1 – Share Links (View/Comment)**: 공유 링크 생성/조회/토큰 검증 + 비밀번호/만료/테스트 완료 (2025-11-17).
- `[x]` **E2 – External Collaborators (Edit)**: 외부 협업자 프로필, 게스트 세션 토큰, allow_external_edit 플로우 및 테스트 완료 (2025-11-17).
- `[ ]` **F1 – Audit Logging**: 감사 로그 스키마/조회/주요 액션 기록 예정.
- `[ ]` **F2 – Governance & Rate Limiting**: 거버넌스/레이트 리밋/삭제 안전장치/템플릿 정책 예정.


### Workset Bundles & Dependencies
| Workset | 포함 기능 | 같이 묶는 이유 | 선행 필요 |
| --- | --- | --- | --- |
| W1: Identity Core | B1 전체 | 인증/복구/보안 로그가 동시에 있어야 서비스 접근이 가능 | 없음 |
| W2: Workspace Shell | B2 전체 | 워크스페이스 CRUD와 메타 편집은 동일 모델/테이블을 공유 | W1 |
| W3: Membership & Roles | B3 전체 | 워크스페이스 프로필·역할·소유권 로직을 한 번에 정의해야 중복 마이그레이션 방지 | W1, W2 |
| W4: Invitations & Domain Policy | B4 전체 | 초대·도메인 자동 가입·pending 승인은 동일 큐/토큰 인프라를 공유하므로 동시 구현이 효율적 | W1–W3 |
| W5: Document Persistence | B5 전체 | 문서 JSON 저장, 폴더/태그, 기본 공유/권한은 저장소 스키마가 묶여 있어 분할이 어렵다 | W2, W3 |
| W6: Content Utilities | B6 전체 | Autosave·임포트·버전 스냅샷·템플릿·Export는 편집기 I/O 파이프라인을 공유 → 한 번에 구성 | W5 |
| W7: Sharing & Notifications | B7 전체 | 공유 링크/알림/감사 로그/폴더 ACL UI는 권한/이벤트 버스 구성이 같아 함께 해야 효율적 | W5, W6 |
| W8: Collaboration UX | B8 전체 | 주석/멘션/활동 피드/검색/첨부 확장 1차가 동일 문서 메타/이벤트 모델을 사용 | W6, W7 |
| W9: Realtime & Offline | B9 (단일) | 가장 난도가 높으므로 다른 기능과 묶지 않고 단독 스프린트로 처리 | W8 |
| W10: Advanced Productivity & AI | B10 (단일) | Track Changes, 고급 버전, AI/Slash 확장은 독립 연구가 필요해 전담 단계로 유지 | W9 |

### Frontend Worksets (백엔드와 짝지어 개발)
| FE Workset | 연동 BE 단계 | 포함 UI/클라이언트 기능 | 메모 |
| --- | --- | --- | --- |
| F1: Auth Shell | W1 | 가입/로그인 폼, 이메일 검증 흐름, 비번 재설정, 보안 이벤트 토스트 | 인증 토큰/세션 헬퍼, 로딩/에러 상태 공통 컴포넌트 |
| F2: Workspace Dashboard | W2 | 워크스페이스 리스트/생성/삭제, 메타 편집 모달, 기본 빈 상태 화면 | 다중 워크스페이스 전환 UI, 커버 업로드 |
| F3: Member Profiles & Role Badges | W3 | 워크스페이스 프로필 편집, 역할 뱃지, owner 전환 흐름, 탈퇴 확인 | 프로필 저장 시 글로벌/워크스페이스 분기 처리 |
| F4: Invitations & Domain Rules | W4 | 이메일 초대 UI, 재발송 버튼, 도메인 허용 설정, 가입 신청 승인 보드 | pending 상태 필터/알림, 토큰 수락 페이지 |
| F5: Document Library MVP | W5 | 폴더 트리, 태그 필터, 문서 카드, 공유 범위 토글, Viewer/Editor 권한 UI | 보호 폴더 표시(잠금 아이콘), 빈 상태 CTA |
| F6: Editor Utilities | W6 | Autosave indicator, 임포트(파일/붙여넣기) 다이얼로그, 수동 버전 버튼, 템플릿 선택, PDF/MD export | 상태바, 저장 실패 리트라이 UX |
| F7: Sharing & Alerts | W7 | 공유 링크 생성/만료 설정, 알림 환경설정 패널, 감사 로그 리스트, 폴더 ACL 뷰어 | 이벤트 히스토리 필터, 알림 채널 토글 |
| F8: Collaboration UI | W8 | 댓글/멘션 패널, 활동 피드, 검색/바꾸기 패널, 첨부/임베드 카드 UI | 실시간 업데이트를 대비한 옵저버 구조 |
| F9: Realtime/Offline Experience | W9 | 멀티 커서 색상/툴팁, 연결 상태 배지, 문서 잠금 배너, 오프라인 배너/merge 다이얼로그 | 충돌 알림 UX, 잠금 요청/해제 버튼 |
| F10: Advanced Productivity & AI | W10 | 제안 모드 토글, Change list 리뷰, 고급 버전 diff 뷰, Slash/AI 패널, 공유 권한 상세 편집 | 복잡도 높아 단독 스프린트, 실험 플래그 필요 |

### 실행 순서 & Next-Step 메모
- **Step 0 – 에디터 안정화:** 현재 구축된 문서 편집/툴바/TOC 기능의 버그와 레이아웃 이슈를 우선적으로 수정한다. (백엔드 작업 전에 반드시 완료)
- **Step S1 이후:** 아래 “Detailed FE+BE Implementation Steps” 표에 정리된 S1→S27 순서를 그대로 따른다.

> “다음에 무엇을 해야 하지?”라는 질문이 나오면 **Step 0 완료 여부를 먼저 확인**하고, 이후 표에서 가장 앞에 있는 미완료 Step(S1부터)을 답변으로 제시한다.
> 또한 실제 구현 전에는 항상 현재 코드/서비스 상태를 직접 실행해 문서와 일치하는지 확인하고, 차이가 있으면 문서를 먼저 갱신한 뒤 개발을 시작한다. 구현 후에는 mcp Chrome DevTools 세션으로 실제 UI를 열어 동작을 다시 검증한다.
> 모든 기능은 TDD 흐름으로 진행한다(테스트 추가/갱신 → 코드 구현 → 테스트 통과 확인 → MCP로 UI 검증). 테스트를 작성하기 좋은 구조(모듈화, 의존성 주입 등)를 먼저 준비하고, 새 기능마다 **테스트 추가 → 실행 → 성공 확인**까지 완료한 뒤에만 commit/push를 진행한다.

### Detailed FE+BE Implementation Steps
| Step | Backend Scope | Frontend Scope | 구현/동작 메모 |
| --- | --- | --- | --- |
| S0 | (해당 없음) 기존 TipTap 편집기, TOC, 툴바, 반응형 레이아웃 버그 수정 | 동일 | 린트/테스트 통과, 레이아웃 스냅샷 갱신 후 다음 단계 진행 |
| S1 | 외부 OAuth 프로바이더 연동(Authorization Code), 토큰 교환, 세션 토큰 발급, 계정 레코드 생성/매핑 | OAuth 로그인 버튼, 리디렉션 핸들러, 세션 스토리지 헬퍼, 에러/로딩 토스트 | 외부 OAuth는 인증만 담당, 토큰 교환 후 우리 서버가 HttpOnly 세션/쿠키를 발급해 이후 모든 API 호출에 사용 |
| S2 | OAuth 연결 상태 조회/갱신, 추가 프로필 정보(서비스용 이메일, 알림 주소, 복구 연락처) 수집 API | OAuth 연동 상태 배너, 추가 프로필 입력 UI, 알림 이메일 확인 흐름 | 내부 비밀번호는 없고, 연락처 검증만 수행(코드 발송/확인) |
| S3 | 워크스페이스 생성/삭제/조회 API, 기본 메타 필드 저장 | 워크스페이스 리스트, 생성 모달, 삭제 확인, 빈 상태 안내 | 새 워크스페이스 생성 시 owner 자동 할당, 삭제는 soft-delete + 확인 문구 |
| S4 | 워크스페이스 커버 업로드, 설명/로케일 업데이트 API | 워크스페이스 상세 편집 패널, 커버 업로드 UI, 프리뷰 반영 | 업로드는 서명 URL/S3, FE는 업로드 진행률/재시도 제공 |
| S5 | 워크스페이스별 멤버 프로필 저장, 언어/알림 설정, 기본값 상속 로직 | 프로필 편집 다이얼로그, 언어 선택기, 알림 토글, 표시 이름 | 저장 시 글로벌 계정과 분리된 워크스페이스 컨텍스트를 명확히 표기 |
| S6 | 역할 관리 API(owner/admin/member), owner 단일성 보장, 소유권 이전 & 탈퇴 제약 | 멤버 리스트 테이블, 역할 드롭다운, owner 전환 모달, 탈퇴 흐름 | owner 탈퇴 가드, 서버 트랜잭션 처리, FE는 경고 배너 |
| S7 | 이메일 초대 생성/취소/재발송 API(JWT 링크), 초대 상태 추적 | 초대 작성 폼, 재발송 버튼, 초대 상태 뱃지, 링크 수락 화면 | 토큰 1회성/만료, 수락 페이지에서 계정 생성 vs 로그인 분기 |
| S8 | 도메인 허용 리스트, 자동 가입, 가입 신청 `pending` 상태 저장 | 도메인 허용 설정 UI, 가입 신청 승인/거절 보드, 상태 필터 | pending 승인 시 알림 발송, 자동 가입 결과 배너 |
| S9 | 문서 JSON 저장/로드 API(`editor.getJSON`, `setContent`), 기본 metadata | 에디터 초기화 시 로드, 저장 버튼, 실패 재시도, 로딩 스켈레톤 | Optimistic save, 실패 시 배너, 서버는 버전 필드 증가 |
| S10 | 폴더 트리 CRUD, 태그 CRUD & 연결 테이블 | 사이드바 폴더 트리, 태그 필터 chips, 태그 편집기 | 드래그앤드롭 정렬, 태그 검색, URL 쿼리 동기화 |
| S11 | 보호 폴더 ACL, 권한 검사 미들웨어 | 잠금/권한 뱃지, 비허용 작업 disabled + 툴팁 | 서버 403 처리, FE 친절한 가이드 메시지 |
| S12 | 기본 공유 모델(개인/워크스페이스/특정 멤버), Viewer/Editor 권한 | 공유 모달, 권한 선택기, 사용자 검색 auto-complete | ACL 테이블, debounce 검색, 권한 요약 칩 |
| S13 | Autosave 드래프트, lastSeenVersion 저장 | Autosave indicator, “저장됨/저장 중” 상태, 오프라인 경고 | 5초 debounce, blur 시 강제 저장, 서버 delta 기록 |
| S14 | Markdown/HTML 임포트 API/변환 유틸, 보안 필터링 | 파일 업로드/붙여넣기 모달, 미리보기, 변환 결과 삽입 | XSS sanitize, 실패 로그, undo/redo 호환 |
| S15 | 수동 버전 스냅샷, 버전 리스트/복원 API | 버전 패널, 복원 버튼, 확인 모달 | 복원 시 현재 상태 백업 후 덮어쓰기, 작성자/시간 표시 |
| S16 | 템플릿 저장/공유 API, 워크스페이스 템플릿 갤러리 | 템플릿 선택 다이얼로그, “템플릿으로 저장” 버튼, 카드 뷰 | 템플릿 메타(아이콘/카테고리), 권한 |
| S17 | Export 서비스 (PDF renderer, Markdown exporter) + 비동기 작업 상태 | Export 메뉴, 진행 토스트, 다운로드 링크/히스토리 | PDF는 서버 렌더링 또는 queue, 독립 실행 가능 티켓 |
| S18 | 공유 링크 만료/비밀번호 옵션, 감사 로그, 문서별 알림 설정 | 공유 링크 관리 UI, 알림 채널 토글, 감사 로그 테이블 | 감사 로그 페이지네이션, 알림 채널별 토글 |
| S19 | 댓글/멘션/이모지 API, 알림 훅 | 댓글 패널, 인라인 핀, @mention dropdown, 이모지 반응 | 실시간 업데이트 대비 store, resolved 상태 |
| S20 | 활동 피드, 검색/바꾸기 API(본문/태그/댓글) | 활동 피드, 검색/바꾸기 패널, 결과 하이라이트 | 검색 네비게이션, 백엔드 query builder |
| S21 | 첨부/임베드 업로드, 미디어 ACL, 외부 URL preview | 첨부 패널, embed 카드, 업로드 진행 표시 | signed URL, drag-drop/clipboard 붙여넣기 |
| S22 | 멀티커서 동기화, presence channel, 충돌 감지 | 커서 색상/툴팁, presence indicator, 충돌 배너 | WebSocket/CRDT, awareness store |
| S23 | 오프라인 캐시/재동기화, diff/merge API | 오프라인 배너, 재연결 merge 다이얼로그, 저장 queue | IndexedDB 캐시, conflict UI |
| S24 | 문서 상태 워크플로우 API(초안/검토/승인/게시) + reviewer 할당 | 상태 배지, reviewer 지정, 승인 요청/알림 | 상태 변경 이력, 승인 후 읽기전용 옵션 |
| S25 | Track Changes/제안 모드 API | 제안 모드 토글, 변경 목록, accept/reject UI | change set 저장, inline decoration |
| S26 | 고급 공유 권한(Role: Viewer/Commenter/Editor/Owner) + 링크 보안(비밀번호/도메인 제한) | 권한 매트릭스 UI, 링크 보호 설정, 접근 시 인증 뷰 | 정책 엔진, 링크 보호 안내 |
| S27 | Slash/AI 명령, AI 작업 큐, audit trail | Slash palette 확장, AI 패널, 결과 삽입/취소, 비용 경고 | AI proxy, rate limit, streaming UI |

> 독립 실행 가능 항목(PDF Export 등)도 앞선 단계가 준비됐다면 별도 티켓으로 뽑을 수 있지만, 기본적으로 표의 순서를 따르는 것이 디버깅과 QA에 유리하다.

### 실행 산출물 & 가이드
- **API 계약서**  
  - 각 Step 착수 시 `docs/api/step-S{번호}.md`에 엔드포인트, 요청/응답 JSON, 인증 방식(HttpOnly 세션, 필요 시 내부 JWT)과 에러 코드를 정의한다.  
  - FE/BE가 동시에 참조하며 변경 시 동일 문서에서 버전 기록을 남긴다.

- **테스트 체크리스트**  
  - Step별 e2e/단위 테스트 요구사항을 `tests/checklists/S{번호}.md`에 작성하고, 완료 기준(예: “S9: 새 문서 저장→페이지 새로고침 후 복원”)을 명시한다.  
  - QA는 리스트를 기반으로 수동 검증, CI는 관련 Vitest/Playwright 스위트를 연결.

- **예외/실패 흐름**  
  - 초대 토큰 만료, 공유 링크 비밀번호 오류, Export 실패, OAuth 로그인 실패, owner 미존재 워크스페이스 등 주요 예외 시나리오를 `docs/specs/error-flows.md`에 정리한다.  
  - 각 시나리오별 서버 응답, FE UX(배너/모달), 재시도/지원 연락 링크를 포함한다.

- **기술 스택 결정**  
  - 실시간 협업: TipTap의 `Collaboration` + `CollaborationCursor` 확장(무료, ProseMirror + Yjs 기반)을 self-host 방식으로 사용하고, Tiptap Cloud 상용 옵션은 추후 필요 시 검토한다.  
    - Yjs WebSocket 서버(`y-websocket`)를 Node.js 환경에서 직접 운영하고, 문서별 awareness 상태 및 저장소(예: Redis or persistence adapter)를 구성한다.
  - 오프라인/충돌 해결: Yjs awareness + IndexedDB 캐시를 활용한다.  
  - 첨부 저장: 서명 URL + 객체 스토리지(S3 호환) 기본, 향후 CDN.

- **운영/보안 체크리스트**  
  - 감사 로그 및 접근 로그 보관(최소 90일), 워크스페이스별 rate limit, 백업/복구 정책(`docs/ops/backup.md`) 수립.  
  - OAuth 토큰 암호화 저장, 세션 탈취 방지(쿠키 Secure, SameSite), 워크스페이스 owner 변경 감사 기록 의무화.

### 문서 편집 & 협업
- `[ ]` Google Docs 수준의 동시 편집 지원: 실시간 커서/선택 힌트, 현재 편집자 아바타 스택, typing latency 최소화 전략 명세.
- `[ ]` 문서 잠금/체크아웃 옵션(유지보수, 대규모 편집 시)을 제공하고, 잠금 소유자와 만료 정책을 UI에 노출.
- `[ ]` 제안 모드(Track Changes): 삽입/삭제/스타일 변경이 제안으로 기록되고, 승인/거절 히스토리와 제안자 정보 표시.
- `[ ]` 주석/스레드/멘션 시스템: 특정 범위에 댓글, 답글, resolve, re-open, @mention 알림, 이모지 리액션.
- `[ ]` 버전 히스토리: 자동 스냅샷, 수동 이름 지정 버전, diff 뷰, 특정 시점으로 복원, 이전 버전 비교 export.
- `[ ]` 문서 상태 워크플로우(초안/검토 중/승인/게시)와 리뷰어 지정, 상태별 알림 정책 정의.
- `[ ]` Find & Replace + 문서 내 검색 하이라이트, 정규식 옵션, 태그/코멘트 검색 통합.
- `[ ]` 문서 템플릿/복제 기능: 템플릿 갤러리, 사용자 템플릿 공유, 기본 변수를 메타데이터로 연결.
- `[ ]` 문서 커버/설명/요약/키워드 메타 정보 필드와 공개 프리뷰 카드 구성.
- `[ ]` 멀티 포맷 Export (PDF, DOCX, Markdown, HTML) 및 Import(DOCX, Markdown, HTML 붙여넣기) 경로 정의.
- `[ ]` 첨부/임베드 확장: 이미지, 비디오, 다이어그램, 코드 스니펫, 외부 URL 카드; 업로드/권한 연동 명세.
- `[ ]` 문서별 알림 설정: 주석, 멘션, 상태 변경, 공유/권한 변경 시 이메일/푸시 선택.
- `[ ]` 감사 로그 & 활동 피드: 편집/공유/태그 변경 등 주요 이벤트 추적, 필터링/내보내기 UI.
- `[ ]` 오프라인 모드 및 충돌 해결: 로컬 캐시, 재연결 시 diff/merge 규칙, 충돌 시 사용자 선택 흐름.
- `[ ]` 단축키 팔레트, slash 명령 확장, 명령어 힌트 등 생산성 기능 정리.
- `[ ]` 문서 수준 접근 권한(Role: Viewer/Commenter/Editor/Owner)과 공유 링크 옵션(만료, 비밀번호, 뷰어 제한) 정의.

### 공유/권한/미디어
- `[ ]` 문서 접근 제어 모델: 개인 전용, 워크스페이스 공유, 특정 사용자 공유, 퍼블릭(링크/검색 허용).
- `[ ]` 퍼블릭 문서 공개 범위 설정과 SEO/robots 정책 정의.
- `[ ]` 이미지/파일 ACL 설계(전용 미디어 엔드포인트 or 서명 URL).

## Investigations & Follow-ups
- `[~]` 다국어/로컬라이제이션 인프라 설계 (문자열·이미지 리소스 번들 분리, 기본 en-US + ko-KR).
  - `[x]` 에디터 UI 문자열 리소스를 key 기반 사전으로 통합하고, 런타임 로케일 컨텍스트를 제공.
  - `[x]` Slash 힌트 문구, 팔레트 라벨, 컬러 피커 섹션 타이틀 등 신규 문자열 모두 리소스에서 로드.
  - `[ ]` 사용자 노출형 로케일 선택 UI 제공 및 지속 상태 저장 전략 확정.
  - `[ ]` 로케일별 이미지/아이콘 대응 필요 시 폴더 구조 정의(`assets/en/`, `assets/ko/` 등) 및 참조 헬퍼 추가.
- `[ ]` `mui-tiptap` 패키지 컴포넌트 export, 라이선스 확인 후 스펙에 반영하고 버전 고정.
- [x] Confirmed Tiptap DragHandle covers block dragging without a custom NodeView. (2025-11-05, AI)
- `[ ]` 저장 전략(LocalStorage 프로토타입 vs. API 연동) 결정 후 관련 작업 생성.
- `[ ]` 저장 전략 확정 후 Autosave 요구사항 정의.

## TODO 찾고 진행하는 방법
1. `docs/planning/development-plan.md`와 README 등 문서를 먼저 확인해 현재 해야 할 일을 파악한다.
2. `rg -n "TODO|FIXME"`로 코드 주석을 스캔해 남아 있는 작업 메모를 수집한다.
3. GitHub 이슈·커밋 로그·PR 코멘트를 훑어 follow-up 항목을 확인하고 문서와 교차 검증한다.
4. 개발 서버를 직접 실행해 주요 플로우를 점검하고 눈에 띄는 버그/미완성 UI를 보완 TODO로 기록한다.
5. 수집한 내용을 우선순위·기능별로 정리해 Markdown 체크리스트로 문서에 반영하고, 관련 참고 자료(이미지/링크)를 함께 연결한다.

## 최근 업데이트 (2025-11-05)
- 툴바를 한 줄+오버플로 팝오버 구조로 재정비하고 `requestAnimationFrame` 기반 스로틀로 입력 시 재렌더 비용을 축소, 테이블 전용 Popper 툴바 추가.
- 노션 스타일 레이아웃 정리: 제목을 대형 `InputBase`로 교체, 카드 테두리 제거, TOC·본문 여백 재조정.
- TOC가 Heading 변화와 선택 위치를 즉시 반영하며 클릭 시 해당 섹션으로 스크롤.
- 에디터 초기 콘텐츠는 최초 로딩 시에만 주입되도록 수정, 사용자 입력 덮어쓰기 방지.
- `CodeBlockLowlight` + highlight.js 언어 등록으로 문법 하이라이트 지원.
- 테이블 컨텍스트가 활성일 때 Popper 기반 Table 메뉴를 노출하고, 메인 툴바에서는 제거.
- Adopted @tiptap/extension-drag-handle to align drag handle placement and dispatch synthetic mousemove events when the caret moves.
- 모든 신규 기능은 `mui-tiptap` 및 TipTap 기본 확장에서 제공되는 구성을 최대한 재활용하고, 실제로 제공되지 않는 부분만 최소 범위로 커스터마이징한다는 원칙을 문서에 명시.

## 최근 업데이트 (2025-11-09)
- 데스크톱 TOC 토글을 툴바 왼쪽에 일원화하고 패널 폭(기본 250px)을 접힘/펼침에 따라 유연하게 조정해 편집 영역 폭을 극대화.
- 제목, 툴바, 본문 텍스트 좌표를 동일하게 맞추고 목차 패널 접힘 시에도 패딩이 남지 않도록 레이아웃 정렬.
- 툴바를 compact 모드에서도 정렬/목록/들여쓰기/첨자 그룹으로 묶어 오버플로 없이 노출하고, 모바일/데스크톱 공통 토글 UX를 정비.
- TOC 항목 간격·들여쓰기·패딩을 축소해 긴 문서에서도 스크롤 효율을 확보하고, 비어 있을 때 안내 문구만 노출되도록 구성.
- 목차/툴바/제목 관련 문자열과 상태를 i18n에 추가해 다국어 UI에서도 동일한 흐름을 유지.
