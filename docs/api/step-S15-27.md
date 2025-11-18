# Step S15~S27 : 고급 생산성 & AI

Step S15부터 S27까지는 검색/Export, 협업·Realtime, AI 도구를 차례로 도입하는 구간입니다. 아래는 각 Step이 책임지는 핵심 API 범위와 일반적인 테스트 체크리스트이며, Fastify 라우터/서비스 구현 전에 문서로 흐름을 기록합니다.

| Step | 주요 API | 설명 | 테스트 체크포인트 |
| --- | --- | --- | --- |
| `S15` | `/api/search` (POST), `/api/workspaces/{id}/activity-feed` | 검색/필터 인프라, 워크스페이스 피드 | 검색 조건별 문서 반환, 권한/속도 제한, empty-case |
| `S16` | `/api/export` (POST) | Markdown/PDF/HTML export job kick-off | Export job 생성, 상태 조회, 실패/queue 대비 |
| `S17` | `/api/export/{jobId}` | Export 결과 스트리밍 + queue 확인 | Signed URL 발급, cancel, retry |
| `S18` | `/api/workspaces/{id}/collaboration` | Collaboration presence/presence channel | presence broadcast, history |
| `S19` | `/api/workspaces/{id}/mentions` | Mention autocomplete/query service | query builder, role filtering |
| `S20` | `/api/workspaces/{id}/activity` | Activity/Change feed, comment threads | pagination, filtering, security |
| `S21` | `/api/embeds` + `/api/media/upload` | Media/Embed upload + ACL | Signed upload URL, ACL enforcement |
| `S22` | `/api/presence` (WebSocket), `/api/realtime` | Realtime cursor/presence | connection lifecycle, reconnect |
| `S23` | `/api/offline/cache` | Offline sync/diff/merge | IndexedDB seed, conflict resolution |
| `S24` | `/api/workflows/{id}` | Document workflow (draft/review/publish) | status transitions, reviewer notifications |
| `S25` | `/api/documents/{id}/track-changes` | Track Changes accept/reject | inline diff, change set stores |
| `S26` | `/api/share-links/{id}/acl` | Advanced share policy (Viewer/Commenter/Editor) | policy matrix updates, domain whitelists |
| `S27` | `/api/ai` | Slash/AI palette, audit trail logging | rate limiting, streaming responses |

이 문서를 참조하여 각 Step별 Fastify 라우트와 서비스, 클라이언트 테스트를 순차적으로 완성해야 합니다. 각 Step을 시작할 때 `tests/checklists/S{n}.md`에 QA/테스트 요구사항(예: 성공 시나리오, 권한 실패, edge case)을 기록하고, 완료 시 해당 체크리스트를 따라 Vitest/Playwright를 실행합니다. 필요한 경우 OpenAPI 스펙(`docs/api/openapi/step-S{n}.yaml`)도 생성하여 문서와 코드가 동기화되도록 합니다.
