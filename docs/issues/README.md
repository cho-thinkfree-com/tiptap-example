# 이슈 인덱스

이 디렉터리는 버그, 회귀(regression), 운영 인시던트를 추적하기 위한 공간입니다. 각 이슈는 개별 Markdown 파일로 작성해 변경 내역을 명확히 남깁니다.

## 네이밍 규칙
- `YYYY-MM-DD-brief-summary.md` 형식을 사용합니다 (예: `2025-11-05-toc-desync.md`).

## 권장 섹션
- Summary
- Environment / Build
- Reproduction Steps
- Expected vs. Actual
- Attachments / Logs
- Fix Plan
- Resolution & Verification

## 프로세스
- 새 이슈 파일을 만들면 이 README에 표 형태로 등록하세요 (열: File, Status, Owner, Notes).
- 티어링(triage)과 해결 과정에서 이슈 파일을 지속적으로 갱신하세요.
- 해결 후에는 검증 단계와 관련 커밋/PR 링크를 기록하세요.
