import { useQuery } from '@tanstack/react-query'
import { Cpu } from 'lucide-react'
import { adminApi } from '@/api/admin'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { OllamaStudioPanel } from '@/features/ai/OllamaStudioPanel'
import { CompanyDataMlLab } from '@/features/career/CompanyDataMlLab'

/** Registro de motores de decision: que version esta en uso, como funciona y sus limites. */
export function ModelsModule() {
  const { data } = useQuery({ queryKey: ['admin', 'models'], queryFn: adminApi.models })
  return (
    <AuraPanel eyebrow="Transparencia y Soberania IA" title="Motor Propio en Ollama, Registro de Modelos y Laboratorio Algorítmico" className="flex flex-col gap-6">
      <OllamaStudioPanel />
      {!data ? (
        <div className="flex justify-center py-10">
          <AuraLoader label="Cargando registro" />
        </div>
      ) : (
        <ul className="grid gap-3.5 md:grid-cols-2">
          {data.engines.map((e) => (
            <li key={e.name} className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-aura-400" aria-hidden="true" />
                <span className="flex-1 font-medium text-bone">{e.name}</span>
                <AuraBadge tone="neutral">{e.version}</AuraBadge>
              </div>
              <p className="text-xs text-graphite-400">{e.task}</p>
              <p className="text-sm text-graphite-300">{e.method}</p>
              <p className="text-xs text-warning">{e.limitations}</p>
            </li>
          ))}
        </ul>
      )}
      <CompanyDataMlLab />
      <p className="text-xs text-graphite-400">
        Ningun motor toma decisiones de contratacion. Cada resultado que ve una persona incluye su explicacion, los datos usados y sus
        limitaciones.
      </p>
    </AuraPanel>
  )
}
