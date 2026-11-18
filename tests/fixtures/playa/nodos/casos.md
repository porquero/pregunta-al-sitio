---
id: casos
tipo: caso
titulo: Casos de éxito, implementaciones en operación
ruta: /casos
formato: tarjeta
variante: caso
respuesta_corta: >-
  Playa SPA tiene implementaciones en operación: un CRM SaaS para automotoras, un ERP a medida
  para obras hidráulicas, CRM con soporte continuo, gestión de proyectos con informes automatizados y digitalización de contratos,
  proveedores y atención. Además operamos en piloto Wotel, un agente de reservas por WhatsApp.
  Abajo listamos las industrias que atendemos.
tarjeta:
  eyebrow: Casos de éxito
  enfasis: en operación
preguntas:
  - ¿Tienen casos de éxito?
  - ¿Con qué clientes han trabajado?
  - ¿Tienen referencias?
  - ¿Qué proyectos han hecho?
  - ¿Qué han implementado con EspoCRM?
  - ¿Tienen experiencia en el rubro automotriz?
  - ¿Puedo hablar con un cliente de ustedes?
  - ¿Tienen proyectos en operación?
  - ¿Han desarrollado un ERP a medida?
keywords: [casos, clientes, referencias, proyectos, portafolio, experiencia, implementaciones, erp, hydrofocus]
sinonimos: [casos de exito, trabajos, portafolio, clientes actuales, referencias]
aristas:
  - { a: crm-sistemas-negocio, tipo: prueba, peso: 0.9 }
  - { a: digitalizacion, tipo: prueba, peso: 0.8 }
  - { a: gobierno-ti, tipo: prueba, peso: 0.7 }
  - { a: agente-conversacional, tipo: prueba, peso: 0.7 }
  - { a: autofocus, tipo: prueba, peso: 0.6 }
  - { a: wotel, tipo: prueba, peso: 0.6 }
  - { a: industrias, tipo: profundiza, peso: 0.7 }
seo:
  description: >-
    Casos de Playa SPA en operación: CRM para automotoras, soporte continuo de EspoCRM,
    informes automatizados, reservas por WhatsApp y contratos digitales.
fuente: BR p5 (pendiente de aprobación 2.2 y 2.3; sin industria por proyecto, G1), A2, D5
estado: aprobado
fecha_actualizacion: 2026-10-27
---
## CRM SaaS para automotoras {#autofocus}

**Autofocus.** CRM B2B diseñado y operado por Playa SPA para automotoras chilenas. Incluye personalización avanzada, integración con Mercado Libre y APIs externas, automatización de comunicaciones con clientes, un motor de prospección que carga leads al CRM por API y Autobot, agente IA de ventas para leads y análisis de datos para el equipo de trabajo.

## ERP vertical para obras hidráulicas {#hydrofocus}

**Hydrofocus.** Plataforma que Playa SPA desarrolló sobre EspoCRM para Hydroproject, empresa que diseña y ejecuta proyectos hidráulicos y de tratamiento de agua en Chile. Integra obras, calidad, recursos humanos, asistencia, compras, flota e inventario en un solo sistema, para coordinar equipos, contratos, protocolos de calidad y compras repartidos en varias obras.

## PMO y reporting {#pmo}

**Gestión de proyectos con trazabilidad.** Portafolio de tareas en Kanboard con registro histórico e informe mensual de avance generado de forma automatizada a partir del tablero, listo para su envío.

## Agente de reservas por WhatsApp {#wotel}

**Wotel, en fase piloto.** Asistente conversacional que consulta disponibilidad y gestiona reservas de hoteles, hostales y cabañas conectado a EspoCRM. Construido en n8n con WhatsApp Business API, la pasarela de pago Flow y la API de Claude, con arquitectura multicliente.

## Digitalización de procesos {#digitalizacion}

**Contratos, proveedores y atención.** Sistema digital de contratos, anexos y finiquitos; gestión de proveedores, órdenes de trabajo y rendiciones; control digital de protocolos técnicos; y chatbot de inscripción y atención por WhatsApp.