"""테스트 공통 설정.

여기 있는 테스트는 전부 AI를 호출하지 않는다. 순수 함수(시간 파싱, 충돌 검사,
과목 보완)만 검증하므로 네트워크도 API 키도 필요 없다.

다만 services.gemini를 import하는 것만으로 설정을 읽으므로, 실제 키가 없는
환경(CI 포함)에서도 import가 깨지지 않도록 더미 값을 넣어둔다.
Client는 첫 호출 시점에 만들어지므로 이 값으로 실제 요청이 나가는 일은 없다.
"""
import os

os.environ.setdefault("GEMINI_API_KEY", "test-dummy-key")
