import { useState, type FormEvent } from 'react'
import { MessageSquare, Send, CheckCircle2, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import SectionCard from '../components/SectionCard'
import { submitFeedback, ApiError } from '../lib/api'

const PAGE_OPTIONS = [
  '首页',
  '切相调压计算器',
  '电池估算计算器',
  '关于页',
  '其它 / 未指明',
]

const MIN_LEN = 10
const MAX_LEN = 4000

export default function Feedback() {
  const [page, setPage] = useState(PAGE_OPTIONS[0])
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const tooShort = content.trim().length > 0 && content.trim().length < MIN_LEN

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (content.trim().length < MIN_LEN) {
      setError(`问题描述至少 ${MIN_LEN} 个字，请写清是哪一项结果、期望值与实际值的差异。`)
      return
    }

    setSubmitting(true)
    try {
      await submitFeedback({
        page,
        content: content.trim(),
        contact: contact.trim() || undefined,
        website: honeypot,
      })
      setDone(true)
      setContent('')
      setContact('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '网络异常，提交未成功，请稍后再试。')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="card-surface p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-text-primary mb-2">已收到，谢谢</h1>
          <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
            留言已提交。你的反馈不会公开展示，仅作者本人可在后台看到。
            如果能复现问题，我会核对公式与边界条件后修正。
          </p>
          <button
            onClick={() => setDone(false)}
            className="mt-6 px-4 py-2 rounded-md text-sm font-medium text-primary-light border border-primary-light/40 hover:bg-primary-dark/30 transition-colors"
          >
            再写一条
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
          <MessageSquare className="w-6 h-6 text-primary-light" />
          读者留言
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mt-2">
          本站的计算器都是工程近似工具，公式推导与边界条件可能仍有疏漏。
          如果你发现结果与手算、数据手册或实测不符，请在这里指出——
          <strong className="text-text-primary">具体到哪里不对，比“好像有问题”有用得多。</strong>
        </p>
      </div>

      <div className="p-3.5 rounded-md bg-primary-dark/25 border border-primary-light/25 flex gap-2.5">
        <ShieldCheck className="w-4 h-4 text-primary-light shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          留言<strong className="text-text-primary">不会公开展示</strong>，也不会出现在任何页面上。
          只有作者能在后台查看。若你留了联系方式，仅用于回复你的问题。
        </p>
      </div>

      <SectionCard title="填写反馈">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="fb-page" className="block text-xs font-medium text-text-secondary mb-1.5">
              涉及页面
            </label>
            <select
              id="fb-page"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className="input-field"
            >
              {PAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="fb-content" className="block text-xs font-medium text-text-secondary">
                问题描述 <span className="text-danger">*</span>
              </label>
              <span className={`text-[11px] tabular ${content.length > MAX_LEN ? 'text-danger' : 'text-text-muted'}`}>
                {content.length} / {MAX_LEN}
              </span>
            </div>
            <textarea
              id="fb-content"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
              rows={8}
              placeholder={
                '建议写清四点：\n' +
                '1. 输入了什么（如 α = 60°，U₀ = 220 V）\n' +
                '2. 页面给出的结果\n' +
                '3. 你认为正确的值，以及依据（手算过程 / 数据手册页码 / 实测波形）\n' +
                '4. 若涉及公式，指出哪一步推导有问题'
              }
              className="input-field resize-y leading-relaxed"
              style={{ fontFamily: 'inherit' }}
            />
            {tooShort && (
              <p className="text-[11px] text-accent mt-1.5">再多写几个字，方便定位问题。</p>
            )}
          </div>

          <div>
            <label htmlFor="fb-contact" className="block text-xs font-medium text-text-secondary mb-1.5">
              联系方式 <span className="text-text-muted font-normal">（可选，便于回复你）</span>
            </label>
            <input
              id="fb-contact"
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={200}
              placeholder="邮箱 / 微信号，留空也可以"
              className="input-field"
              style={{ fontFamily: 'inherit' }}
              autoComplete="off"
            />
          </div>

          {/* 蜜罐：对真人不可见，机器人会填。填了则不计入。 */}
          <div aria-hidden="true" className="absolute opacity-0 pointer-events-none -z-10 h-0 overflow-hidden">
            <label htmlFor="fb-website">Website</label>
            <input
              id="fb-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/30 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1">
            <p className="text-[11px] text-text-muted leading-relaxed">
              提交即为同意作者在改进本站时参考该反馈。
            </p>
            <button
              type="submit"
              disabled={submitting || content.trim().length < MIN_LEN}
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? '提交中…' : '提交'}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  )
}
