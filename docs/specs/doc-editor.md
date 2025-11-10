# 문서 편집기 스펙

## 범위와 목표
- React 기반 단일 페이지(Document Single Page) 편집기를 구축하고, Tiptap 리치 텍스트 엔진과 Material UI 프레젠테이션을 결합한다.
- `tiptap-mui` 컴포넌트 라이브러리가 제공하는 기본 툴바를 그대로 사용하되, 기본으로 노출되는 최대한 많은 포맷팅 기능을 활성화한다.
- 제목 입력, 중앙 에디터 영역, 좌측 블록 핸들러, 우측 실시간 Table of Contents(TOC)로 구성된 레이아웃을 제공한다.

## 기술 스택 및 의존성
- 런타임: React 18 + TypeScript, 번들러는 Vite (저장소 계획과 동일).
- 코어 에디터: `@tiptap/react`, `@tiptap/core`, `@tiptap/starter-kit`.
- UI: `@mui/material`, `@mui/icons-material`, MUI 테마 유틸리티.
- 툴바: `tiptap-mui` 패키지 (실제 패키지명/버전 확인 필요). 예상 주요 컴포넌트는 `RichTextEditorProvider`, `MenuControlsContainer`, `MenuBar`, `RichTextField`.
- 추가 Tiptap 확장: `Placeholder`, `CharacterCount`, `Underline`, `TextAlign`, `Highlight`, `Link`, `Image`, `Table`, `TableRow`, `TableHeader`, `TableCell`, `HorizontalRule`, `CodeBlockLowlight`, `Blockquote`, `Heading`, `TaskList`, `TaskItem`, `History`, `DragHandle`(또는 블록 재정렬을 지원하는 대체 확장).
- 선택 라이브러리: TOC 갱신 지연을 위한 `lodash.debounce`, 스크롤 동기화를 위한 `scroll-into-view`, 테스트용 `@testing-library/react`, `@testing-library/user-event`, `vitest`.

## 기본 레이아웃
```
<App>
  <RichTextEditorProvider>
    <MenuControlsContainer> // 고정 툴바 스트립
    <EditorShell>
      <LeftGutter /> // 드래그 핸들 및 블록 선택
      <MainPane>
        <TitleField />
        <RichTextField />
      </MainPane>
      <TocPane />
    </EditorShell>
  </RichTextEditorProvider>
</App>
```
- 툴바는 상단에 고정(sticky)된다.
- 콘텐츠 영역은 반응형 분할 레이아웃을 사용하며, 너비 960px 이하에서는 TOC를 접거나 Drawer 형태로 전환한다.
- 좌측 거터는 에디터 콘텐츠와 정렬을 유지해 블록 핸들을 제공한다.

## 툴바 연동
- 에디터를 `RichTextEditorProvider`로 감싸 전역 에디터 상태를 관리한다.
- `MenuControlsContainer` 안에 `tiptap-mui`가 제공하는 `Toolbar`, `BubbleMenu` 프리셋을 렌더링하고, 텍스트 스타일, 리스트, 테이블, 코드, 미디어, Undo/Redo, 링크, 정렬, 하이라이트 그룹을 활성화한다.
- 아이콘 로딩은 `@mui/icons-material` 설정으로 제공한다.
- 플레이스홀더 등 확장 옵션은 Provider props를 통해 노출한다.

## 제목 필드 요구사항
- 툴바 바로 아래에 MUI `TextField`를 배치하고, React state로 제어한다.
- 검증: 비어 있지 않은지 여부는 소비자에게 맡기되, 기본 `maxLength` 120자를 옵션으로 제공한다.
- 키보드 단축키: `Ctrl/Cmd+Enter`로 본문 포커스, `Ctrl/Cmd+Shift+T`로 제목 포커스 복귀(후속 구현 항목).
- 제목 값은 에디터 JSON과 함께 상위 컴포넌트 상태에 저장하여 직렬화 가능하도록 한다.

## 에디터 설정
- Tiptap `StarterKit`과 상단의 확장을 조합해 초기화한다.
- 백엔드 동기화가 지연되더라도 히스토리, TaskList, Table 등 협업 준비 구성을 활성화한다.
- 가독성을 위해 본문 너비는 최대 720px로 제한한다.
- 플레이스홀더 텍스트는 “Start writing your document…” 로 제공한다.
- 본문 렌더링은 `tiptap-mui`의 `RichTextField`를 사용해 MUI 스타일을 적용한다.

## 좌측 블록 핸들러
- 선택 상태를 구독하는 `LeftGutter` 컴포넌트를 에디터 본문 좌측에 배치한다.
- 문서의 최상위 블록(paragraph, heading, list, table 등)마다 드래그 가능한 핸들을 렌더링한다.
- 핸들을 클릭하면 `editor.commands.setNodeSelection`으로 해당 블록 전체 선택을 수행한다.
- 핸들을 드래그하면 `editor.commands.moveNode()`를 사용해 형제 블록 사이로 재배치한다. 가능하다면 Tiptap `DragHandle` 확장을 활용하고, 부족할 경우 `@tiptap/core` NodeView API를 이용해 커스텀 확장을 구현한다.
- 키보드 접근성: 핸들은 focus 가능해야 하며, 방향키로 블록 이동 또는 선택이 가능하도록 한다.

## Table of Contents(TOC)
- `editor.state.doc`에서 `h1`~`h6` 헤딩을 추출한다.
- `editor.on('create')`, `editor.on('transaction')`, `editor.on('update')` 이벤트를 구독해 TOC를 재계산하고, 디바운스로 과도한 갱신을 방지한다.
- 헤딩 레벨에 따라 중첩 리스트로 TOC를 보여주고, 항목을 클릭하면 `editor.commands.scrollIntoView()` 또는 DOM 측정을 활용해 해당 위치로 스크롤한다.
- 스크롤 위치를 감지해 현재 섹션을 하이라이트한다.
- 작은 화면에서는 TOC를 Drawer 형태로 접고, 툴바 근처에 토글 버튼을 제공한다.

## 상태, 저장, 데이터 플로우
- 에디터 콘텐츠는 `editor.getJSON()` 결과를 상위 state에 저장하고, 향후 백엔드 연동을 위해 `onChange` 콜백을 노출한다.
- 제목과 본문은 공용 React context 또는 상위 state 슬라이스를 공유해 자동 저장(Autosave)에 대비한다.
- 추후 내보내기 기능을 위해 `src/lib/serialization` 모듈에서 Markdown/HTML 직렬화 헬퍼를 제공한다.

## 접근성 및 UX
- 툴바 버튼에 `aria-label`을 지정해 스크린리더가 제대로 안내하도록 한다.
- 핸들 및 TOC 항목에는 명확한 포커스 스타일을 유지한다.
- 제목, 툴바, 에디터, TOC, 블록 핸들 사이를 키보드로 이동할 수 있어야 한다.
- MUI 기본 테마 대비 대비비(contrast)를 확인하고 필요 시 팔레트를 조정한다.

## 미해결 사항 및 후속 작업
- `tiptap-mui` 패키지 API와 컴포넌트 명칭을 정확히 확인하고, 검증 결과와 예제를 계획 문서에 반영한다.
- 저장 전략(LocalStorage vs. API)과 Autosave 주기를 결정한다.
- 1차 릴리스 범위에서 실시간 협업을 지원할지 여부를 결정한다.
- `DragHandle` 확장만으로 충분하지 않다면 추가 Drag & Drop 라이브러리 필요성을 검토한다.

## 참고 문서
- 기여 규칙: `AGENTS.md`
- 필독 목록: `ALWAYS_READ.md`
- 개발 계획: `docs/planning/development-plan.md`
