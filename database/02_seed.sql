-- =============================================================================
-- AURA TALENT AI - 02: Datos semilla
-- Ejecutar sobre la base aura_talent despues de 01_schema.sql.
-- Los usuarios demo NO se crean aqui: las contrasenas deben hashearse con
-- Argon2 desde el backend (se creara un seeder en Python).
-- =============================================================================

SET ROLE aura_app;

BEGIN;

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
INSERT INTO roles (code, name, description) VALUES
    ('ROLE_CANDIDATE',     'Candidato',                'Profesional que gestiona su perfil, CV, evaluaciones y postulaciones.'),
    ('ROLE_RECRUITER',     'Reclutador',               'Gestiona vacantes y procesos de seleccion dentro de su empresa.'),
    ('ROLE_COMPANY_ADMIN', 'Administrador de empresa', 'Administra la empresa, sus miembros, vacantes y reportes.'),
    ('ROLE_SYSTEM_ADMIN',  'Administrador del sistema','Administra la plataforma, catalogos, instrumentos y modelos.');

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
INSERT INTO permissions (code, module, description) VALUES
    ('users:read_self',               'users',           'Ver la propia cuenta'),
    ('users:manage',                  'users',           'Administrar cuentas de usuario'),
    ('profile:read_own',              'candidates',      'Ver el propio perfil profesional'),
    ('profile:write_own',             'candidates',      'Editar el propio perfil profesional'),
    ('candidates:read',               'candidates',      'Ver perfiles de candidatos postulados o visibles'),
    ('cv:read_own',                   'cv',              'Ver los propios CV'),
    ('cv:write_own',                  'cv',              'Crear y editar los propios CV'),
    ('portfolio:write_own',           'portfolio',       'Gestionar el propio portfolio'),
    ('companies:read',                'companies',       'Ver perfiles de empresa'),
    ('companies:write',               'companies',       'Editar el perfil de la empresa'),
    ('companies:manage_members',      'companies',       'Gestionar miembros de la empresa'),
    ('jobs:read',                     'jobs',            'Ver vacantes'),
    ('jobs:write',                    'jobs',            'Crear y editar vacantes'),
    ('jobs:publish',                  'jobs',            'Publicar, pausar y cerrar vacantes'),
    ('applications:create',           'applications',    'Postularse a vacantes'),
    ('applications:read_own',         'applications',    'Ver las propias postulaciones'),
    ('applications:read_company',     'applications',    'Ver postulaciones de la empresa'),
    ('applications:advance',          'applications',    'Mover postulaciones entre etapas (decision humana)'),
    ('applications:notes',            'applications',    'Agregar notas a postulaciones'),
    ('assessments:take',              'assessments',     'Responder evaluaciones'),
    ('assessments:read_own_results',  'assessments',     'Ver los propios resultados'),
    ('assessments:manage',            'assessments',     'Crear y editar evaluaciones'),
    ('assessments:assign',            'assessments',     'Asignar evaluaciones a candidatos'),
    ('assessments:read_company_results','assessments',   'Ver resultados compartidos con la empresa'),
    ('psychometrics:manage',          'psychometrics',   'Gestionar instrumentos psicometricos y versiones'),
    ('match:read_own',                'match',           'Ver la propia compatibilidad con vacantes'),
    ('match:read_company',            'match',           'Ver compatibilidad de candidatos con vacantes de la empresa'),
    ('recommendations:read_own',      'recommendations', 'Ver recomendaciones propias'),
    ('career:write_own',              'career',          'Gestionar el propio Career Map'),
    ('aura:use',                      'aura',            'Interactuar con AURA'),
    ('vision:enroll',                 'vision',          'Registrar y revocar verificacion facial propia'),
    ('analytics:read_own',            'analytics',       'Ver analitica personal'),
    ('analytics:read_company',        'analytics',       'Ver analitica de la empresa'),
    ('reports:generate_own',          'reports',         'Generar reportes personales'),
    ('reports:generate_company',      'reports',         'Generar reportes de la empresa'),
    ('notifications:read_own',        'notifications',   'Ver notificaciones propias'),
    ('audit:read',                    'admin',           'Consultar la auditoria'),
    ('admin:roles',                   'admin',           'Administrar roles y permisos'),
    ('admin:catalogs',                'admin',           'Administrar catalogos (skills, recursos)'),
    ('admin:ml_models',               'admin',           'Administrar modelos de ML');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM (VALUES
        ('ROLE_CANDIDATE', ARRAY[
            'users:read_self', 'profile:read_own', 'profile:write_own', 'cv:read_own', 'cv:write_own',
            'portfolio:write_own', 'companies:read', 'jobs:read', 'applications:create',
            'applications:read_own', 'assessments:take', 'assessments:read_own_results',
            'match:read_own', 'recommendations:read_own', 'career:write_own', 'aura:use',
            'vision:enroll', 'analytics:read_own', 'reports:generate_own', 'notifications:read_own']),
        ('ROLE_RECRUITER', ARRAY[
            'users:read_self', 'candidates:read', 'companies:read', 'jobs:read', 'jobs:write',
            'jobs:publish', 'applications:read_company', 'applications:advance', 'applications:notes',
            'assessments:manage', 'assessments:assign', 'assessments:read_company_results',
            'match:read_company', 'aura:use', 'vision:enroll', 'analytics:read_company',
            'reports:generate_company', 'notifications:read_own']),
        ('ROLE_COMPANY_ADMIN', ARRAY[
            'users:read_self', 'candidates:read', 'companies:read', 'companies:write',
            'companies:manage_members', 'jobs:read', 'jobs:write', 'jobs:publish',
            'applications:read_company', 'applications:advance', 'applications:notes',
            'assessments:manage', 'assessments:assign', 'assessments:read_company_results',
            'match:read_company', 'aura:use', 'vision:enroll', 'analytics:read_company',
            'reports:generate_company', 'notifications:read_own', 'audit:read']),
        ('ROLE_SYSTEM_ADMIN', ARRAY[
            'users:read_self', 'users:manage', 'companies:read', 'jobs:read', 'assessments:manage',
            'psychometrics:manage', 'aura:use', 'notifications:read_own', 'audit:read',
            'admin:roles', 'admin:catalogs', 'admin:ml_models'])
       ) AS m(role_code, perms)
  JOIN roles r ON r.code = m.role_code
  JOIN permissions p ON p.code = ANY (m.perms);

-- -----------------------------------------------------------------------------
-- Etapas del pipeline
-- -----------------------------------------------------------------------------
INSERT INTO application_stages (code, name, display_order, is_terminal) VALUES
    ('APPLIED',      'Postulado',        1, false),
    ('SCREENING',    'Screening',        2, false),
    ('ASSESSMENT',   'Evaluacion',       3, false),
    ('INTERVIEW',    'Entrevista',       4, false),
    ('FINAL_REVIEW', 'Revision final',   5, false),
    ('HIRED',        'Contratado',       6, true),
    ('CLOSED',       'Cerrado',          7, true);

-- -----------------------------------------------------------------------------
-- Tipos de evaluacion
-- -----------------------------------------------------------------------------
INSERT INTO assessment_types (code, name, description) VALUES
    ('cognitive',    'Cognitive Assessment',     'Evaluacion cognitiva general.'),
    ('logical',      'Logical Reasoning',        'Razonamiento logico.'),
    ('verbal',       'Verbal Reasoning',         'Razonamiento verbal.'),
    ('numerical',    'Numerical Reasoning',      'Razonamiento numerico.'),
    ('technical',    'Technical Assessment',     'Conocimientos tecnicos por tecnologia.'),
    ('situational',  'Situational Assessment',   'Escenarios laborales evaluados con rubricas definidas.'),
    ('language',     'Language Assessment',      'Dominio de idiomas.'),
    ('orientation',  'Professional Orientation', 'Orientacion profesional.'),
    ('psychometric', 'Psychometric Assessment',  'Instrumentos experimentales de orientacion profesional. No son pruebas clinicas.');

-- -----------------------------------------------------------------------------
-- Catalogo de skills
-- -----------------------------------------------------------------------------
INSERT INTO skill_categories (code, name) VALUES
    ('frontend', 'Frontend'),
    ('backend',  'Backend'),
    ('data',     'Data'),
    ('ai_ml',    'Inteligencia Artificial y ML'),
    ('database', 'Bases de datos'),
    ('devops',   'DevOps y Cloud'),
    ('testing',  'Testing y calidad'),
    ('design',   'Diseno UX/UI'),
    ('practices','Metodologias'),
    ('soft',     'Habilidades transversales');

INSERT INTO skills (name, slug, category_id, skill_type)
SELECT s.name, s.slug, c.id, s.skill_type
  FROM (VALUES
        ('HTML',                    'html',                 'frontend', 'technical'),
        ('CSS',                     'css',                  'frontend', 'technical'),
        ('JavaScript',              'javascript',           'frontend', 'programming_language'),
        ('TypeScript',              'typescript',           'frontend', 'programming_language'),
        ('React',                   'react',                'frontend', 'framework'),
        ('Vue.js',                  'vuejs',                'frontend', 'framework'),
        ('Angular',                 'angular',              'frontend', 'framework'),
        ('Next.js',                 'nextjs',               'frontend', 'framework'),
        ('TailwindCSS',             'tailwindcss',          'frontend', 'framework'),
        ('Three.js',                'threejs',              'frontend', 'framework'),
        ('Vite',                    'vite',                 'frontend', 'tool'),
        ('Node.js',                 'nodejs',               'backend',  'platform'),
        ('Express',                 'express',              'backend',  'framework'),
        ('Python',                  'python',               'backend',  'programming_language'),
        ('FastAPI',                 'fastapi',              'backend',  'framework'),
        ('Django',                  'django',               'backend',  'framework'),
        ('Flask',                   'flask',                'backend',  'framework'),
        ('Java',                    'java',                 'backend',  'programming_language'),
        ('Spring Boot',             'spring-boot',          'backend',  'framework'),
        ('C#',                      'csharp',               'backend',  'programming_language'),
        ('.NET',                    'dotnet',               'backend',  'framework'),
        ('PHP',                     'php',                  'backend',  'programming_language'),
        ('Laravel',                 'laravel',              'backend',  'framework'),
        ('Go',                      'go',                   'backend',  'programming_language'),
        ('REST APIs',               'rest-apis',            'backend',  'technical'),
        ('GraphQL',                 'graphql',              'backend',  'technical'),
        ('SQL',                     'sql',                  'database', 'programming_language'),
        ('PostgreSQL',              'postgresql',           'database', 'tool'),
        ('MySQL',                   'mysql',                'database', 'tool'),
        ('MongoDB',                 'mongodb',              'database', 'tool'),
        ('Redis',                   'redis',                'database', 'tool'),
        ('SQLAlchemy',              'sqlalchemy',           'database', 'framework'),
        ('Pandas',                  'pandas',               'data',     'framework'),
        ('NumPy',                   'numpy',                'data',     'framework'),
        ('Analisis de datos',       'data-analysis',        'data',     'technical'),
        ('Estadistica',             'statistics',           'data',     'technical'),
        ('Power BI',                'power-bi',             'data',     'tool'),
        ('Excel',                   'excel',                'data',     'tool'),
        ('scikit-learn',            'scikit-learn',         'ai_ml',    'framework'),
        ('XGBoost',                 'xgboost',              'ai_ml',    'framework'),
        ('Machine Learning',        'machine-learning',     'ai_ml',    'technical'),
        ('Deep Learning',           'deep-learning',        'ai_ml',    'technical'),
        ('NLP',                     'nlp',                  'ai_ml',    'technical'),
        ('Computer Vision',         'computer-vision',      'ai_ml',    'technical'),
        ('OpenCV',                  'opencv',               'ai_ml',    'framework'),
        ('Git',                     'git',                  'devops',   'tool'),
        ('Docker',                  'docker',               'devops',   'tool'),
        ('Kubernetes',              'kubernetes',           'devops',   'tool'),
        ('Linux',                   'linux',                'devops',   'platform'),
        ('AWS',                     'aws',                  'devops',   'platform'),
        ('Azure',                   'azure',                'devops',   'platform'),
        ('Google Cloud',            'google-cloud',         'devops',   'platform'),
        ('CI/CD',                   'ci-cd',                'devops',   'methodology'),
        ('Testing automatizado',    'automated-testing',    'testing',  'technical'),
        ('Jest',                    'jest',                 'testing',  'framework'),
        ('Pytest',                  'pytest',               'testing',  'framework'),
        ('Figma',                   'figma',                'design',   'tool'),
        ('Diseno UX',               'ux-design',            'design',   'technical'),
        ('Diseno UI',               'ui-design',            'design',   'technical'),
        ('Scrum',                   'scrum',                'practices','methodology'),
        ('Metodologias agiles',     'agile',                'practices','methodology'),
        ('Comunicacion',            'communication',        'soft',     'soft'),
        ('Trabajo en equipo',       'teamwork',             'soft',     'soft'),
        ('Resolucion de problemas', 'problem-solving',      'soft',     'soft'),
        ('Liderazgo',               'leadership',           'soft',     'soft'),
        ('Gestion del tiempo',      'time-management',      'soft',     'soft'),
        ('Adaptabilidad',           'adaptability',         'soft',     'soft'),
        ('Pensamiento critico',     'critical-thinking',    'soft',     'soft'),
        ('Aprendizaje continuo',    'continuous-learning',  'soft',     'soft')
       ) AS s(name, slug, category_code, skill_type)
  JOIN skill_categories c ON c.code = s.category_code;

INSERT INTO skill_aliases (skill_id, alias)
SELECT sk.id, a.alias
  FROM (VALUES
        ('javascript', 'JS'), ('javascript', 'ECMAScript'), ('javascript', 'ES6'),
        ('typescript', 'TS'),
        ('react', 'ReactJS'), ('react', 'React.js'),
        ('vuejs', 'Vue'), ('vuejs', 'VueJS'),
        ('nextjs', 'NextJS'),
        ('tailwindcss', 'Tailwind'),
        ('threejs', 'ThreeJS'),
        ('nodejs', 'Node'), ('nodejs', 'NodeJS'),
        ('express', 'Express.js'), ('express', 'ExpressJS'),
        ('csharp', 'C Sharp'),
        ('dotnet', 'dotnet core'), ('dotnet', 'ASP.NET'),
        ('go', 'Golang'),
        ('rest-apis', 'REST'), ('rest-apis', 'API REST'), ('rest-apis', 'RESTful'),
        ('postgresql', 'Postgres'),
        ('mongodb', 'Mongo'),
        ('scikit-learn', 'sklearn'),
        ('machine-learning', 'ML'), ('machine-learning', 'Aprendizaje automatico'),
        ('deep-learning', 'Aprendizaje profundo'),
        ('nlp', 'Procesamiento de lenguaje natural'),
        ('computer-vision', 'Vision por computadora'), ('computer-vision', 'Vision artificial'),
        ('data-analysis', 'Data Analysis'), ('data-analysis', 'Analisis de datos'),
        ('statistics', 'Statistics'),
        ('kubernetes', 'K8s'),
        ('aws', 'Amazon Web Services'),
        ('google-cloud', 'GCP'), ('google-cloud', 'Google Cloud Platform'),
        ('automated-testing', 'Testing'), ('automated-testing', 'Pruebas automatizadas'),
        ('ux-design', 'UX'), ('ui-design', 'UI'),
        ('agile', 'Agile'),
        ('communication', 'Communication'),
        ('teamwork', 'Teamwork'),
        ('problem-solving', 'Problem solving'),
        ('leadership', 'Leadership'),
        ('time-management', 'Time management'),
        ('adaptability', 'Adaptability'),
        ('critical-thinking', 'Critical thinking')
       ) AS a(slug, alias)
  JOIN skills sk ON sk.slug = a.slug
 WHERE lower(a.alias) <> lower(sk.name::text);

-- -----------------------------------------------------------------------------
-- Catalogo de comandos de AURA (tools permitidas para el Orchestrator)
-- -----------------------------------------------------------------------------
INSERT INTO ai_commands (code, intent, description, required_permission, risk_level,
                         requires_confirmation, allowed_roles, examples) VALUES
    ('aura.help',                'help',              'Explica lo que AURA puede hacer en el contexto actual.',
     'aura:use', 'low', false, ARRAY['ROLE_CANDIDATE','ROLE_RECRUITER','ROLE_COMPANY_ADMIN','ROLE_SYSTEM_ADMIN'],
     ARRAY['AURA, que puedes hacer?', 'Ayuda']),
    ('navigation.open',          'navigate',          'Abre un modulo de la plataforma.',
     'aura:use', 'low', false, ARRAY['ROLE_CANDIDATE','ROLE_RECRUITER','ROLE_COMPANY_ADMIN','ROLE_SYSTEM_ADMIN'],
     ARRAY['AURA, abre mis postulaciones', 'Ir al Career Map']),
    ('profile.analyze',          'profile_analyze',   'Analiza el perfil profesional del candidato.',
     'profile:read_own', 'low', false, ARRAY['ROLE_CANDIDATE'],
     ARRAY['AURA, analiza mi perfil']),
    ('cv.create',                'cv_create',         'Crea un nuevo CV a partir del perfil existente.',
     'cv:write_own', 'medium', true, ARRAY['ROLE_CANDIDATE'],
     ARRAY['AURA, crea mi CV', 'Crea un CV frontend']),
    ('cv.analyze',               'cv_analyze',        'Analiza un CV y sugiere mejoras sin inventar datos.',
     'cv:read_own', 'low', false, ARRAY['ROLE_CANDIDATE'],
     ARRAY['AURA, analiza mi CV']),
    ('jobs.search',              'jobs_search',       'Busca vacantes publicadas segun criterios.',
     'jobs:read', 'low', false, ARRAY['ROLE_CANDIDATE','ROLE_RECRUITER','ROLE_COMPANY_ADMIN'],
     ARRAY['AURA, busca vacantes de frontend']),
    ('job.analyze',              'job_analyze',       'Analiza los requisitos de una vacante.',
     'jobs:read', 'low', false, ARRAY['ROLE_CANDIDATE','ROLE_RECRUITER','ROLE_COMPANY_ADMIN'],
     ARRAY['AURA, analiza esta vacante']),
    ('match.compare',            'match_compare',     'Compara el perfil del candidato con una vacante.',
     'match:read_own', 'low', false, ARRAY['ROLE_CANDIDATE'],
     ARRAY['AURA, compara mi perfil con esta vacante']),
    ('skills.gaps',              'skills_gaps',       'Identifica brechas de habilidades frente a objetivos o vacantes.',
     'match:read_own', 'low', false, ARRAY['ROLE_CANDIDATE'],
     ARRAY['AURA, que habilidades necesito mejorar?']),
    ('career.generate',          'career_generate',   'Genera una ruta profesional en el Career Map.',
     'career:write_own', 'medium', true, ARRAY['ROLE_CANDIDATE'],
     ARRAY['AURA, genera una ruta profesional']),
    ('report.generate',          'report_generate',   'Genera un reporte del perfil del candidato.',
     'reports:generate_own', 'low', false, ARRAY['ROLE_CANDIDATE'],
     ARRAY['AURA, genera un reporte de mi perfil']),
    ('job.create',               'job_create',        'Crea una vacante en estado DRAFT para revision humana.',
     'jobs:write', 'medium', true, ARRAY['ROLE_RECRUITER','ROLE_COMPANY_ADMIN'],
     ARRAY['AURA, crea una vacante']),
    ('candidates.analyze',       'candidates_analyze','Resume y organiza los candidatos de una vacante.',
     'applications:read_company', 'low', false, ARRAY['ROLE_RECRUITER','ROLE_COMPANY_ADMIN'],
     ARRAY['AURA, analiza los candidatos']),
    ('candidates.filter_minimum','candidates_filter', 'Muestra candidatos que cumplen requisitos minimos (filtro visible, no rechazo).',
     'applications:read_company', 'low', false, ARRAY['ROLE_RECRUITER','ROLE_COMPANY_ADMIN'],
     ARRAY['AURA, muestra los candidatos que cumplen los requisitos minimos']),
    ('vacancy.report',           'vacancy_report',    'Genera un reporte de la vacante.',
     'reports:generate_company', 'low', false, ARRAY['ROLE_RECRUITER','ROLE_COMPANY_ADMIN'],
     ARRAY['AURA, genera un reporte de esta vacante']),
    ('gaps.aggregate',           'gaps_aggregate',    'Identifica las principales brechas de habilidades entre candidatos.',
     'analytics:read_company', 'low', false, ARRAY['ROLE_RECRUITER','ROLE_COMPANY_ADMIN'],
     ARRAY['AURA, identifica las principales brechas de habilidades']);

-- -----------------------------------------------------------------------------
-- Instrumentos de evaluacion iniciales
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_disclaimer constant text :=
        'Este resultado representa unicamente las respuestas proporcionadas durante esta evaluacion y no constituye un diagnostico psicologico.';
    v_assessment uuid;
    v_version    uuid;
    v_scale      uuid;
    v_question   uuid;
    v_skill_js   uuid;
    v_order      integer := 0;
    r            record;
BEGIN
    -- =========================================================================
    -- 1. Instrumento psicometrico experimental de orientacion profesional
    -- =========================================================================
    INSERT INTO assessments (type_id, code, title, description, is_experimental, license_type, status)
    SELECT id, 'AURA-ORIENT-EXP',
           'Perfil de estilo de trabajo (experimental)',
           'Instrumento experimental de orientacion profesional con preguntas originales. Describe tendencias observadas en las respuestas; no es una prueba psicologica clinica validada.',
           true, 'original', 'published'
      FROM assessment_types WHERE code = 'psychometric'
    RETURNING id INTO v_assessment;

    INSERT INTO assessment_versions (assessment_id, version_no, status, time_limit_seconds, instructions,
                                     consent_text, limitations_text, disclaimer_text, randomize_questions)
    VALUES (v_assessment, 1, 'draft', 1200,
            'Lee cada afirmacion y selecciona que tan de acuerdo estas. No hay respuestas correctas ni incorrectas. Responde pensando en como sueles actuar en contextos de trabajo o estudio.',
            'Acepto responder este instrumento experimental de orientacion profesional. Entiendo que mis respuestas se usaran para generar tendencias orientativas, que no constituyen un diagnostico y que puedo decidir si las comparto con empresas.',
            'Instrumento experimental sin validacion psicometrica formal. Los resultados dependen de la autopercepcion en el momento de responder, pueden variar con el tiempo y no deben usarse como unico criterio para decisiones laborales.',
            v_disclaimer, true)
    RETURNING id INTO v_version;

    INSERT INTO psychometric_scales (version_id, code, scale_type, min_value, max_value, labels)
    VALUES (v_version, 'LIKERT5', 'likert5', 1, 5,
            '{"1":"Totalmente en desacuerdo","2":"En desacuerdo","3":"Neutral","4":"De acuerdo","5":"Totalmente de acuerdo"}'::jsonb)
    RETURNING id INTO v_scale;

    INSERT INTO psychometric_dimensions (version_id, code, name, description, construct_definition, display_order) VALUES
        (v_version, 'TEAMWORK',        'Trabajo en equipo',                 'Preferencia por colaborar y coordinarse con otras personas.',
         'Grado en que la persona reporta disfrutar y buscar la colaboracion para objetivos comunes.', 1),
        (v_version, 'AUTONOMY',        'Autonomia',                         'Comodidad al trabajar y decidir con independencia.',
         'Grado en que la persona reporta organizar su trabajo y tomar decisiones sin supervision constante.', 2),
        (v_version, 'ORGANIZATION',    'Organizacion',                      'Planificacion y seguimiento de tareas.',
         'Grado en que la persona reporta planificar, priorizar y dar seguimiento a sus pendientes.', 3),
        (v_version, 'LEARNING',        'Orientacion al aprendizaje',        'Interes por aprender y mejorar de forma continua.',
         'Grado en que la persona reporta buscar nuevos conocimientos y aprender de los errores.', 4),
        (v_version, 'STRUCTURE',       'Preferencia por estructura',        'Preferencia por procesos y responsabilidades definidos.',
         'Grado en que la persona reporta trabajar mejor con reglas, procesos y roles claros.', 5),
        (v_version, 'PROBLEM_SOLVING', 'Resolucion de problemas',           'Enfoque analitico ante problemas.',
         'Grado en que la persona reporta descomponer problemas y evaluar alternativas.', 6),
        (v_version, 'COMMUNICATION',   'Comunicacion',                      'Facilidad para expresar ideas e informar avances.',
         'Grado en que la persona reporta comunicar ideas, avances y obstaculos con claridad.', 7),
        (v_version, 'ADAPTABILITY',    'Adaptacion a escenarios laborales', 'Ajuste ante cambios y situaciones nuevas.',
         'Grado en que la persona reporta mantener su desempeno ante cambios de prioridades o contexto.', 8);

    FOR r IN
        SELECT * FROM (VALUES
            ('TEAMWORK',        'Disfruto coordinar tareas con otras personas para alcanzar un objetivo comun.', false),
            ('TEAMWORK',        'Cuando un companero tiene dificultades, suelo ofrecer mi apoyo.', false),
            ('TEAMWORK',        'Prefiero evitar las tareas que dependen del trabajo de otras personas.', true),
            ('AUTONOMY',        'Me resulta comodo tomar decisiones sin esperar instrucciones detalladas.', false),
            ('AUTONOMY',        'Puedo organizar mi trabajo diario sin supervision constante.', false),
            ('AUTONOMY',        'Necesito confirmacion frecuente antes de avanzar en una tarea.', true),
            ('ORGANIZATION',    'Suelo planificar mis tareas antes de comenzarlas.', false),
            ('ORGANIZATION',    'Mantengo un registro de mis pendientes y fechas de entrega.', false),
            ('ORGANIZATION',    'Con frecuencia dejo tareas importantes para el ultimo momento.', true),
            ('LEARNING',        'Busco activamente aprender nuevas herramientas o tecnologias.', false),
            ('LEARNING',        'Veo los errores como oportunidades para mejorar.', false),
            ('LEARNING',        'Prefiero seguir usando lo que ya conozco antes que aprender algo nuevo.', true),
            ('STRUCTURE',       'Trabajo mejor cuando los procesos y responsabilidades estan claramente definidos.', false),
            ('STRUCTURE',       'Me agrada contar con procedimientos establecidos para resolver tareas.', false),
            ('STRUCTURE',       'Disfruto trabajar en entornos con reglas poco definidas.', true),
            ('PROBLEM_SOLVING', 'Ante un problema complejo, lo divido en partes mas pequenas.', false),
            ('PROBLEM_SOLVING', 'Me gusta analizar diferentes alternativas antes de elegir una solucion.', false),
            ('PROBLEM_SOLVING', 'Cuando un problema es dificil, suelo abandonarlo rapidamente.', true),
            ('COMMUNICATION',   'Me resulta sencillo explicar ideas tecnicas a personas de otras areas.', false),
            ('COMMUNICATION',   'Suelo comunicar a tiempo los avances y los obstaculos de mi trabajo.', false),
            ('COMMUNICATION',   'Evito expresar mi opinion en reuniones de trabajo.', true),
            ('ADAPTABILITY',    'Me adapto con facilidad cuando cambian las prioridades de un proyecto.', false),
            ('ADAPTABILITY',    'Puedo mantener mi desempeno en situaciones nuevas o inesperadas.', false),
            ('ADAPTABILITY',    'Los cambios repentinos en el trabajo me cuestan mucho.', true)
        ) AS q(dim_code, stem, reverse_keyed)
    LOOP
        v_order := v_order + 1;
        INSERT INTO assessment_questions (version_id, dimension_id, scale_id, question_type, stem,
                                          reverse_keyed, display_order)
        SELECT v_version, d.id, v_scale, 'likert', r.stem, r.reverse_keyed, v_order
          FROM psychometric_dimensions d
         WHERE d.version_id = v_version AND d.code = r.dim_code;
    END LOOP;

    INSERT INTO assessment_questions (version_id, scale_id, question_type, stem, display_order,
                                      is_attention_check, expected_value)
    VALUES (v_version, v_scale, 'likert',
            'Para confirmar que lees con atencion, selecciona la opcion "De acuerdo" en esta afirmacion.',
            v_order + 1, true, 4);

    INSERT INTO scoring_rules (version_id, dimension_id, method, params)
    SELECT v_version, d.id, 'mean',
           '{"reverse_formula":"(min+max)-value","normalize":"(mean-min)/(max-min)*100","min_answered_ratio":1.0}'::jsonb
      FROM psychometric_dimensions d WHERE d.version_id = v_version;

    INSERT INTO interpretation_rules (version_id, dimension_id, min_score, max_score, band, text_template, recommendations)
    SELECT v_version, d.id, b.min_score, b.max_score, b.band,
           format('Las respuestas muestran una tendencia %s hacia %s dentro de este instrumento.', b.label, lower(d.name)),
           b.recs
      FROM psychometric_dimensions d
     CROSS JOIN (VALUES
        (0.00,  39.99, 'low',      'baja',
         '["Explorar actividades que permitan practicar esta dimension en contextos de bajo riesgo.","Contrastar este resultado con experiencias reales de trabajo o estudio."]'::jsonb),
        (40.00, 69.99, 'moderate', 'moderada',
         '["Identificar situaciones concretas donde esta dimension aparece con mas fuerza.","Considerar este resultado como punto de partida para la reflexion profesional."]'::jsonb),
        (70.00, 100.00,'high',     'elevada',
         '["Buscar roles o proyectos donde esta tendencia pueda aprovecharse.","Mantener equilibrio con otras dimensiones relevantes para el puesto."]'::jsonb)
     ) AS b(min_score, max_score, band, label, recs)
     WHERE d.version_id = v_version;

    UPDATE assessment_versions SET status = 'published' WHERE id = v_version;

    -- =========================================================================
    -- 2. Evaluacion tecnica: fundamentos de JavaScript
    -- =========================================================================
    SELECT id INTO v_skill_js FROM skills WHERE slug = 'javascript';

    INSERT INTO assessments (type_id, code, title, description, is_experimental, license_type, status)
    SELECT id, 'AURA-TECH-JS-BASIC', 'Fundamentos de JavaScript',
           'Evaluacion tecnica breve de conceptos basicos de JavaScript.', false, 'original', 'published'
      FROM assessment_types WHERE code = 'technical'
    RETURNING id INTO v_assessment;

    INSERT INTO assessment_versions (assessment_id, version_no, status, time_limit_seconds, instructions,
                                     limitations_text, randomize_questions)
    VALUES (v_assessment, 1, 'draft', 600,
            'Selecciona la respuesta correcta para cada pregunta.',
            'Evaluacion breve de conocimientos basicos; no mide la experiencia practica completa.', true)
    RETURNING id INTO v_version;

    v_order := 0;
    FOR r IN
        SELECT * FROM (VALUES
            ('Que devuelve la expresion typeof null en JavaScript?',
             ARRAY['"object"', '"null"', '"undefined"', '"number"'], 1,
             'Por una decision historica del lenguaje, typeof null devuelve "object".', 2),
            ('Que metodo de Array crea un nuevo arreglo con el resultado de aplicar una funcion a cada elemento?',
             ARRAY['forEach', 'map', 'some', 'find'], 2,
             'map devuelve un nuevo arreglo con los valores transformados; forEach no devuelve un arreglo.', 1),
            ('Cual es la diferencia principal entre let y var?',
             ARRAY['let tiene alcance de bloque y var tiene alcance de funcion',
                   'var tiene alcance de bloque y let tiene alcance de funcion',
                   'No existe diferencia',
                   'let solo puede usarse dentro de clases'], 1,
             'let respeta el alcance de bloque; var se limita a la funcion contenedora.', 2),
            ('Que imprime console.log(0.1 + 0.2 === 0.3)?',
             ARRAY['true', 'false', 'undefined', 'Lanza un error'], 2,
             'Por la representacion en punto flotante, 0.1 + 0.2 es 0.30000000000000004.', 3)
        ) AS q(stem, opts, correct_idx, explanation, difficulty)
    LOOP
        v_order := v_order + 1;
        INSERT INTO assessment_questions (version_id, skill_id, question_type, stem, explanation,
                                          difficulty, display_order)
        VALUES (v_version, v_skill_js, 'multiple_choice', r.stem, r.explanation, r.difficulty, v_order)
        RETURNING id INTO v_question;

        INSERT INTO assessment_options (question_id, label, is_correct, display_order)
        SELECT v_question, o.label, (o.idx = r.correct_idx), o.idx
          FROM unnest(r.opts) WITH ORDINALITY AS o(label, idx);
    END LOOP;

    INSERT INTO scoring_rules (version_id, dimension_id, method, params)
    VALUES (v_version, NULL, 'correct_count', '{"normalize":"correct/total*100"}'::jsonb);

    INSERT INTO interpretation_rules (version_id, dimension_id, min_score, max_score, band, text_template, recommendations) VALUES
        (v_version, NULL, 0.00,  49.99, 'low',      'El resultado sugiere reforzar los fundamentos de JavaScript evaluados.',
         '["Repasar tipos de datos, alcance de variables y metodos de arreglos."]'::jsonb),
        (v_version, NULL, 50.00, 79.99, 'moderate', 'El resultado muestra un dominio parcial de los fundamentos evaluados.',
         '["Practicar con ejercicios sobre los temas de las preguntas falladas."]'::jsonb),
        (v_version, NULL, 80.00, 100.00,'high',     'El resultado muestra un buen dominio de los fundamentos evaluados.',
         '["Avanzar hacia temas intermedios: asincronia, closures y TypeScript."]'::jsonb);

    UPDATE assessment_versions SET status = 'published' WHERE id = v_version;

    -- =========================================================================
    -- 3. Evaluacion situacional con rubrica definida
    -- =========================================================================
    INSERT INTO assessments (type_id, code, title, description, is_experimental, license_type, status)
    SELECT id, 'AURA-SJT-WORK-01', 'Escenarios de trabajo en proyectos de software',
           'Escenarios laborales evaluados con una rubrica previamente definida. No se realizan inferencias psicologicas.',
           true, 'original', 'published'
      FROM assessment_types WHERE code = 'situational'
    RETURNING id INTO v_assessment;

    INSERT INTO assessment_versions (assessment_id, version_no, status, time_limit_seconds, instructions,
                                     limitations_text)
    VALUES (v_assessment, 1, 'draft', 900,
            'Lee cada escenario y elige la accion que tomarias.',
            'La rubrica refleja buenas practicas generales de trabajo en equipo de software; distintos contextos pueden justificar otras acciones.')
    RETURNING id INTO v_version;

    INSERT INTO assessment_questions (version_id, question_type, stem, context, display_order)
    VALUES (v_version, 'situational',
            'Un proyecto tiene una fecha de entrega cercana y existen errores importantes. Que accion tomarias?',
            '{"area":"priorizacion"}'::jsonb, 1)
    RETURNING id INTO v_question;

    INSERT INTO assessment_options (question_id, label, rubric_score, rubric_rationale, display_order) VALUES
        (v_question, 'Informar al equipo y al responsable, priorizar los errores criticos y acordar el alcance de la entrega.', 3,
         'Comunica el riesgo, prioriza por impacto y busca un acuerdo explicito.', 1),
        (v_question, 'Corregir todos los errores por cuenta propia aunque se retrase la entrega sin avisar.', 1,
         'Muestra compromiso con la calidad, pero omite la comunicacion del riesgo.', 2),
        (v_question, 'Entregar a tiempo sin mencionar los errores.', 0,
         'Oculta informacion relevante y traslada el riesgo al usuario final.', 3),
        (v_question, 'Pedir mas tiempo sin analizar cuales errores son criticos.', 1,
         'Comunica, pero sin analisis de prioridades que respalde la solicitud.', 4);

    INSERT INTO assessment_questions (version_id, question_type, stem, context, display_order)
    VALUES (v_version, 'situational',
            'Durante una revision de codigo, un companero senala un problema en tu solucion con el que no estas de acuerdo. Que harias?',
            '{"area":"colaboracion"}'::jsonb, 2)
    RETURNING id INTO v_question;

    INSERT INTO assessment_options (question_id, label, rubric_score, rubric_rationale, display_order) VALUES
        (v_question, 'Pedir que explique su punto, compartir mis argumentos con evidencia y acordar una solucion.', 3,
         'Dialogo basado en evidencia orientado a la mejor solucion.', 1),
        (v_question, 'Aceptar el cambio sin discutir para evitar conflictos.', 1,
         'Evita el conflicto, pero pierde la oportunidad de aportar informacion relevante.', 2),
        (v_question, 'Ignorar el comentario y fusionar el codigo.', 0,
         'Omite el proceso acordado de revision.', 3),
        (v_question, 'Escalar de inmediato al lider tecnico sin hablar antes con el companero.', 1,
         'Busca resolver, pero sin intentar primero el dialogo directo.', 4);

    INSERT INTO scoring_rules (version_id, dimension_id, method, params)
    VALUES (v_version, NULL, 'rubric', '{"max_per_question":3,"normalize":"sum/max_total*100"}'::jsonb);

    INSERT INTO interpretation_rules (version_id, dimension_id, min_score, max_score, band, text_template, recommendations) VALUES
        (v_version, NULL, 0.00,  49.99, 'low',      'Las respuestas se alejan de varias practicas recomendadas por la rubrica.',
         '["Revisar practicas de comunicacion de riesgos y revision de codigo."]'::jsonb),
        (v_version, NULL, 50.00, 79.99, 'moderate', 'Las respuestas coinciden parcialmente con las practicas recomendadas por la rubrica.',
         '["Analizar la justificacion de cada opcion de la rubrica."]'::jsonb),
        (v_version, NULL, 80.00, 100.00,'high',     'Las respuestas coinciden con las practicas recomendadas por la rubrica.',
         '["Aplicar estas practicas en proyectos colaborativos reales."]'::jsonb);

    UPDATE assessment_versions SET status = 'published' WHERE id = v_version;
END;
$$;

COMMIT;

RESET ROLE;
