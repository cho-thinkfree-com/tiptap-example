# ododocs 배포 가이드

이 문서는 Vultr VPS에 `ododocs` 서비스를 배포하는 절차를 안내합니다.

## 1. Cloudflare API Token 준비
이 구성은 Let's Encrypt **DNS Challenge**를 사용하여 인증서를 발급받습니다. 이를 위해 Cloudflare API Token이 필수입니다.

1.  [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) 접속.
2.  **Create Token** -> **Edit Zone DNS** 템플릿 선택.
3.  **Zone Resources**: `Include` -> `Specific zone` -> `ododocs.com` 선택.
4.  토큰 생성 후 복사해 둡니다.

## 2. 서버 초기 설정

서버에 SSH로 접속한 후 프로젝트 루트에서 다음 명령어를 실행합니다.

```bash
# 1. 실행 권한 부여
chmod +x manage.sh

# 2. 초기화 (디렉터리 생성 및 .env 파일 준비)
./manage.sh init
```

## 3. 환경 변수 설정 (.env)

`./manage.sh init` 명령이 `.env` 파일을 생성했을 것입니다. 내용을 수정하여 실제 값을 입력하세요.

```ini
# .env 파일 편집
vi .env

# [필수 수정 항목]
# CLOUDFLARE_EMAIL=내이메일@example.com
# CLOUDFLARE_API_TOKEN=아까_복사한_토큰
# POSTGRES_PASSWORD=...
# ...
```

## 4. 인증서 발급

최초 한 번만 수동으로 인증서를 발급받으면, 이후에는 자동으로 갱신됩니다.

```bash
./manage.sh cert-issue
```
> **성공 확인**: "Certificate issued successfully" 메시지가 나오면 성공입니다.

## 5. 서비스 배포

모든 서비스를 빌드하고 실행합니다.

```bash
./manage.sh deploy
```

## 6. 관리 및 모니터링

-   **로그 확인**: `./manage.sh logs`
-   **Nginx 설정 리로드**: `./manage.sh reload-nginx`
-   **서비스 중단**: `./manage.sh down`

## 도메인 연결 정보
-   **서비스 (FE)**: `https://service.ododocs.com` (Frontend)
-   **API (BE)**: `https://api.ododocs.com` (Backend)
-   **동시편집 (Hopo)**: `https://collab.ododocs.com` (WebSocket)
-   **WWW**: `https://www.ododocs.com` (현재 502 Bad Gateway - 컨테이너 없음)

---
**주의사항**:
-   `compose.prod.yaml`은 `docker.sock`을 `certbot` 컨테이너와 공유합니다. 이는 Nginx 컨테이너를 재시작 없이 리로드하기 위함입니다.
-   데이터는 `$HOME/volumes/ododocs` 에 저장됩니다. 서버를 재부팅해도 데이터는 유지됩니다.
