> Versión de portafolio: se han omitido credenciales, identificadores de proyectos Supabase, archivos generados y datos operativos. Configure sus propias variables en `src/environments/environment.ts` y `environment.prod.ts` antes de ejecutar la aplicación. Este repositorio presenta un proyecto académico y no debe conectarse a sistemas con datos reales.

# Clinica Versalles - Gestion de Citas

Aplicacion academica desarrollada con Ionic Angular y Supabase para apoyar la gestion de citas medicas de la Clinica Versalles en Comas.

El proyecto responde a una problematica de gestion manual: registros en cuadernos, llamadas telefonicas, perdida de informacion, duplicidad de citas y poca visibilidad de horarios disponibles.

## Funcionalidades principales

- Autenticacion de usuarios con Supabase Auth.
- Control de acceso por roles: administrador, recepcionista, medico y paciente.
- Gestion de pacientes.
- Gestion de medicos.
- Agendamiento, confirmacion, atencion y cancelacion de citas.
- Registro de historial clinico por medico o administrador.
- Registro y anulacion de pagos.
- Dashboard con resumen operativo.
- Notificaciones internas.
- Chat IA como modulo experimental con contexto filtrado por rol.

## Tecnologias

- Ionic Angular
- Angular standalone components
- Supabase Auth
- Supabase Database
- Supabase Row Level Security (RLS)
- Supabase Edge Functions
- TypeScript

## Arquitectura

El frontend se organiza por funcionalidades:

```text
src/app/
  core/
    auth/             autenticacion, sesion y guards
    supabase/         cliente e infraestructura de Supabase
  features/
    citas/
    configuracion/
    historial/
    medicos/
    notificaciones/
    pacientes/
    pagos/
    reportes/
  shared/
    data-access/      utilidades de acceso a datos
    interfaces/       archivos barril de compatibilidad
    models/           modelos realmente compartidos
    ui/               servicios reutilizables de interfaz
    validators/       validaciones comunes
```

Cada funcionalidad puede contener `pages`, `data-access` y `models`. Los alias `@core`, `@features` y `@shared` evitan imports relativos extensos.

## Instalacion

```bash
npm install
npm start
```

Para generar una version compilada:

```bash
npm run build
```

Para revisar reglas de estilo:

```bash
npm run lint
```

## Configuracion de Supabase

El cliente de Supabase se configura en:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

La aplicacion usa `supabaseUrl` y `supabaseAnonKey`.

La `anon key` de Supabase esta pensada para usarse desde el frontend. No debe confundirse con la `service_role key`. La seguridad real de las tablas depende de las politicas RLS definidas en `schema.sql`.

No se debe exponer la `SUPABASE_SERVICE_ROLE_KEY` en Angular, GitHub ni archivos publicos. Esa clave solo debe configurarse como variable de entorno en Supabase Edge Functions.

## Base de datos y seguridad

El archivo `schema.sql` contiene:

- Creacion de tablas principales.
- Restricciones de datos.
- Indices.
- Triggers.
- Funciones auxiliares de rol.
- Politicas RLS por rol.

Antes de probar la aplicacion, se debe aplicar `schema.sql` en el proyecto Supabase correspondiente.

Si la base ya fue creada, aplica tambien las migraciones pendientes de `supabase/migrations`. `20260624100000_security_hardening.sql` revoca la ejecucion publica de funciones internas y conserva solo los permisos requeridos por RLS.

Roles considerados:

- `admin`: acceso administrativo general.
- `recepcionista`: gestion operativa de pacientes, citas y pagos.
- `medico`: consulta agenda y registra atenciones/historial.
- `paciente`: agenda y consulta sus citas/pagos permitidos.

## Edge Functions

El proyecto incluye:

- `admin-create-user`: prepara y crea usuarios administrativos mediante un alta atómica.
- `register-patient`: registra pacientes sin exponer información clínica en Auth.
- `chat-ai`: responde consultas usando contexto limitado por rol.

El modulo de IA minimiza datos enviados al proveedor y omite DNI y telefono. Para una demostracion sin transferencia a terceros se recomienda `AI_PROVIDER=demo`.

Variables recomendadas para Edge Functions:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=demo
OPENAI_API_KEY=
OPENAI_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
```

Para una entrega academica, `AI_PROVIDER=demo` permite mostrar el flujo del chat sin depender de servicios externos.

`Access-Control-Allow-Origin: *` se conserva para facilitar la demostracion web y Capacitor. Si la aplicacion se publica, debe reemplazarse por una lista de origenes permitidos.

## Alcance academico

Este proyecto no esta orientado a produccion. Es una solucion academica para demostrar digitalizacion de citas, centralizacion de informacion, control por roles y mejora del flujo administrativo.

No incluye facturacion electronica real, integracion SUNAT, modo offline ni interoperabilidad con sistemas clinicos externos.

Si se agrega facturacion, se recomienda implementarla como comprobante interno simple, no como facturacion electronica oficial.

## Verificaciones recomendadas antes de entregar

```bash
npm run build
npm run lint
```

Tambien se recomienda probar manualmente:

- Login con cada rol.
- Registro de paciente.
- Registro de medico.
- Creacion de cita.
- Prevencion de cita duplicada para un mismo medico, fecha y hora.
- Confirmacion y cancelacion de cita.
- Registro de historial clinico.
- Registro y anulacion de pago.
- Acceso restringido por rol.
- Funcionamiento de Edge Functions si estan desplegadas.

Para comprobar dependencias de produccion:

```bash
npm audit --omit=dev
```

Los guards protegen la navegacion, pero no sustituyen RLS. Un usuario puede manipular el frontend; las operaciones sensibles deben permanecer protegidas en Supabase.
