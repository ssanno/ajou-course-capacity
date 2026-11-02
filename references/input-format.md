# 입력 형식

## 우선 경로

웹서비스 상단 불러오기 → 현재 계획 파일 저장으로 내려받은 JSON을 그대로 사용한다. 이 파일은 교육과정, 인원, 학년도·학기, 개설 과목 및 분반 수를 담는다. 예측 기록 JSON은 별도 형식이다.

## 핵심 필드

| 필드 | 의미 |
| --- | --- |
| `workflowVersion` | 2 |
| `name`, `id` | 학과/계획 이름, 영문·숫자·하이픈 식별자 |
| `planningYear`, `planningSemester` | 산출 대상 학년도, 학기(1/2) |
| `targetYear`, `baseYear` | planningYear와 같은 값, 그 전년도 |
| `curriculumYear` | 적용 교육과정 연도 |
| `studentCounts` | 1~4학년 인원, 순서 유지. 미상은 null, 실제 없음만 0 |
| `studentCountBasis` | enrolled(재학생) 또는 registrants(수강신청 예정·확정 인원) |
| `curriculum` | 코드·과목명·권장학년·학기·학수구분·학점·이수비중 |
| `overrides` | `교육과정연도:과목코드:학기`를 키로 사용해 enabled와 sections 지정 |

전체 예시는 `examples/example-plan.json`, 전체 검증 규칙은 `lib/model.ts`의 `planSchema`를 따른다. 기본 보조 필드는 예제 또는 `emptyPlan()`으로 구성한다.

## 교육과정

- `category`: 전필, 전선, 전공기초, 교양필수 중 하나.
- `grade`: 권장학년. 같은 학기에 여러 학년을 임의로 합쳐 한 과목으로 만들지 않는다.
- `share`: 해당 학기의 이수 비중. 한 학기에만 이수하는 과목은 1.
- 양학기 과목은 같은 코드에 학기별 항목을 만들고 합계가 1을 넘지 않게 한다.
- 학교 조회 메타데이터가 있으면 원본을 보존한다. 없는 메타데이터나 원본 코드 연결 관계를 만들어내지 않는다.

## 결과

`prediction.json`은 모델 버전, 입력 스냅숏, 결과와 산출 근거를 보관한다. CLI 기록은 `storage: local-file`이며 배포본의 웹 화면에서 기록 파일로 열 수 있다. 기존 호스팅 웹의 계획 JSON과 입력은 호환된다. `capacity.csv`는 같은 권장정원을 입력된 분반 수에 배분한 결과이다.
