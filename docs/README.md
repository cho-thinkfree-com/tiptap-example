# 문서 인덱스

이 디렉터리는 Tiptap + React 에디터 프로젝트의 계획, 스펙, 할일 추적, 이슈 로그를 정리하는 허브입니다. 문서는 간결하게 유지하고 서로 교차 링크해 관리 부담을 줄이세요.

## 구조
- `specs/` - 기능 및 아키텍처 스펙. 시작 문서는 `specs/doc-editor.md`.
- `planning/` - 마일스톤 계획, 작업 분해, 진행 상태. 현재 활성 문서는 `planning/development-plan.md`.
- `tasks/` - 세부 TODO 파일(작업 스트림별 1파일). 네이밍 규칙은 `tasks/README.md` 참고.
- `issues/` - 버그 또는 인시던트 보고서. 접수 가이드는 `issues/README.md` 확인.

## 사용 가이드라인
- 파일을 추가하거나 보관 처리할 때 관련 인덱스(`specs/README.md`, `planning/README.md` 등)를 바로 갱신하세요.
- 작업을 마치면 커밋/PR 설명에 관련 문서 경로를 명시하세요.
- Markdown 제목 레벨을 건너뛰지 않아야 자동 TOC 생성 시 혼란을 줄일 수 있습니다.
- 문서가 400~500 단어를 넘기면 주제별 하위 문서로 분리하고 이곳에 링크를 추가하는 것을 고려하세요.

## 빠른 링크
- 스펙: `specs/doc-editor.md`
- 개발 계획: `planning/development-plan.md`
- 작업 인덱스: `tasks/README.md`
- 이슈 인덱스: `issues/README.md`
