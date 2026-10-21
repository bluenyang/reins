# loop-harness

어떤 레포에도 붙일 수 있는 벤더 중립 에이전트 루프입니다. 역할, 루프 상한, 핸드오프 리포트,
학습하는 실패 카탈로그, 결정론적 게이트를 명령 한 번으로 설치하고, 내 파일을 건드리지 않고
업데이트합니다.

```
analyze → design → work → verify → review → qa → write → release
                    ▲      fail     changes   fail → triage
                    └─────────────────────────────┘   상한 초과 → escalate → 사람
```

- **어떤 에이전트든 어떤 역할이든**: 역할은 `.harness/core/`의 마크다운입니다. Claude Code,
  Codex, Antigravity, Cursor 누구나 맡을 수 있고, 누가 맡을지는 `bindings`가 정합니다.
- **독립 검증**: 개발 역할은 최종 통과를 내지 않습니다. 검증은 도구 출력만 읽고, 리뷰와 QA는
  다른 모델이 하며, QA는 소스 코드를 읽지 않습니다.
- **줄어드는 정지**: 지식 정지는 결정 요청서를 쓰고, 답은 실패 카탈로그에 들어갑니다. 두 번
  검증된 해결은 규칙이나 훅으로 승격을 제안합니다. 의도 정지(설계 불변식, 정식 릴리스,
  되돌리기 어려운 작업)는 항상 사람의 몫입니다.

## 설치

Python 3.11 이상, 의존성 없음.

```bash
python3 harness.py migrate ../my-project --dry-run   # 변경 목록 + 기존 하네스 리포트
python3 harness.py migrate ../my-project             # 기존 하네스가 있는 레포
python3 harness.py install ../my-project             # 새 레포
python3 harness.py update  ../my-project             # 템플릿 새 버전 반영
```

| 경로 | 커밋 | 소유 |
|---|---|---|
| `.harness/core/`, `.harness/harness.py` | O | 템플릿 — 업데이트 시 교체 |
| `.harness/project.toml` | O | 사용자 — 스택 감지로 한 번 생성 |
| `AGENTS.md`의 `harness:core` 블록 | O | 템플릿 — 블록 밖은 사용자 것 |
| `.claude/skills/*`, `.claude/agents/loop-*`, `.cursor/commands/*` | O | 생성물 — `harness.py render` |
| `.ai/loop`, `handoff`, `decisions`, `knowledge`, `qa` | X (gitignore) | 루프 |

기존 스킬, 커맨드, 훅, `.ai/` 파일은 그대로 둡니다. 이름이 겹치면 덮어쓰지 않고 리포트합니다.

## 사용

```bash
python3 .harness/harness.py gate all --summary     # 게이트, 실패 꼬리, 카탈로그 매칭
python3 .harness/harness.py state set --target 1.2.0-rc.1 --stage work
python3 .harness/harness.py next                   # 다음 단계, 역할 파일, 바인딩
python3 .harness/harness.py dispatch qa            # 바인딩된 CLI로 단계 실행
python3 .harness/harness.py advance .ai/handoff/<리포트>.md
python3 .harness/harness.py doctor
```

Claude Code에서는 `/loop <target>`, `/step <stage>`, `/decide`, `/learn`, `/verify`.

## 상태

v0.1 — 설치기, 게이트, 상태 전이, 렌더링은 테스트했습니다. Claude Code 외 CLI의 `dispatch`
명령줄은 아직 실제로 검증하지 않았습니다.
