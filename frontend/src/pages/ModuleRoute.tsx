import { type ComponentType, lazy, Suspense } from 'react'
import { useParams } from 'react-router'
import { AREA_MODULES } from '@/aura/modules'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { ModulePlaceholder } from '@/pages/ModulePlaceholder'
import { NotFoundPanel } from '@/pages/StatusPages'
import type { AuraArea } from '@/utils/roles'

/** Carga diferida: cada modulo se descarga solo al abrirlo (arranque mas rapido de la PWA). */
function load<M extends Record<string, unknown>>(factory: () => Promise<M>, name: keyof M): ComponentType {
  return lazy(() => factory().then((m) => ({ default: m[name] as ComponentType })))
}

const RecruitWorkspace = () => import('@/features/jobs/RecruitWorkspace')
const CandidatesList = lazy(() => RecruitWorkspace().then((m) => ({ default: () => <m.RecruitWorkspace mode="list" /> })))
const PipelineBoard = lazy(() => RecruitWorkspace().then((m) => ({ default: () => <m.RecruitWorkspace mode="board" /> })))

/** Modulos implementados por area. El resto muestra en que fase se construye. */
const IMPLEMENTED: Partial<Record<`${AuraArea}:${string}`, ComponentType>> = {
  'candidate:profile': load(() => import('@/features/talent/ProfileModule'), 'ProfileModule'),
  'candidate:account': load(() => import('@/features/talent/AccountModule'), 'AccountModule'),
  'candidate:portfolio': load(() => import('@/features/portfolio/PortfolioModule'), 'PortfolioModule'),
  'candidate:passport': load(() => import('@/features/talent/SkillsPassportModule'), 'SkillsPassportModule'),
  'candidate:interview-prep': load(() => import('@/features/jobs/InterviewPrepModule'), 'InterviewPrepModule'),
  'candidate:cv': load(() => import('@/features/cv/CvModule'), 'CvModule'),
  'candidate:jobs': load(() => import('@/features/jobs/JobSearchModule'), 'JobSearchModule'),
  'candidate:applications': load(() => import('@/features/jobs/MyApplicationsModule'), 'MyApplicationsModule'),
  'candidate:assessments': load(() => import('@/features/assessments/AssessmentsModule'), 'AssessmentsModule'),
  'candidate:match': load(() => import('@/features/match/MatchModule'), 'MatchModule'),
  'candidate:recommendations': load(() => import('@/features/career/RecommendationsModule'), 'RecommendationsModule'),
  'candidate:career': load(() => import('@/features/career/CareerModule'), 'CareerModule'),
  'candidate:vision': load(() => import('@/features/vision/VisionModule'), 'VisionModule'),
  'candidate:insights': load(() => import('@/features/analytics/InsightsModule'), 'InsightsModule'),
  'candidate:privacy': load(() => import('@/features/privacy/PrivacyModule'), 'PrivacyModule'),
  'company:jobs': load(() => import('@/features/jobs/CompanyJobsModule'), 'CompanyJobsModule'),
  'company:candidates': CandidatesList,
  'company:pipeline': PipelineBoard,
  'company:assessments': load(() => import('@/features/assessments/CompanyAssessmentsModule'), 'CompanyAssessmentsModule'),
  'company:match': load(() => import('@/features/match/CompanyMatchModule'), 'CompanyMatchModule'),
  'company:algorithms': load(() => import('@/features/career/CompanyAlgorithmsModule'), 'CompanyAlgorithmsModule'),
  'company:analytics': load(() => import('@/features/analytics/CompanyAnalyticsModule'), 'CompanyAnalyticsModule'),
  'company:reports': load(() => import('@/features/analytics/ReportsModule'), 'ReportsModule'),
  'company:company': load(() => import('@/features/company/CompanyModule'), 'CompanyModule'),
  'company:privacy': load(() => import('@/features/privacy/PrivacyModule'), 'PrivacyModule'),
  'admin:roles': load(() => import('@/features/admin/AdminRolesPanel'), 'AdminRolesPanel'),
  'admin:catalogs': load(() => import('@/features/admin/CatalogsPanel'), 'CatalogsPanel'),
  'admin:instruments': load(() => import('@/features/assessments/InstrumentsPanel'), 'InstrumentsPanel'),
  'admin:models': load(() => import('@/features/admin/ModelsModule'), 'ModelsModule'),
  'admin:audit': load(() => import('@/features/admin/AuditModule'), 'AuditModule'),
}

export function ModuleRoute({ area }: { area: AuraArea }) {
  const { moduleId } = useParams()
  const module = AREA_MODULES[area].find((m) => m.id === moduleId)
  if (!module) return <NotFoundPanel />
  const Component = IMPLEMENTED[`${area}:${module.id}`]
  if (!Component) return <ModulePlaceholder module={module} />
  return (
    <Suspense
      fallback={
        <div className="glass flex justify-center rounded-3xl py-16">
          <AuraLoader label={`Abriendo ${module.label}`} />
        </div>
      }
    >
      <Component />
    </Suspense>
  )
}
