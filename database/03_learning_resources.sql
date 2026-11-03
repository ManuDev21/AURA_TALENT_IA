-- =============================================================================
-- AURA TALENT AI - Catalogo inicial de recursos de aprendizaje (Fase 7)
-- Recursos gratuitos y reconocidos (documentacion oficial y plataformas abiertas).
-- Idempotente: puede ejecutarse varias veces sin duplicar filas.
-- =============================================================================

INSERT INTO learning_resources (title, provider, url, description, level, duration_hours, cost_type, language_code)
SELECT r.title, r.provider, r.url, r.description, r.level, r.hours, 'free', r.lang
  FROM (VALUES
    ('Aprende desarrollo web', 'MDN Web Docs', 'https://developer.mozilla.org/es/docs/Learn',
     'Ruta estructurada de HTML, CSS y JavaScript desde cero.', 'beginner', 40.0, 'es'),
    ('El Tutorial de JavaScript Moderno', 'javascript.info', 'https://es.javascript.info/',
     'JavaScript desde lo basico hasta temas avanzados, con ejercicios.', 'intermediate', 50.0, 'es'),
    ('Aprende React', 'react.dev', 'https://react.dev/learn',
     'Documentacion oficial de React: componentes, estado, efectos y patrones.', 'intermediate', 20.0, 'en'),
    ('TypeScript Handbook', 'typescriptlang.org', 'https://www.typescriptlang.org/docs/handbook/intro.html',
     'Guia oficial de TypeScript: tipos, genericos y configuracion.', 'intermediate', 15.0, 'en'),
    ('Tutorial de Python', 'Python Software Foundation', 'https://docs.python.org/es/3/tutorial/',
     'Tutorial oficial de Python en espanol.', 'beginner', 20.0, 'es'),
    ('Tutorial de FastAPI', 'FastAPI', 'https://fastapi.tiangolo.com/es/tutorial/',
     'Construccion de APIs con FastAPI paso a paso.', 'intermediate', 15.0, 'es'),
    ('Learn Node.js', 'Node.js', 'https://nodejs.org/en/learn',
     'Guia oficial de Node.js: modulos, asincronia y servidores.', 'beginner', 12.0, 'en'),
    ('SQLBolt', 'SQLBolt', 'https://sqlbolt.com/',
     'Lecciones interactivas de SQL con ejercicios en el navegador.', 'beginner', 6.0, 'en'),
    ('Tutorial de PostgreSQL', 'PostgreSQL', 'https://www.postgresql.org/docs/current/tutorial.html',
     'Tutorial oficial: conceptos, consultas y funciones avanzadas.', 'intermediate', 8.0, 'en'),
    ('Kaggle Learn', 'Kaggle', 'https://www.kaggle.com/learn',
     'Microcursos practicos de Python, Pandas, visualizacion y Machine Learning.', 'beginner', 30.0, 'en'),
    ('Primeros pasos con pandas', 'pandas', 'https://pandas.pydata.org/docs/getting_started/index.html',
     'Guia oficial para analizar datos tabulares con pandas.', 'beginner', 8.0, 'en'),
    ('Tutoriales de scikit-learn', 'scikit-learn', 'https://scikit-learn.org/stable/tutorial/index.html',
     'Aprendizaje automatico clasico con scikit-learn.', 'intermediate', 15.0, 'en'),
    ('Pro Git', 'git-scm.com', 'https://git-scm.com/book/es/v2',
     'Libro oficial de Git en espanol.', 'beginner', 12.0, 'es'),
    ('Docker: Get started', 'Docker', 'https://docs.docker.com/get-started/',
     'Contenedores, imagenes y composicion de servicios.', 'beginner', 6.0, 'en'),
    ('Tutoriales de Kubernetes', 'Kubernetes', 'https://kubernetes.io/docs/tutorials/',
     'Tutoriales oficiales de despliegue y operacion en Kubernetes.', 'advanced', 12.0, 'en'),
    ('Curriculo de freeCodeCamp', 'freeCodeCamp', 'https://www.freecodecamp.org/espanol/learn',
     'Certificaciones gratuitas de diseno web, JavaScript, APIs y datos.', 'beginner', 300.0, 'es')
  ) AS r(title, provider, url, description, level, hours, lang)
 WHERE NOT EXISTS (SELECT 1 FROM learning_resources lr WHERE lr.url = r.url);

INSERT INTO learning_resource_skills (resource_id, skill_id)
SELECT lr.id, s.id
  FROM (VALUES
    ('https://developer.mozilla.org/es/docs/Learn', 'html'),
    ('https://developer.mozilla.org/es/docs/Learn', 'css'),
    ('https://developer.mozilla.org/es/docs/Learn', 'javascript'),
    ('https://es.javascript.info/', 'javascript'),
    ('https://react.dev/learn', 'react'),
    ('https://www.typescriptlang.org/docs/handbook/intro.html', 'typescript'),
    ('https://docs.python.org/es/3/tutorial/', 'python'),
    ('https://fastapi.tiangolo.com/es/tutorial/', 'fastapi'),
    ('https://fastapi.tiangolo.com/es/tutorial/', 'rest-apis'),
    ('https://nodejs.org/en/learn', 'nodejs'),
    ('https://sqlbolt.com/', 'sql'),
    ('https://www.postgresql.org/docs/current/tutorial.html', 'postgresql'),
    ('https://www.postgresql.org/docs/current/tutorial.html', 'sql'),
    ('https://www.kaggle.com/learn', 'machine-learning'),
    ('https://www.kaggle.com/learn', 'data-analysis'),
    ('https://www.kaggle.com/learn', 'pandas'),
    ('https://pandas.pydata.org/docs/getting_started/index.html', 'pandas'),
    ('https://pandas.pydata.org/docs/getting_started/index.html', 'data-analysis'),
    ('https://scikit-learn.org/stable/tutorial/index.html', 'scikit-learn'),
    ('https://scikit-learn.org/stable/tutorial/index.html', 'machine-learning'),
    ('https://git-scm.com/book/es/v2', 'git'),
    ('https://docs.docker.com/get-started/', 'docker'),
    ('https://kubernetes.io/docs/tutorials/', 'kubernetes'),
    ('https://www.freecodecamp.org/espanol/learn', 'javascript'),
    ('https://www.freecodecamp.org/espanol/learn', 'css'),
    ('https://www.freecodecamp.org/espanol/learn', 'rest-apis')
  ) AS m(url, slug)
  JOIN learning_resources lr ON lr.url = m.url
  JOIN skills s ON s.slug = m.slug
ON CONFLICT DO NOTHING;
