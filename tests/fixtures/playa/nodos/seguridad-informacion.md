---
id: seguridad-informacion
tipo: proceso
titulo: Seguridad de la información
formato: texto
publicacion:
  pagina: false
  chat: true
pagina_padre: /metodologia#seguridad
respuesta_corta: >-
  En Playa SPA la seguridad se define desde el diseño de cada proyecto. Definimos accesos,
  trazabilidad y protección de datos desde el diseño, con ISO 27001 y la Ley 21.719 como
  marcos de referencia, y mantenemos monitoreo continuo de seguridad en la infraestructura
  cloud donde opera la solución.
tarjeta:
  eyebrow: Seguridad
preguntas:
  - ¿Cómo protegen la información?
  - ¿Tienen certificaciones?
  - ¿Están certificados en ISO 27001?
  - ¿Cumplen la Ley 21.719?
  - ¿Cómo manejan los accesos al sistema?
  - ¿Monitorean la seguridad?
  - ¿Qué pasa si hay un incidente de seguridad?
  - ¿Mis datos están seguros con ustedes?
keywords: [seguridad, iso 27001, ley 21719, proteccion de datos, accesos, trazabilidad, monitoreo, guardduty]
sinonimos: [ciberseguridad, datos personales, certificacion, cumplimiento, privacidad]
aristas:
  - { a: propiedad-datos, tipo: profundiza, peso: 0.6 }
  - { a: infraestructura-cloud, tipo: profundiza, peso: 0.5 }
  - { a: gobierno-ti, tipo: profundiza, peso: 0.5 }
fuente: BR p3 (03 Seguridad), BR p4 (ISO 27001, Ley 21.719)
estado: aprobado
fecha_actualizacion: 2026-10-27
---
ISO 27001 orienta la seguridad de la información y la Ley 21.719 la protección de datos personales. Ambas se usan como marcos de referencia en el diseño de cada solución. En la infraestructura en AWS usamos servicios como GuardDuty y CloudWatch para el monitoreo.