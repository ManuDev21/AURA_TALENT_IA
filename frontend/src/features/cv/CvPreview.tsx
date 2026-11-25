import type { ResumeSection, ResumeTemplate } from '@/types/cv'
import { formatMonth } from '@/utils/dates'

type Obj = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const month = (v: unknown) => formatMonth(str(v) ? `${str(v)}-01` : null)
const range = (item: Obj) => {
  const start = month(item.start)
  const end = item.current ? 'actualidad' : month(item.end)
  return start && end ? `${start} - ${end}` : start || end
}

/** Vista previa en HTML fiel a la exportacion PDF (una columna, texto legible por ATS). */
export function CvPreview({ sections, template }: { sections: ResumeSection[]; template: ResumeTemplate }) {
  const harvard = template === 'harvard'
  const accent = harvard ? '#111111' : template === 'aura-modern' ? '#e0590a' : '#1a1a21'
  const rule = harvard ? '#111111' : template === 'aura-modern' ? '#f2b07e' : '#c9c9d1'

  return (
    <article
      aria-label="Vista previa del CV"
      className="mx-auto w-full max-w-[640px] rounded-lg bg-white px-10 py-9 font-sans text-[11px] leading-snug text-[#1a1a21] shadow-[0_20px_60px_-20px_rgb(0_0_0/0.8)]"
    >
      {sections
        .filter((s) => s.is_visible)
        .map((section, index) => {
          const c = section.content as Obj
          if (section.section_type === 'header') {
            const links = (c.links as Obj[] | undefined) ?? []
            const contact = [str(c.email), str(c.phone), str(c.location), ...links.map((l) => `${str(l.label)}: ${str(l.url)}`)]
            return (
              <header key={index} className={harvard ? 'mb-4 border-b-2 pb-3 text-center' : 'mb-3'} style={harvard ? { borderColor: rule } : undefined}>
                <h1 className={harvard ? 'text-2xl font-bold uppercase tracking-wider' : 'text-2xl font-bold'}>
                  {str(c.full_name) || 'Tu nombre'}
                </h1>
                {str(c.headline) && <p style={{ color: accent }} className="text-[13px]">{str(c.headline)}</p>}
                <p className="mt-1 text-[10px] text-[#55555f]">{contact.filter(Boolean).join(' | ')}</p>
              </header>
            )
          }
          return (
            <section key={index} className="mt-3">
              <h2
                style={{ color: accent, borderColor: rule }}
                className={harvard ? 'mb-1.5 border-b pb-0.5 text-[12px] font-bold uppercase tracking-widest' : 'mb-1.5 border-b pb-0.5 text-[12px] font-bold uppercase'}
              >
                {section.title ?? section.section_type}
              </h2>
              <SectionBody section={section} />
            </section>
          )
        })}
    </article>
  )
}

function SectionBody({ section }: { section: ResumeSection }) {
  const c = section.content as Obj
  const items = (c.items as Obj[] | undefined) ?? []
  switch (section.section_type) {
    case 'summary':
    case 'custom':
      return <p className="whitespace-pre-line">{str(c.text)}</p>
    case 'skills':
      return (
        <div>
          {((c.groups as Obj[] | undefined) ?? []).map((g, i) => (
            <p key={i}>
              <b>{str(g.category)}:</b> {((g.skills as string[]) ?? []).join(', ')}
            </p>
          ))}
        </div>
      )
    case 'experience':
      return (
        <div className="flex flex-col gap-2">
          {items.map((i, k) => (
            <div key={k}>
              <p className="font-bold">
                {str(i.title)} <span className="font-normal text-[#777]">|</span> {str(i.company)}
              </p>
              <p className="text-[10px] text-[#55555f]">{[range(i), str(i.location)].filter(Boolean).join(' / ')}</p>
              {str(i.description) && <p>{str(i.description)}</p>}
              {((i.achievements as string[]) ?? []).filter(Boolean).length > 0 && (
                <ul className="list-disc pl-4">
                  {((i.achievements as string[]) ?? []).filter(Boolean).map((a, n) => (
                    <li key={n}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )
    case 'education':
      return (
        <div className="flex flex-col gap-2">
          {items.map((i, k) => {
            const degree = [str(i.degree), str(i.field)].filter(Boolean).join(' - ')
            return (
              <div key={k}>
                <p className="font-bold">{degree || str(i.institution)}</p>
                <p className="text-[10px] text-[#55555f]">{[degree ? str(i.institution) : '', range(i)].filter(Boolean).join(' / ')}</p>
              </div>
            )
          })}
        </div>
      )
    case 'projects':
      return (
        <div className="flex flex-col gap-2">
          {items.map((i, k) => (
            <div key={k}>
              <p className="font-bold">
                {str(i.title)}
                {str(i.role) && <span className="font-normal"> | {str(i.role)}</span>}
              </p>
              {str(i.description) && <p>{str(i.description)}</p>}
              <p className="text-[10px] text-[#55555f]">
                {[((i.technologies as string[]) ?? []).join(', '), str(i.url)].filter(Boolean).join(' / ')}
              </p>
            </div>
          ))}
        </div>
      )
    case 'certifications':
      return (
        <div>
          {items.map((i, k) => (
            <p key={k}>
              <b>{str(i.name)}</b> {[str(i.issuer), month(i.date)].filter(Boolean).join(' / ')}
            </p>
          ))}
        </div>
      )
    case 'languages':
      return (
        <div>
          {items.map((i, k) => (
            <p key={k}>
              <b>{str(i.language)}</b>
              {str(i.level) && ` - ${str(i.level)}`}
            </p>
          ))}
        </div>
      )
    default:
      return (
        <div>
          {items.map((i, k) => (
            <p key={k}>
              <b>{str(i.label)}:</b> {str(i.url)}
            </p>
          ))}
        </div>
      )
  }
}
