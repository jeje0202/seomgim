# ERR_QUIC_PROTOCOL_ERROR 해결 방법

## 문제 설명
`ERR_QUIC_PROTOCOL_ERROR`는 HTTP/3 (QUIC) 프로토콜 관련 오류입니다. 주로 다음과 같은 경우에 발생합니다:

1. **Nginx 설정 문제**: HTTP/3이 활성화되어 있지만 제대로 작동하지 않는 경우
2. **브라우저 설정**: 브라우저가 HTTP/3을 시도하다가 실패하는 경우
3. **네트워크 문제**: 불안정한 네트워크 연결

## 해결 방법

### 방법 1: Nginx 설정 확인 및 수정 (권장)

Nginx 설정 파일에서 HTTP/3을 비활성화하거나 올바르게 설정:

```nginx
# HTTP/3 비활성화 (HTTP/2 또는 HTTP/1.1 사용)
# listen 443 ssl http2;  # HTTP/2 사용

# 또는 HTTP/3이 제대로 설정되어 있는지 확인
# listen 443 ssl http2 http3;
# listen [::]:443 ssl http2 http3;
```

### 방법 2: 브라우저에서 HTTP/3 비활성화

Chrome/Edge:
1. 주소창에 `chrome://flags` 입력
2. "Experimental QUIC protocol" 검색
3. "Disabled"로 설정
4. 브라우저 재시작

### 방법 3: 코드에서 재시도 로직 추가

`services/apiClient.ts` 파일에 재시도 로직이 추가되었습니다. 
네트워크 오류 발생 시 자동으로 재시도합니다.

### 방법 4: 서버 헤더 확인

서버 응답 헤더에 `Alt-Svc` 헤더가 있는지 확인하고, 
문제가 있으면 제거하거나 수정하세요.

## 현재 상태

- `services/apiClient.ts` 파일에 재시도 로직 추가됨
- QUIC 프로토콜 오류 발생 시 자동 재시도
- 네트워크 오류 처리 개선

## 참고사항

이 오류는 일반적으로 일시적인 네트워크 문제로 발생하며,
재시도 로직으로 대부분 해결됩니다. 
지속적으로 발생하는 경우 Nginx 설정을 확인하세요.

