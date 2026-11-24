import {
  BellRing,
  MessageCircle,
  Settings2,
  Smartphone,
  UserRoundCheck,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { AlertAckLine, FamilyCodeCard } from '@/features/care/components/CareWidgets'
import { PushPermission } from '@/features/care/components/PushPermission'
import { CHANNEL_LABEL, READY_CHANNELS } from '@/features/care/hooks/useCareWatcher'
import { useCareStore, type AlertChannel } from '@/features/care/store/useCareStore'
import { useUserStore } from '@/features/auth/store/useUserStore'
import { speak } from '@/shared/lib/notify'
import { useSettingsStore } from '@/shared/store/useSettingsStore'
import { BigButton, InfoCard, PageHeader, TextField } from '@/shared/ui'

const CHANNEL_ICON: Record<AlertChannel, typeof BellRing> = {
  webpush: BellRing,
  kakao: MessageCircle,
  sms: Smartphone,
}

/**
 * 알림 화면: 누구에게(보호자 연결), 어떻게(휴대폰 알림·음성), 언제(기상 확인 시간) 알릴지 정하고
 * 보낸 알림과 보호자 확인 여부를 봅니다.
 */
export function AlertsPage() {
  const care = useCareStore()
  const profile = useUserStore((s) => s.profile)
  const voiceGuide = useSettingsStore((s) => s.voiceGuide)
  const setVoiceGuide = useSettingsStore((s) => s.setVoiceGuide)

  return (
    <div className="animate-fade-up">
      <PageHeader title="알림" desc="보호자에게 언제, 어떻게 알릴지 정하고 보낸 알림을 확인해요." />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <InfoCard title="보호자·복지사" icon={<UserRoundCheck />} subtitle="알림을 받는 분 · 연결 링크">
            <ul className="space-y-2">
              <li className="flex items-center justify-between rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100">
                <span>
                  <span className="block text-lg font-bold">{profile.guardianName}</span>
                  <span className="text-base text-ink-soft">{profile.guardianPhone}</span>
                </span>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700">
                  보호자
                </span>
              </li>
              <li className="flex items-center justify-between rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100">
                <span>
                  <span className="block text-lg font-bold">이수진 복지사</span>
                  <span className="text-base text-ink-soft">중구노인종합복지관</span>
                </span>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-700">
                  복지사
                </span>
              </li>
            </ul>
            <FamilyCodeCard />
          </InfoCard>

          <InfoCard title="알림 방법" icon={<Settings2 />} subtitle="기상 확인 시간, 휴대폰 알림, 음성 안내">
            <TextField
              label="기상 확인 마감 시간"
              type="time"
              value={care.wakeUpDeadline}
              onChange={(e) => care.setWakeUpDeadline(e.target.value)}
              hint="이 시간까지 '일어났어요'를 누르지 않으면 알림이 가요."
            />
            <p className="mb-2 mt-5 text-base font-bold">알림 보낼 방법</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CHANNEL_LABEL) as AlertChannel[]).map((c) => {
                const Icon = CHANNEL_ICON[c]
                const ready = READY_CHANNELS.includes(c)
                const on = ready && care.channels.includes(c)
                return (
                  <button
                    key={c}
                    onClick={() => ready && care.toggleChannel(c)}
                    aria-pressed={on}
                    disabled={!ready}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold ring-2 transition ${
                      on
                        ? 'bg-brand-600 text-white ring-brand-600'
                        : ready
                          ? 'bg-white/80 text-ink-soft ring-brand-100'
                          : 'cursor-not-allowed bg-slate-50 text-slate-400 ring-slate-100'
                    }`}
                  >
                    <Icon className="size-6" aria-hidden />
                    {CHANNEL_LABEL[c]}
                    {!ready && <span className="text-xs font-semibold">준비 중</span>}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              카카오톡·문자 발송은 준비 중이에요. 지금은 휴대폰 알림으로 알려 드려요.
            </p>
            <PushPermission
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
                    <AlertAckLine alert={a} />
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
