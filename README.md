# My Book Feed

노션 독서 데이터베이스와 연결되는 독립형 책 피드 PWA입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

`.env.local`에는 다음 값이 필요합니다.

```text
NOTION_TOKEN=...
NOTION_DATABASE_ID=...
```

배포한 HTTPS 주소를 iPhone Safari에서 연 뒤 공유 메뉴의 **홈 화면에 추가**를 선택하면 앱처럼 사용할 수 있습니다.
