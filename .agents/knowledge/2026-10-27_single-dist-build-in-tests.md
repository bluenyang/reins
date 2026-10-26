---
id: 2026-10-27_single-dist-build-in-tests
kind: decision
status: active
supersedes: null
topics: []
decisions: [single-dist-build-in-tests]
symptoms: []
applies_to: all
source: ".loctx/history/2026-10-26-2030_011-5-flaky-control.md"
approved: { by: user, at: 2026-10-27 }
---
## 결정
빌드 산출물(`cli/dist`)은 vitest globalSetup에서 한 번만 만든다. 테스트 파일 안에서 다시 빌드하지 않는다.
## 이유
테스트 파일은 병렬로 돈다. 한 파일이 tsc로 dist를 다시 쓰는 동안 다른 파일이 CLI를 띄우면 반쯤 쓰인 모듈을 읽고 아무것도 출력하지 못한다. publish에서 control 테스트가 빈 stdout으로 실패했고, 재빌드를 반복하며 22회 중 1회 재현했다(011-5).
## 적용
테스트가 공유 산출물(dist·생성 파일)을 고쳐야 하면 임시 사본에서 한다. `test/suite.test.ts`가 테스트 파일의 컴파일러 호출을 막는다.
## 바뀌면
테스트가 직렬 실행으로 바뀌거나 빌드가 원자적 교체(임시 디렉터리 후 rename)로 바뀌면 다시 본다.
