/**
 * GET /api/check  (GitHub Actions 가 10분마다 부름, Authorization: Bearer CRON_SECRET)
 *
 * 어르신·보호자 앱이 모두 닫혀 있어도:
 * - 기상 마감이 지났는데 확인이 없거나 약을 놓쳤으면 → 알림 기록을 만들고 보호자 기기로 알림
 * - 약 드실 시간이면 → 어르신 기기로 알림
 * 휴대폰 알림을 켠 기기가 있는 가족만 확인합니다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: '권한 없음' }, { status: 401 })
  }
  try {
    // 서버 모듈은 여기서 불러옵니다. 불러오다 실패해도 함수 전체가 죽지 않고 원인을 돌려줄 수 있게 합니다.
    const [{ firebaseAdmin }, { runCheck }] = await Promise.all([
      import('./_lib/admin.js'),
      import('./_lib/checkJob.js'),
    ])
    const { db, messaging } = firebaseAdmin()
    return Response.json(await runCheck(db, messaging, new Date()))
  } catch (e) {
    // 원인을 GitHub 점검 기록에서 바로 볼 수 있도록 오류 내용을 돌려줍니다. (비밀값은 담기지 않음)
    const err = e as Error
    console.log(JSON.stringify({ check: 'failed', error: String(err?.message ?? e), stack: err?.stack }))
    return Response.json(
      {
        error: '점검 실패',
        message: String(err?.message ?? e).slice(0, 300),
        where: err?.stack?.split('\n').slice(1, 4),
      },
      { status: 500 },
    )
  }
}
