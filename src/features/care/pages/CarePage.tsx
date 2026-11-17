import {
  BellRing,
  MessageCircle,
  Plus,
  Settings2,
  Smartphone,
  Trash2,
  UserRoundCheck,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useState } from 'react'
import {
  AlertAckLine,
  FamilyCodeCard,
  MedChecklist,
  MedProgress,
  SOSButton,
  WakeUpCard,
} from '@/features/care/components/CareWidgets'
import { BigButton, InfoCard, Modal, PageHeader, SelectField, TextField } from '@/shared/ui'
import { CHANNEL_LABEL, requestPushPermission } from '@/features/care/hooks/useCareWatcher'
import { useCareStore, type AlertChannel } from '@/features/care/store/useCareStore'
import { useSettingsStore } from '@/shared/store/useSettingsStore'
import { speak } from '@/shared/lib/notify'
import { useUserStore } from '@/features/auth/store/useUserStore'
import type { MedSlot } from '@/features/care/types'

const SLOTS: MedSlot[] = ['아침', '점심', '저녁', '취침 전']
const SLOT_TIME: Record<MedSlot, string> = { 아침: '08:00', 점심: '12:30', 저녁: '18:30', '취침 전': '21:30' }
const CHANNEL_ICON: Record<AlertChannel, typeof BellRing> = {
  webpush: BellRing,
  kakao: MessageCircle,
  sms: Smartphone,
}

export function CarePage() {
  const care = useCareStore()
  const profile = useUserStore((s) => s.profile)
  const showToast = useSettingsStore((s) => s.showToast)
  const voiceGuide = useSettingsStore((s) => s.voiceGuide)
  const setVoiceGuide = useSettingsStore((s) => s.setVoiceGuide)
  const [addOpen, setAddOpen] = useState(false)
  const [manage, setManage] = useState(false)
  const [form, setForm] = useState({ name: '', slot: '아침' as MedSlot, time: '08:00', memo: '' })

  const enablePush = async () => {
    const res = await requestPushPermission()
    if (res === 'granted') {
      if (!care.channels.includes('webpush')) care.toggleChannel('webpush')
      showToast('웹 푸시 알림이 켜졌어요.', 'success')
    } else if (res === 'unsupported') showToast('이 브라우저는 웹 푸시를 지원하지 않아요.', 'warn')
    else showToast('알림 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.', 'warn')
  }

  const submit = () => {
    if (!form.name.trim()) return
    care.addMedication({
      name: form.name.trim(),
      slot: form.slot,
      time: form.time,
      memo: form.memo.trim() || undefined,
    })
    showToast('새 약을 추가했어요.', 'success')
    setForm({ name: '', slot: '아침', time: '08:00', memo: '' })
    setAddOpen(false)
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="안부·복약 관리" desc="매일 안부를 확인하고 약 드실 시간을 챙겨드려요." />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <WakeUpCard />

          <InfoCard
            title="시간대별 복약 체크"
            subtitle="약을 드신 후 눌러주세요"
            action={
              <BigButton size="md" variant={manage ? 'primary' : 'soft'} onClick={() => setManage((v) => !v)}>
                {manage ? '완료' : '편집'}
              </BigButton>
            }
          >
            <div className="mb-4">
              <MedProgress />
            </div>
            {manage ? (
              <ul className="space-y-2">
                {care.medications.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-brand-100"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold">{m.name}</span>
                      <span className="text-sm text-ink-soft">
                        {m.slot} · {m.time}
                      </span>
                    </span>
                    <button
                      onClick={() => care.removeMedication(m.id)}
                      className="grid size-12 place-items-center rounded-xl text-rose-500 hover:bg-rose-50"
                      aria-label={`${m.name} 삭제`}
                    >
                      <Trash2 className="size-6" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <MedChecklist />
            )}
            <BigButton
              variant="outline"
              fullWidth
              icon={<Plus />}
              className="mt-4"
              onClick={() => setAddOpen(true)}
            >
              약 추가하기
            </BigButton>
          </InfoCard>
        </div>

        <div className="space-y-5">
          <SOSButton />

          <InfoCard title="보호자·복지사" icon={<UserRoundCheck />} subtitle="미확인 시 알림을 받는 분">
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

          <InfoCard title="알림 설정" icon={<Settings2 />}>
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
                const on = care.channels.includes(c)
                return (
                  <button
                    key={c}
                    onClick={() => care.toggleChannel(c)}
                    aria-pressed={on}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold ring-2 transition ${
                      on
                        ? 'bg-brand-600 text-white ring-brand-600'
                        : 'bg-white/80 text-ink-soft ring-brand-100'
                    }`}
                  >
                    <Icon className="size-6" aria-hidden />
                    {CHANNEL_LABEL[c]}
                  </button>
                )
              })}
            </div>
            <BigButton
              variant="soft"
              fullWidth
              size="md"
              icon={<BellRing />}
              className="mt-3"
              onClick={enablePush}
            >
              이 기기에서 웹 푸시 허용하기
            </BigButton>
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
              <span className="rounded-full bg-white px-3 py-1 text-sm">{voiceGuide ? '켜짐' : '꺼짐'}</span>
            </button>
          </InfoCard>

          <InfoCard
            title="알림 발송 기록"
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
                      {a.channels.map((c) => CHANNEL_LABEL[c]).join(', ') || '채널 없음'} →{' '}
                      {a.recipients.join(', ')}
                    </p>
                    <AlertAckLine alert={a} />
                  </li>
                ))}
              </ul>
            )}
          </InfoCard>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="약 추가하기">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <TextField
            label="약 이름"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="예: 혈압약"
            required
          />
          <SelectField
            label="복용 시간대"
            options={SLOTS}
            value={form.slot}
            onChange={(e) => {
              const slot = e.target.value as MedSlot
              setForm({ ...form, slot, time: SLOT_TIME[slot] })
            }}
          />
          <TextField
            label="알림 시각"
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
          <TextField
            label="메모 (선택)"
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            placeholder="예: 식후 30분"
          />
          <BigButton type="submit" fullWidth size="xl" disabled={!form.name.trim()}>
            추가하기
          </BigButton>
        </form>
      </Modal>
    </div>
  )
}
