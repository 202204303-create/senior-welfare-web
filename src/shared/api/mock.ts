const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Mock 전용: 네트워크 지연과 간헐적 실패를 흉내내어 로딩·에러 화면을 검증할 수 있게 합니다. */
export async function simulateNetwork(failRate = 0) {
  await delay(400 + Math.random() * 500)
  if (Math.random() < failRate) {
    throw new Error('서버와 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.')
  }
}
