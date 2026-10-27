---
intent: "013"
status: done
approvals:
  - { role: qa-design, at: 2026-10-27, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
branch: feat/013-enforcement-and-platforms
tickets: ["013-1", "013-2", "013-3", "013-4", "013-5", "013-6", "013-7"]
---
## 바뀌는 파일
- 013-1: `package.json`(engines `>=22`, commander `^14`), lockfile, `.gitattributes`(새), `.github/workflows/ci.yml`(matrix), Windows·macOS에서 드러난 실패 수정(테스트·`split('\n')` 파서·임시 폴더 삭제 재시도·realpath), README·CONTRIBUTING·AGENTS.md 양판의 Node 문구, `docs/design*.md` §9, 테스트(engines·matrix)
- 013-2: `harness/policy/enforcement.yaml`(새)와 스키마, 표 렌더러, README 양판·설계서 양판 §2·§3 마커 구간, 로드맵 양판 0.2 링크, 설치본(`reins update`), 테스트
- 013-3: bindings 두 층(`cli/src/lib/detect.ts`·`configure.ts`·install의 buildBindings·resolver·`generate.ts`), `status`, `configure bindings --local|--show`, 스키마 `bindings-local@1`, reins-loop 스킬과 `references/vendor-cli.md`, `docs/design*.md` §5·§6·§9, 테스트
- 013-4: `install.yaml` `release.docs`(스키마), T5 docs 경고(`stages.ts`), 이 저장소 install.yaml 값, deploy 역할·reins-release 스킬, `docs/design*.md` §4·§9, 테스트
- 013-5: T5 `--stable`(`stages.ts`, `cli/src/reins.ts`), deploy 역할, `docs/design*.md` §4·§9, 테스트
- 모든 ticket: 설계서 양판은 코드와 같은 커밋, CHANGELOG `[Unreleased] — 0.1.5`에 한 줄
## 작업 순서
1. Node ≥22·commander 14·`.gitattributes`·CI matrix와 그 실패 수정 (S-10, S-11, S-12 일부) → ticket 013-1
2. enforcement.yaml과 README·설계서·로드맵 표 (S-1~S-3, S-12 일부) → ticket 013-2
3. bindings 두 층과 resolver, fallback agent 생성 (S-4~S-6, S-12 일부) → ticket 013-3
4. `release.docs`와 T5 docs 경고, 릴리스 PR의 문서 갱신 단계 (S-7, S-8, S-12 일부) → ticket 013-4
5. T5 `--stable` (S-9, S-12 일부) → ticket 013-5
## 위험
- Windows CI 실패가 많을 수 있다 → 013-1에서 PR을 먼저 올려 matrix 결과를 보고, 양이 많으면 영역별 ticket으로 나눈다(이탈 기록).
- commander 15→14에서 API 차이 → 테스트 전부 통과로 확인, 바뀐 호출은 013-1 안에서 고친다.
- 013-3과 013-4·013-5가 `stages.ts`·`install.ts`·`generate.ts`를 함께 고친다 → 순서대로 진행(병렬 금지).
- enforcement.yaml이 역할 `must_not` 순서에 묶인다 → 커버리지 테스트가 순서 변경·추가를 바로 잡는다.
- 개인 덮어쓰기가 생성물에 섞이면 다른 사람에게 drift → C-7(local 유무와 무관하게 생성 결과 동일)로 막는다.
## 증명
- vitest: spec C-1~C-14, 기존 테스트 전부 통과. PR CI의 3 OS × Node 22·24 모든 칸 녹색(run 링크).
- `reins check --drift` ok, 0.1.4 설치 fixture에서 update 뒤 설정 유지(C-13).
- npm rc 스모크(빈 저장소, 0.1.4 설치본 update, `status`의 resolved bindings, T5 docs 경고·`--stable`).
## 테스트 체크리스트
- [ ] spec C-1~C-14
- [ ] PR CI matrix 녹색
- [ ] npm rc 스모크
## 이탈 기록
- 2026-10-27 (pl, rc.1 스모크·사용자 지시 "rc.2로 넣고"): 0.1.4 설치본은 update 뒤에도 bindings.yaml에 `detected`가 남음 → 013-7 update가 감지 결과를 `.loctx/bindings.local.yaml`로 옮기고 커밋 파일에서 지움. release: stabilization.
- 2026-10-27 (pl, 013-1 PR CI matrix): Windows 2칸에서 테스트 파일 6개 실패(경로 `new URL().pathname` → `/D:/…`, 템플릿·출력 비교 등), macOS Node 22에서 e2e 2개가 5초 제한 초과 → 위험 항목대로 ticket 013-6 "Windows·macOS CI 실패 수정"으로 분리.
