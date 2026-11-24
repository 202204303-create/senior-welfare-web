import { Pencil, Pill, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { BigButton, InfoCard, Modal, PageHeader, SelectField, StatusNote, TextField } from '@/shared/ui'
import { useCareStore } from '@/features/care/store/useCareStore'
import type { MedSlot, Medication } from '@/features/care/types'

const SLOTS: MedSlot[] = ['아침', '점심', '저녁', '취침 전']
const SLOT_TIME: Record<MedSlot, string> = { 아침: '08:00', 점심: '12:30', 저녁: '18:30', '취침 전': '21:30' }

const EMPTY_FORM = { name: '', slot: '아침' as MedSlot, time: '08:00', memo: '' }

/** 약 화면: 드시는 약을 넣고 고치고 지웁니다. (복용 체크는 홈에서) */
export function CarePage() {
  const care = useCareStore()
  const [medNote, setMedNote] = useState<string | null>(null) // 약 추가·수정·삭제 결과 (닫기 전까지 남음)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null) // null 이면 새 약 추가
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const deleteMed = care.medications.find((m) => m.id === deleteId)

  const openAdd = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setAddOpen(true)
  }
  const openEdit = (m: Medication) => {
    setEditId(m.id)
    setForm({ name: m.name, slot: m.slot, time: m.time, memo: m.memo ?? '' })
    setAddOpen(true)
  }

  const submit = () => {
    if (!form.name.trim()) return
    const med = {
      name: form.name.trim(),
      slot: form.slot,
      time: form.time,
      memo: form.memo.trim() || undefined,
    }
    if (editId) {
      care.updateMedication(editId, med)
      setMedNote(`${med.name} 정보를 고쳤어요. (${med.slot} ${med.time})`)
    } else {
      care.addMedication(med)
      setMedNote(`${med.name}을(를) 추가했어요. (${med.slot} ${med.time})`)
    }
    setForm(EMPTY_FORM)
    setEditId(null)
    setAddOpen(false)
  }

  return (
    <div className="max-w-2xl animate-fade-up">
      <PageHeader title="내 약" desc="드시는 약을 넣거나 고쳐요. 약을 드셨다는 체크는 홈에서 해요." />

      <InfoCard title="약 목록" subtitle="약을 누르면 이름·시간을 고칠 수 있어요" icon={<Pill />}>
        {medNote && (
          <StatusNote className="mb-4" onClose={() => setMedNote(null)}>
            {medNote}
          </StatusNote>
        )}
        {care.medications.length === 0 ? (
          <p className="rounded-2xl bg-brand-50 p-4 text-center text-lg font-bold">
            아직 등록한 약이 없어요. 아래에서 추가해 주세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {care.medications.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-brand-100"
              >
                <button
                  onClick={() => openEdit(m)}
                  className="min-h-12 min-w-0 flex-1 rounded-xl text-left hover:bg-brand-50"
                  aria-label={`${m.name} 고치기`}
                >
                  <span className="block text-lg font-bold">{m.name}</span>
                  <span className="flex flex-wrap items-center gap-1 text-base text-ink-soft">
                    {m.slot} {m.time}
                    {m.memo && ` · ${m.memo}`}
                    <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap text-brand-600">
                      <Pencil className="size-4" aria-hidden />
                      고치기
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => setDeleteId(m.id)}
                  className="grid size-12 place-items-center rounded-xl text-rose-500 hover:bg-rose-50"
                  aria-label={`${m.name} 삭제`}
                >
                  <Trash2 className="size-6" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <BigButton fullWidth size="lg" icon={<Plus />} className="mt-4" onClick={openAdd}>
          약 추가하기
        </BigButton>
      </InfoCard>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={editId ? '약 정보 고치기' : '약 추가하기'}
      >
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
            {editId ? '저장하기' : '추가하기'}
          </BigButton>
        </form>
      </Modal>

      <Modal open={!!deleteMed} onClose={() => setDeleteId(null)} title="이 약을 목록에서 지울까요?">
        <p className="mb-6 text-lg text-ink-soft">
          <b className="text-ink">{deleteMed?.name}</b> ({deleteMed?.slot} {deleteMed?.time})을(를) 지우면 이
          약의 복약 안내와 보호자 알림도 멈춰요.
        </p>
        <div className="space-y-3">
          <BigButton fullWidth size="lg" onClick={() => setDeleteId(null)}>
            아니요
          </BigButton>
          <BigButton
            fullWidth
            size="lg"
            variant="danger"
            onClick={() => {
              if (deleteMed) {
                care.removeMedication(deleteMed.id)
                setMedNote(`${deleteMed.name}을(를) 목록에서 지웠어요.`)
              }
              setDeleteId(null)
            }}
          >
            네, 지울게요
          </BigButton>
        </div>
      </Modal>
    </div>
  )
}
