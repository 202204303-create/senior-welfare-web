import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  Settings2,
  Smartphone,
  UserRoundCheck,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEMO_FAMILY_CODE, hasAssignedWorker } from '@/features/auth/lib/demoAccounts'
import { watchGuardianDeviceCount } from '@/shared/api/push'
import { FamilyCodeCard } from '@/features/care/components/CareWidgets'
import { PushPermission } from '@/features/care/components/PushPermission'
import { CHANNEL_LABEL, READY_CHANNELS } from '@/features/care/hooks/useCareWatcher'
import { useCareStore } from '@/features/care/store/useCareStore'
import { DEFAULT_PROFILE, useUserStore } from '@/features/auth/store/useUserStore'
import { speak } from '@/shared/lib/notify'
import { useSettingsStore } from '@/shared/store/useSettingsStore'
import { BigButton, InfoCard, PageHeader, TextField } from '@/shared/ui'

/**
 * 알림 화면: 누구에게(보호자 연결), 어떻게(휴대폰 알림·음성), 언제(기상 확인 시간) 알릴지 정하고
 * 보낸 알림과 보호자 확인 여부를 봅니다.
 */
export function AlertsPage() {
  const care = useCareStore()
  const profile = useUserStore((s) => s.profile)
  const voiceGuide = useSettingsStore((s) => s.voiceGuide)
  const setVoiceGuide = useSettingsStore((s) => s.setVoiceGuide)
  const guardianName = profile.guardianName.trim()
  // 시연용 가족이 아니면, 처음 들어 있던 예시 보호자를 '예시'라고 알려 줍니다.
  const sampleGuardian = care.familyCode !== DEMO_FAMILY_CODE && guardianName === DEFAULT_PROFILE.guardianName
  // 보호자가 링크로 연결해 알림을 켰는지 어르신도 알 수 있게 합니다.
  const [guardianDevices, setGuardianDevices] = useState<number | null>(null)
  useEffect(() => {
    if (!care.familyCode) return
    return watchGuardianDeviceCount(care.familyCode, setGuardianDevices)
  }, [care.familyCode])

  return (
    <div className="animate-fade-up">
      <PageHeader title="알림" desc="보호자 연결, 알림 시간, 내 휴대폰 알림을 정하고 보낸 알림을 확인해요." />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <InfoCard title="보호자" icon={<UserRoundCheck />} subtitle="보호자 정보 · 연결 링크">
            {guardianName ? (
              <Link
                to="/my"
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100 hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block text-lg font-bold">{guardianName}</span>
                  <span className="text-base text-ink-soft">{profile.guardianPhone || '연락처 없음'}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-bold whitespace-nowrap text-brand-700">
                  {sampleGuardian ? '예시 · 고치기' : '고치기'}
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              </Link>
            ) : (
              <Link
                to="/my"
                className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4 text-base font-bold text-amber-900 ring-1 ring-amber-200"
              >
                보호자 이름·연락처를 아직 안 넣었어요
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-brand-700">
                  넣기 <ChevronRight className="size-4" aria-hidden />
                </span>
              </Link>
            )}
            <GuardianDevices count={guardianDevices} />
            <p className="mt-2 text-sm text-ink-soft">
              {hasAssignedWorker(care.familyCode)
                ? '담당 복지사도 복지사 화면에서 함께 지켜봐요.'
                : '담당 복지사가 정해지면 복지사 화면에서도 함께 지켜봐요.'}
            </p>
            <FamilyCodeCard />
          </InfoCard>

          <InfoCard title="보호자에게 알리는 때" icon={<Settings2 />} subtitle="기상 확인 시간">
            <TextField
              label="기상 확인 마감 시간"
              type="time"
              value={care.wakeUpDeadline}
              onChange={(e) => care.setWakeUpDeadline(e.target.value)}
              hint="이 시간까지 '일어났어요'를 누르지 않으면 보호자께 알림이 가요."
            />
            <p className="mt-4 rounded-2xl bg-white/80 p-4 text-base ring-1 ring-brand-100">
              긴급 요청, 기상·약 미확인은 연결된 보호자 휴대폰으로 알려 드려요.
            </p>
          </InfoCard>

          <InfoCard title="내 휴대폰 알림" icon={<Smartphone />} subtitle="약 드실 시간 안내">
            <p className="mb-3 text-base text-ink-soft">약 드실 시간에 이 휴대폰으로 알려 드려요.</p>
            <PushPermission
              label="내 휴대폰으로 약 시간 안내 받기"
              role="elder"
              familyCode={care.familyCode}
              onGranted={() => {
                if (!care.channels.includes('webpush')) care.toggleChannel('webpush')
              }}
            />
            <button
              onClick={() => {
                const next = !voiceGuide
                setVoiceGuide(next)
                if (next) speak('약 드실 시간이 되면 이렇게 소리로 알려 드릴게요.')
              }}
              aria-pressed={voiceGuide}
              className={`mt-3 flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-base font-bold ring-2 transition ${
                voiceGuide
                  ? 'bg-brand-50 text-brand-800 ring-brand-300'
                  : 'bg-white/80 text-ink-soft ring-brand-100'
              }`}
            >
              <span className="flex items-center gap-2">
                {voiceGuide ? (
                  <Volume2 className="size-6" aria-hidden />
                ) : (
                  <VolumeX className="size-6" aria-hidden />
                )}
                약·기상 시간 음성 안내
              </span>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm">
                {voiceGuide ? '켜짐' : '꺼짐'}
              </span>
            </button>
          </InfoCard>
        </div>

        <div className="space-y-5">
          <InfoCard
            title="보낸 알림"
            icon={<BellRing />}
            action={
              care.alerts.length > 0 && (
                <BigButton size="md" variant="ghost" onClick={care.clearAlerts}>
                  지우기
                </BigButton>
              )
            }
          >
            {care.alerts.length === 0 ? (
              <p className="rounded-2xl bg-white/70 p-4 text-center text-base text-ink-soft">
                아직 보낸 알림이 없어요.
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {care.alerts.map((a) => (
                  <li
                    key={a.id}
                    className={`rounded-2xl p-4 ring-1 ${a.kind === 'sos' ? 'bg-rose-50/90 ring-rose-200' : 'bg-amber-50/90 ring-amber-100'}`}
                  >
                    <p className="text-base font-semibold">{a.reason}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {new Date(a.at).toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' · '}
                      {a.channels
                        .filter((c) => READY_CHANNELS.includes(c))
                        .map((c) => CHANNEL_LABEL[c])
                        .join(', ') || '보호자 화면'}{' '}
                      → {a.recipients.join(', ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </InfoCard>
        </div>
      </div>
    </div>
  )
}

/** 알림을 켠 보호자 휴대폰 수. 못 읽었으면(null) 아무것도 보이지 않습니다. */
function GuardianDevices({ count }: { count: number | null }) {
  if (count === null) return null
  return count > 0 ? (
    <p className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 p-3 text-base font-bold text-emerald-800 ring-1 ring-emerald-200">
      <CheckCircle2 className="size-5 shrink-0" aria-hidden />
      보호자 휴대폰 {count}대에 알림이 켜져 있어요
    </p>
  ) : (
    <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-base font-bold text-amber-900 ring-1 ring-amber-200">
      아직 알림을 켠 보호자 휴대폰이 없어요. 아래 버튼으로 보호자께 링크를 보내 주세요.
    </p>
  )
}
