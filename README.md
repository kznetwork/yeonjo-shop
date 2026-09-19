# YEONJO Shop

천연석·실버 주얼리 쇼핑몰과 Supabase 기반 회원, 주문, 배송 관리자 페이지입니다.

## 구성

- `dist/`: Cloudflare Pages 정적 배포 파일
- `dist/admin.html`: 관리자 화면 (`/admin` 주소도 지원)
- `supabase/schema.sql`: 데이터베이스 테이블, 트리거, RLS 정책

## 배포

Cloudflare Pages에서 빌드 명령 없이 출력 디렉터리를 `dist`로 지정합니다.

관리자 계정은 `kz4network@gmail.com`으로 회원가입하면 최고 관리자 권한이 자동 부여됩니다.
