# RentFlow — Master Prompts for Claude Code
> Copy each prompt in sequence. Do not skip phases. Each prompt builds on the previous one.

---

## ANTES DE EMPEZAR — Setup de cuentas (hacé esto vos)

Antes de darle el Prompt 1 a Claude Code, necesitás tener estas cuentas creadas y las API keys a mano:

| Servicio | Para qué | URL | Costo |
|----------|----------|-----|-------|
| Supabase | DB + Auth + Storage | supabase.com | Gratis tier |
| Railway | Hosting del backend | railway.app | ~$5/mes |
| Vercel | Hosting del frontend | vercel.com | Gratis tier |
| Resend | Emails transaccionales | resend.com | Gratis hasta 3k/mes |
| Twilio | WhatsApp + SMS | twilio.com | Pay per use |
| Anthropic | Claude API (OCR + agente) | console.anthropic.com | Pay per use |
| Cloudflare | Dominio (opcional) | cloudflare.com | ~£10/año |

Variables de entorno que vas a necesitar tener listas:
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## PROMPT 1 — Base de datos y autenticación

```
Sos el arquitecto backend de RentFlow, una aplicación SaaS multi-tenant para gestión de propiedades en alquiler. Tu tarea en este prompt es crear el schema completo de Supabase con Row Level Security, y el sistema de autenticación dual.

---

## Stack
- Supabase (PostgreSQL + Auth + Storage + RLS)
- Node.js 20 + Express para el backend
- TypeScript estricto en todo el proyecto

---

## Estructura del proyecto a crear

```
rentflow/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Entry point Express
│   │   ├── lib/
│   │   │   ├── supabase.ts   # Cliente Supabase (admin + anon)
│   │   │   └── types.ts      # Tipos TypeScript globales
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── properties.ts
│   │   │   ├── tenants.ts
│   │   │   └── payments.ts
│   │   └── middleware/
│   │       └── auth.ts
│   ├── supabase/
│   │   └── migrations/
│   │       └── 001_initial_schema.sql
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── frontend/              # Carpeta vacía por ahora, se llena en Prompt 4
```

---

## Schema de Supabase — 001_initial_schema.sql

Crear las siguientes tablas con exactamente estos campos:

### owners (propietarios)
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- auth_user_id: uuid REFERENCES auth.users(id) ON DELETE CASCADE — clave que conecta con Supabase Auth
- full_name: text NOT NULL
- email: text NOT NULL UNIQUE
- phone: text
- iban: text — cuenta bancaria para recibir pagos
- company_name: text — opcional, para PMs profesionales
- logo_url: text — para personalizar PDFs de recibos
- created_at: timestamptz DEFAULT now()
- updated_at: timestamptz DEFAULT now()

### properties (propiedades)
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- owner_id: uuid REFERENCES owners(id) ON DELETE CASCADE — FK al propietario
- address: text NOT NULL
- city: text NOT NULL
- postal_code: text
- country: text DEFAULT 'ES'
- monthly_rent: numeric(10,2) NOT NULL
- currency: text DEFAULT 'EUR'
- due_day: integer NOT NULL DEFAULT 1 — día del mes en que vence el pago (1-28)
- notes: text — notas internas del propietario
- is_active: boolean DEFAULT true
- created_at: timestamptz DEFAULT now()
- updated_at: timestamptz DEFAULT now()

### tenants (inquilinos)
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- owner_id: uuid REFERENCES owners(id) ON DELETE CASCADE
- property_id: uuid REFERENCES properties(id) ON DELETE SET NULL
- full_name: text NOT NULL
- id_document: text NOT NULL — DNI, cédula o pasaporte (usado como auth de inquilinos)
- email: text
- phone_whatsapp: text — con código de país, ej: +34600000001
- preferred_language: text DEFAULT 'es' — para personalizar mensajes del agente
- lease_start: date NOT NULL
- lease_end: date
- contract_url: text — URL del PDF en Supabase Storage
- is_active: boolean DEFAULT true
- notes: text
- created_at: timestamptz DEFAULT now()
- updated_at: timestamptz DEFAULT now()
- UNIQUE(owner_id, id_document) — un mismo DNI no puede repetirse para el mismo propietario

### payments (pagos)
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- owner_id: uuid REFERENCES owners(id) ON DELETE CASCADE
- property_id: uuid REFERENCES properties(id)
- tenant_id: uuid REFERENCES tenants(id)
- period_month: integer NOT NULL — mes del pago (1-12)
- period_year: integer NOT NULL — año del pago
- amount_expected: numeric(10,2) NOT NULL
- amount_received: numeric(10,2) — se llena cuando se confirma
- due_date: date NOT NULL — fecha exacta de vencimiento
- paid_date: date — fecha en que se efectuó el pago
- status: text NOT NULL DEFAULT 'pending' — valores posibles: 'pending', 'to_verify', 'paid', 'overdue', 'partial'
- payment_method: text — 'transfer', 'cash', 'other'
- receipt_url: text — URL del comprobante subido por el inquilino en Supabase Storage
- receipt_data: jsonb — datos extraídos por OCR del comprobante (monto, fecha, cuenta, etc.)
- verification_note: text — nota del propietario al aprobar/rechazar manualmente
- verified_by: text — 'agent' o 'owner'
- receipt_pdf_url: text — URL del recibo generado automáticamente por RentFlow
- created_at: timestamptz DEFAULT now()
- updated_at: timestamptz DEFAULT now()
- UNIQUE(property_id, tenant_id, period_month, period_year)

### notifications_log (log de comunicaciones del agente)
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- owner_id: uuid REFERENCES owners(id)
- tenant_id: uuid REFERENCES tenants(id)
- payment_id: uuid REFERENCES payments(id)
- channel: text NOT NULL — 'whatsapp', 'email', 'sms', 'call'
- type: text NOT NULL — 'reminder', 'overdue_1', 'overdue_3', 'overdue_7', 'overdue_14', 'payment_confirmed', 'payment_rejected', 'welcome'
- message_body: text — el mensaje exacto enviado
- status: text — 'sent', 'delivered', 'failed'
- external_id: text — ID de Twilio o Resend para tracking
- sent_at: timestamptz DEFAULT now()

### agent_actions_log (log de acciones autónomas del agente)
- id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
- owner_id: uuid REFERENCES owners(id)
- action_type: text NOT NULL — 'payment_auto_verified', 'payment_flagged', 'escalation_triggered', 'report_sent', 'reminder_sent'
- description: text
- metadata: jsonb — datos adicionales de la acción
- created_at: timestamptz DEFAULT now()

---

## Row Level Security — CRÍTICO

Habilitar RLS en todas las tablas y crear estas policies:

Para owners:
- SELECT: auth.uid() = auth_user_id
- UPDATE: auth.uid() = auth_user_id

Para properties, tenants, payments, notifications_log, agent_actions_log:
- SELECT/INSERT/UPDATE/DELETE: owner_id IN (SELECT id FROM owners WHERE auth_user_id = auth.uid())

Esta policy garantiza que un propietario NUNCA pueda ver datos de otro propietario, aunque use la misma DB.

---

## Sistema de autenticación dual

### Auth de propietarios
Usar Supabase Auth nativo con email + password.
Cuando un propietario se registra con Supabase Auth, crear automáticamente su registro en la tabla owners con un trigger de PostgreSQL:

```sql
CREATE OR REPLACE FUNCTION handle_new_owner()
RETURNS trigger AS $$
BEGIN
  INSERT INTO owners (auth_user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_owner();
```

### Auth de inquilinos (sin contraseña)
Los inquilinos NO usan Supabase Auth. Se autentican por DNI/documento de identidad.
El backend expone un endpoint público:
POST /api/tenant/auth
Body: { id_document: string }
Respuesta: si existe, devuelve datos del inquilino + un JWT firmado con el SUPABASE_SERVICE_ROLE_KEY válido por 24 horas que incluye { tenant_id, owner_id, property_id } en el payload.

Este JWT se usa en el header Authorization: Bearer <token> en todas las requests del inquilino.

---

## Backend Express — src/index.ts

Crear servidor Express con:
- cors configurado para aceptar requests del frontend (localhost:3000 en dev, dominio de producción en prod)
- express.json() para parsear bodies
- Helmet.js para headers de seguridad
- Rate limiting: 100 requests por IP por 15 minutos (usar express-rate-limit)
- Rutas montadas en /api/auth, /api/properties, /api/tenants, /api/payments
- Health check en GET /health que devuelve { status: 'ok', timestamp: new Date() }
- Error handler global que captura errores y devuelve { error: message, code: statusCode }

---

## Middleware de autenticación — src/middleware/auth.ts

Crear dos middlewares:
1. requireOwner: verifica que el request tenga un Supabase session token válido de un propietario y adjunta owner_id al request
2. requireTenant: verifica el JWT del inquilino y adjunta tenant_id, owner_id, property_id al request

---

## package.json

Dependencias a incluir:
- express, cors, helmet, express-rate-limit
- @supabase/supabase-js
- jsonwebtoken
- dotenv
- typescript, ts-node, @types/express, @types/node, @types/jsonwebtoken (dev)
- nodemon (dev)

Scripts:
- dev: nodemon src/index.ts
- build: tsc
- start: node dist/index.js

---

## .env.example

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
PORT=4000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

---

## Entregable

Al terminar este prompt, debe existir:
1. El archivo SQL de migración completo y ejecutable en Supabase
2. El servidor Express corriendo en localhost:4000
3. GET /health respondiendo { status: 'ok' }
4. POST /api/tenant/auth funcionando con un DNI de prueba
5. README con instrucciones para ejecutar la migración en Supabase

No avances al siguiente módulo hasta que GET /health y POST /api/tenant/auth estén funcionando y testeados.
```

---

## PROMPT 2 — API REST: propiedades, inquilinos y pagos

```
Continuamos con RentFlow. El backend base ya está funcionando (Express en localhost:4000, Supabase conectado, auth dual implementado). Ahora construís los endpoints REST completos para las tres entidades principales.

Contexto del proyecto: RentFlow es un SaaS de gestión de propiedades con un agente AI que automatiza verificación de pagos y comunicaciones. El backend usa Express + TypeScript + Supabase.

---

## MÓDULO 1 — Rutas de propiedades (src/routes/properties.ts)

Todos los endpoints requieren middleware requireOwner. El owner_id siempre viene del middleware, NUNCA del body del request.

### GET /api/properties
Devuelve todas las propiedades del propietario autenticado.
Para cada propiedad, incluir también:
- Conteo de inquilinos activos (active_tenants_count)
- Estado del mes actual (cuántos pagos paid, pending, overdue)

### GET /api/properties/:id
Propiedad específica con todos sus inquilinos activos y sus estados de pago del mes actual.

### POST /api/properties
Crea nueva propiedad. Validar:
- address y city son requeridos
- monthly_rent debe ser > 0
- due_day debe ser entre 1 y 28
Body permitido: { address, city, postal_code, country, monthly_rent, currency, due_day, notes }
Después de crear la propiedad, crear automáticamente el registro de pago del mes actual para todos los inquilinos activos de esa propiedad (si los hay).

### PATCH /api/properties/:id
Actualización parcial. Solo campos de la tabla properties. Siempre actualizar updated_at.

### DELETE /api/properties/:id
Soft delete: poner is_active = false. Nunca eliminar registros físicamente.

---

## MÓDULO 2 — Rutas de inquilinos (src/routes/tenants.ts)

### GET /api/tenants
Todos los inquilinos del propietario con su propiedad asociada y estado de pago del mes actual.

### GET /api/tenants/:id
Inquilino específico con:
- Datos completos
- Propiedad asociada
- Historial de pagos de los últimos 12 meses
- Conteo de pagos a tiempo vs tardíos

### POST /api/tenants
Crea nuevo inquilino. Validar:
- full_name, id_document, property_id son requeridos
- id_document único para ese owner_id (ya tiene constraint en DB pero manejar el error con mensaje claro)
- lease_start es requerido
- phone_whatsapp si se provee, debe tener formato internacional (+código_país + número)
Body permitido: { full_name, id_document, email, phone_whatsapp, property_id, preferred_language, lease_start, lease_end, notes }

Después de crear el inquilino:
1. Crear el registro de pago del mes actual en la tabla payments con status 'pending'
2. Calcular due_date basándose en el due_day de la propiedad y el mes/año actual

### PATCH /api/tenants/:id
Actualización parcial. Siempre actualizar updated_at.

### DELETE /api/tenants/:id
Soft delete: is_active = false.

### POST /api/tenants/:id/contract
Recibe un PDF en multipart/form-data. Sube el archivo a Supabase Storage en el bucket 'contracts' con path: {owner_id}/{tenant_id}/contract.pdf. Actualiza contract_url en la tabla tenants.
Validar que el archivo sea PDF y no pese más de 10MB.

---

## MÓDULO 3 — Rutas de pagos (src/routes/payments.ts)

### GET /api/payments
Query params opcionales: month (1-12), year, status, property_id, tenant_id
Devuelve pagos filtrados. Por defecto devuelve el mes actual.
Incluir datos del inquilino y propiedad en cada pago (JOIN).

### GET /api/payments/dashboard
Devuelve el resumen para el dashboard del propietario:
```json
{
  "current_month": "Mayo 2026",
  "stats": {
    "total_properties": 3,
    "total_expected": 3350.00,
    "total_received": 1100.00,
    "paid_count": 1,
    "pending_count": 2,
    "overdue_count": 1,
    "to_verify_count": 0
  },
  "payments": [ /* array con todos los pagos del mes con datos de inquilino y propiedad */ ]
}
```

### GET /api/payments/:id
Pago específico con historial de notificaciones asociadas.

### PATCH /api/payments/:id/verify
Endpoint para que el propietario apruebe o rechace manualmente un pago en estado 'to_verify'.
Body: { action: 'approve' | 'reject', note?: string }
Si approve: cambiar status a 'paid', registrar verified_by: 'owner', paid_date: today, guardar note.
Si reject: cambiar status a 'pending', limpiar receipt_url, guardar note como verification_note.
Después de aprobar: encolar notificación al inquilino (por ahora solo log en consola, la integración real viene en Prompt 6).

### GET /api/payments/tenant/:tenant_id
Endpoint público para el inquilino (usa middleware requireTenant).
Devuelve el estado del pago del mes actual y el historial de los últimos 6 meses para ese inquilino.
IMPORTANTE: Este endpoint solo puede devolver datos del tenant_id que viene en el JWT del inquilino.

---

## MÓDULO 4 — Upload de comprobante por inquilino

### POST /api/payments/:payment_id/receipt
Middleware: requireTenant
Recibe imagen/PDF en multipart/form-data (campo 'receipt').
Validar: solo acepta image/jpeg, image/png, image/webp, application/pdf. Máximo 5MB.

Flujo:
1. Verificar que el payment_id pertenece al tenant autenticado (comparar tenant_id del payment con el del JWT)
2. Subir archivo a Supabase Storage bucket 'receipts' con path: {owner_id}/{payment_id}/receipt_{timestamp}.{ext}
3. Actualizar payments: receipt_url, status = 'to_verify'
4. Responder inmediatamente con { success: true, message: 'Comprobante recibido. Será verificado en breve.' }
5. En background (setImmediate o process.nextTick): llamar a la función de verificación AI (placeholder por ahora que solo loguea "TODO: AI verification")

La verificación AI real se implementa en el Prompt 5.

---

## Función helper: createMonthlyPayments

Crear una función utilitaria en src/lib/payments.ts:
```
createMonthlyPayments(ownerId: string, month: number, year: number): Promise<void>
```
Esta función:
1. Obtiene todas las propiedades activas del propietario
2. Para cada propiedad, obtiene todos los inquilinos activos
3. Para cada inquilino, verifica si ya existe un registro de pago para ese mes/año
4. Si no existe, lo crea con status 'pending' y calcula due_date con el due_day de la propiedad
Esta función se usa en el cron job del Prompt 7.

---

## Manejo de errores

Para todos los endpoints, manejar estos casos con los HTTP codes correctos:
- 400: Validación fallida (incluir qué campo falló)
- 401: No autenticado
- 403: Autenticado pero intentando acceder a datos de otro propietario
- 404: Recurso no encontrado
- 409: Conflicto (ej: DNI duplicado)
- 500: Error interno (loguear en consola pero devolver mensaje genérico al cliente)

---

## Entregable

Al terminar este prompt:
1. Todos los endpoints responden correctamente con Postman/curl
2. RLS de Supabase está funcionando (un propietario no puede ver datos de otro)
3. Upload de comprobante sube el archivo a Supabase Storage y cambia el status a 'to_verify'
4. GET /api/payments/dashboard devuelve el resumen correcto
5. Crear un archivo test-api.http o test-api.sh con ejemplos de todas las llamadas para poder testear rápido

No implementar todavía: AI verification, WhatsApp, Email, Cron jobs. Solo dejar placeholders con console.log("TODO").
```

---

## PROMPT 3 — Generación de recibos PDF

```
Continuamos con RentFlow. Backend funcionando con todos los endpoints REST. Ahora implementás la generación automática de recibos PDF cuando se confirma un pago.

---

## Objetivo

Cuando un pago pasa a status 'paid' (ya sea por verificación automática del agente o por aprobación manual del propietario), generar automáticamente un PDF de recibo y subirlo a Supabase Storage. El inquilino recibe el link para descargarlo.

---

## Dependencias a agregar

npm install puppeteer-core @sparticuz/chromium
npm install --save-dev @types/puppeteer

Usar puppeteer-core + @sparticuz/chromium porque es más liviano para producción en Railway.

---

## Crear: src/lib/receipt-generator.ts

Esta función recibe los datos del pago y genera un PDF:

```typescript
interface ReceiptData {
  receiptNumber: string        // formato: RF-{año}-{payment_id últimos 6 chars}
  paymentId: string
  ownerId: string
  ownerName: string
  ownerIban?: string
  ownerLogoUrl?: string
  tenantName: string
  tenantIdDocument: string
  propertyAddress: string
  propertyCity: string
  periodMonth: number
  periodYear: number
  amountReceived: number
  currency: string
  paidDate: string             // formato: DD/MM/YYYY
  paymentMethod: string
  generatedAt: string          // ISO timestamp
}

async function generateReceiptPDF(data: ReceiptData): Promise<Buffer>
```

El PDF debe tener este diseño limpio y profesional:
- Tamaño A4
- Header: logo del propietario (si existe) a la izquierda, "RECIBO DE ALQUILER" en texto grande a la derecha, número de recibo debajo
- Línea separadora
- Sección "PROPIETARIO": nombre, IBAN (si existe)
- Sección "INQUILINO": nombre, documento de identidad
- Sección "PROPIEDAD": dirección completa
- Sección destacada "PAGO": período en formato "Mayo 2026", monto en grande (ej: €1.100,00), método de pago, fecha de pago
- Footer: "Este documento es un comprobante oficial de pago de alquiler generado por RentFlow." + fecha de generación
- Paleta de colores: blanco, gris muy claro (#F8F9FA) para fondos de sección, texto oscuro (#1A1A1A), acento azul (#4F46E5) para el número de recibo y títulos de sección

Implementar el HTML del recibo como template string en TypeScript. Puppeteer renderiza el HTML a PDF.

---

## Crear: src/lib/upload-receipt.ts

Función que:
1. Recibe el Buffer del PDF
2. Lo sube a Supabase Storage bucket 'receipts' con path: {owner_id}/receipts/{payment_id}/recibo_{periodo}.pdf
3. Genera una URL firmada válida por 365 días (usar supabase.storage.from('receipts').createSignedUrl)
4. Devuelve la URL firmada

---

## Integrar en el flujo de pagos

En src/routes/payments.ts, en el endpoint PATCH /api/payments/:id/verify cuando action === 'approve':

1. Cambiar status a 'paid' en DB
2. Llamar a generateReceiptPDF con los datos del pago
3. Llamar a uploadReceipt con el buffer
4. Actualizar payments.receipt_pdf_url con la URL firmada
5. Responder al propietario con los datos actualizados incluyendo receipt_pdf_url

También preparar la función triggerReceiptGeneration(paymentId: string) en src/lib/receipts.ts que encapsula todo el flujo (verificar pago, generar PDF, subir, actualizar DB). Esta función será llamada también desde el agente AI en el Prompt 5.

---

## Crear el bucket en Supabase

Agregar al archivo de migración SQL o como instrucciones separadas:
- Crear bucket 'receipts' como privado (no público)
- Crear bucket 'contracts' como privado
- Crear bucket 'comprobantes' como privado
- Políticas de acceso: solo el owner puede leer/escribir sus archivos (RLS equivalente para Storage usando owner_id en el path)

---

## Entregable

Al terminar este prompt:
1. Llamar a PATCH /api/payments/:id/verify con action: 'approve' genera un PDF y actualiza receipt_pdf_url en DB
2. El PDF se puede descargar desde la URL firmada y tiene el diseño especificado
3. La URL firmada es válida y funciona en el browser
4. Crear un script test-receipt.ts que genere un recibo de prueba con datos hardcodeados y lo guarde en /tmp/test-receipt.pdf para verificar el diseño
```

---

## PROMPT 4 — Frontend React conectado al backend

```
Continuamos con RentFlow. Backend completo funcionando. Ahora construís el frontend React que replica exactamente el diseño de los screenshots y lo conectás a la API real.

---

## Screenshots de referencia (descripción exacta del diseño)

El diseño ya existe y está aprobado. Replicarlo exactamente:

PANTALLA 1 — Role selector:
- Fondo gris muy claro (#F0F2F5)
- Centro de pantalla, columna, logo cuadrado con bordes redondeados en azul/violeta (#4F46E5) con ícono blanco
- Título "Bienvenido a RentFlow" en negro, subtítulo en gris
- Dos cards blancas con bordes redondeados, sombra suave: "Soy Inquilino" con ícono de persona, "Soy Propietario" con ícono de edificio
- Cada card tiene título bold y subtítulo descriptivo en gris

PANTALLA 2 — Auth inquilino:
- Mismo fondo, logo más pequeño
- Flecha "← Volver" arriba izquierda
- Card centrada con input grande para documento de identidad
- Placeholder "Ej: 12345678"
- Botón azul/violeta grande "Continuar"

PANTALLA 3 — Subir comprobante (vista inquilino):
- Header con "Subir Comprobante" y "Hola, {nombre}"
- Card "DETALLE DEL PAGO": propiedad, propietario, badge verde "Estás al día" o badge rojo si hay deuda
- Card "Adjuntar archivo": zona de drag & drop con ícono de upload, "TOCAR PARA SUBIR", formatos aceptados
- Campo de comentario opcional
- Botón "Enviar comprobante" en la parte inferior

PANTALLA 4 — Dashboard propietario:
- Navbar: logo RentFlow + badge "MVP" en el nombre, links Dashboard/Propiedades, avatar con iniciales
- 4 metric cards: Propiedades (número), Pagado (€ + "X inquilinos al día"), Pendiente (número + "Por verificar"), Vencido (número + "Revisión urgente")
- Tabla con columnas: INQUILINO/PROPIEDAD, MONTO/PERÍODO, VENCIMIENTO, ESTADO, ACCIÓN
- Buscador y botón Filtrar arriba de la tabla
- Badges de estado: PAGADO (verde), POR VERIFICAR (amarillo), VENCIDO (rojo)
- Cada fila tiene botón "Ver Detalle"

PANTALLA 5 — Detalle expandible:
- Al hacer click en "Ver Detalle", la fila se expande con dos sub-cards
- Sub-card izquierda "INFORMACIÓN DEL INQUILINO": teléfono, email, período de alquiler, botón subir contrato PDF
- Sub-card derecha "DETALLE DE PROPIEDAD": dirección completa con ícono de pin
- Sección "HISTORIAL DE PAGOS" abajo: lista cronológica con mes/año, badge de estado, monto, método, botón "Recibo"
- Selector de período (Últimos 3 meses, 6 meses, 1 año)

---

## Stack del frontend

- React 18 + TypeScript
- Vite como bundler
- React Router v6 para navegación
- Axios para llamadas a la API
- React Query (TanStack Query) para caché y estado del servidor
- Tailwind CSS para estilos
- Lucide React para íconos
- React Hook Form para formularios
- React Dropzone para el upload de comprobantes

---

## Estructura del proyecto frontend

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx               # Router principal
│   ├── lib/
│   │   ├── api.ts            # Axios instance + interceptors
│   │   ├── auth.ts           # Funciones de auth (propietario + inquilino)
│   │   └── types.ts          # Tipos TypeScript (mismos que el backend)
│   ├── contexts/
│   │   └── AuthContext.tsx   # Context para estado de autenticación
│   ├── pages/
│   │   ├── RoleSelector.tsx          # Pantalla 1
│   │   ├── TenantAuth.tsx            # Pantalla 2
│   │   ├── TenantUpload.tsx          # Pantalla 3
│   │   ├── OwnerDashboard.tsx        # Pantalla 4+5
│   │   └── OwnerLogin.tsx            # Login propietario con Supabase
│   └── components/
│       ├── PaymentRow.tsx            # Fila expandible de la tabla
│       ├── MetricCard.tsx            # Cards de resumen
│       ├── StatusBadge.tsx           # Badges de estado
│       ├── ReceiptUploadZone.tsx     # Zona de drag & drop
│       └── PaymentHistoryList.tsx    # Historial de pagos
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── .env
```

---

## src/lib/api.ts — Configuración de Axios

Crear instancia con:
- baseURL: import.meta.env.VITE_API_URL (default: http://localhost:4000)
- Headers default: Content-Type: application/json
- Interceptor de request: adjuntar token de auth (propietario o inquilino según el que esté activo en localStorage)
- Interceptor de response: si 401, limpiar localStorage y redirigir a "/"

---

## Flujos de navegación

Propietario:
/ → elige "Soy Propietario" → /owner/login → /owner/dashboard

Inquilino:
/ → elige "Soy Inquilino" → /tenant/auth → /tenant/upload

---

## Comportamiento del dashboard

- Al cargar, hacer GET /api/payments/dashboard y mostrar los datos reales
- La tabla debe actualizarse automáticamente cada 30 segundos (useQuery con refetchInterval: 30000)
- El buscador filtra en cliente (no hace fetch extra) por nombre de inquilino o dirección
- "Ver Detalle" expande la fila inline (no navega a otra página), hace GET /api/tenants/:id para cargar datos completos
- Botón "Ver Menos" colapsa el detalle
- Botón "Recibo" en historial abre la receipt_pdf_url en nueva pestaña
- Botón "Exportar" hace GET /api/payments?month=X&year=Y y genera un CSV descargable en el cliente

---

## Flujo de upload del inquilino

1. Inquilino ingresa DNI → POST /api/tenant/auth → guardar JWT en localStorage
2. GET /api/payments/tenant/:tenant_id → mostrar datos del pago actual
3. Inquilino arrastra o selecciona archivo (React Dropzone)
4. POST /api/payments/:payment_id/receipt con FormData
5. Mostrar spinner durante upload
6. Al éxito: mostrar mensaje "✓ Comprobante enviado correctamente. Te avisaremos cuando sea verificado."
7. Si ya está pagado: mostrar badge verde "Estás al día" y no mostrar el formulario de upload

---

## Variables de entorno (.env)

```
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Entregable

Al terminar este prompt:
1. npm run dev en /frontend levanta la app en localhost:3000
2. El role selector navega correctamente a cada flujo
3. Un inquilino puede autenticarse con DNI y subir un comprobante real
4. El dashboard del propietario muestra datos reales de la DB
5. Las filas se expanden mostrando datos reales del inquilino
6. El diseño es pixel-perfect respecto a los screenshots (mismo color #4F46E5, mismo layout, mismos badges)
```

---

## PROMPT 5 — Agente AI: verificación de comprobantes

```
Continuamos con RentFlow. Frontend y backend funcionando con datos reales. Ahora implementás el cerebro del agente: la verificación automática de comprobantes con Claude AI Vision.

---

## Objetivo

Cuando un inquilino sube un comprobante, el agente debe:
1. Extraer los datos del comprobante usando Claude Vision
2. Compararlos contra los datos esperados en la DB
3. Tomar una decisión automática (aprobar / marcar para revisión / rechazar)
4. Actualizar el estado en la DB
5. Notificar al propietario del resultado

---

## Dependencias

npm install @anthropic-ai/sdk

---

## Crear: src/lib/ai-verification.ts

Este es el módulo central del agente. Implementar exactamente esta lógica:

### Función principal: verifyPaymentReceipt

```typescript
interface VerificationResult {
  decision: 'auto_approved' | 'needs_review' | 'auto_rejected'
  confidence: number          // 0-100
  extracted_data: {
    amount?: number
    date?: string
    destination_account?: string
    sender_name?: string
    reference?: string
    raw_text?: string
  }
  match_analysis: {
    amount_match: boolean
    amount_difference?: number
    date_reasonable: boolean   // fecha dentro de los últimos 7 días
    account_match?: boolean
  }
  rejection_reason?: string    // si decision es 'auto_rejected', qué encontró mal
  review_reason?: string       // si decision es 'needs_review', qué necesita verificar el propietario
}

async function verifyPaymentReceipt(
  receiptUrl: string,
  expectedAmount: number,
  expectedDueDate: string,
  ownerIban?: string
): Promise<VerificationResult>
```

### Lógica de la llamada a Claude Vision

Descargar la imagen desde receiptUrl, convertirla a base64, y enviar a Claude con este sistema de prompts:

System prompt:
```
Sos un sistema especializado en verificación de comprobantes de pago de alquiler. Tu única función es extraer datos de comprobantes bancarios y transferencias, y devolver la información en formato JSON estructurado. Siempre respondés SOLO con JSON válido, sin texto adicional, sin markdown, sin explicaciones.
```

User prompt:
```
Analizá este comprobante de pago. Extraé toda la información disponible y devolvé EXACTAMENTE este JSON:

{
  "amount": <número o null si no se puede leer>,
  "currency": "<EUR/USD/GBP o null>",
  "date": "<DD/MM/YYYY o null>",
  "destination_iban": "<IBAN completo o últimos 4 dígitos si están visibles, o null>",
  "sender_name": "<nombre del remitente o null>",
  "reference": "<número de referencia o concepto o null>",
  "document_type": "<transferencia_bancaria/recibo_efectivo/otro/ilegible>",
  "is_readable": <true/false>,
  "confidence_score": <0-100, qué tan confiable es la extracción>
}

Datos esperados para validar:
- Monto esperado: ${expectedAmount} ${currency}
- Fecha de vencimiento: ${expectedDueDate}
${ownerIban ? `- IBAN destino: ${ownerIban}` : ''}

Extraé los datos tal como aparecen en el documento. No inferas ni completes información que no está visible.
```

### Lógica de decisión (después de obtener respuesta de Claude)

```
SI is_readable === false:
  → decision: 'auto_rejected'
  → rejection_reason: 'El comprobante subido no es legible. Por favor subí una imagen más clara.'

SI confidence_score < 50:
  → decision: 'needs_review'
  → review_reason: 'El comprobante tiene baja calidad. Revisión manual recomendada.'

SI extracted_data.amount existe:
  diferencia = abs(extracted_data.amount - expectedAmount)
  porcentaje_diferencia = (diferencia / expectedAmount) * 100

  SI porcentaje_diferencia === 0:
    amount_match = true
  ELSE SI porcentaje_diferencia <= 2:
    amount_match = true (tolerancia por centavos/redondeo)
  ELSE SI porcentaje_diferencia <= 10:
    amount_match = false, needs_review
  ELSE:
    amount_match = false, auto_rejected

SI extracted_data.date existe:
  Verificar que la fecha esté entre (due_date - 5 días) y (due_date + 30 días)
  Si está fuera de ese rango: needs_review

SI ownerIban existe Y extracted_data.destination_iban existe:
  Comparar los últimos 8 caracteres del IBAN
  Si no coinciden: needs_review (no auto_rejected, podría ser cuenta intermediaria)

REGLAS DE DECISIÓN FINAL:
  Si todos los checks pasan y confidence >= 70: auto_approved
  Si algún check falla con severidad media: needs_review
  Si el monto difiere más de 10% o documento ilegible: auto_rejected
```

### Función: processVerificationResult

Después de obtener el VerificationResult, esta función actualiza la DB y dispara notificaciones:

```typescript
async function processVerificationResult(
  paymentId: string,
  result: VerificationResult
): Promise<void>
```

Lógica:
- Si auto_approved: 
  - Actualizar payment: status='paid', amount_received=extracted_amount, receipt_data=result.extracted_data, verified_by='agent', paid_date=today
  - Llamar a triggerReceiptGeneration(paymentId)
  - Registrar en agent_actions_log con action_type='payment_auto_verified'
  - Encolar notificación al propietario: "✓ Pago de [inquilino] verificado automáticamente. €[monto] - [propiedad]"
  - Encolar notificación al inquilino: "✓ Tu pago de [mes] fue confirmado. Descargá tu recibo: [link]"

- Si needs_review:
  - Actualizar payment: status='to_verify', receipt_data=result.extracted_data
  - Registrar en agent_actions_log con action_type='payment_flagged'
  - Encolar notificación al propietario: "⚠️ Comprobante de [inquilino] requiere revisión manual. [review_reason]"

- Si auto_rejected:
  - Actualizar payment: status='pending', receipt_url=null
  - Registrar en agent_actions_log
  - Encolar notificación al inquilino con el rejection_reason específico

Por ahora las notificaciones son console.log con el mensaje exacto que se enviaría. La integración real con Twilio/Resend viene en el Prompt 6.

---

## Integrar en el endpoint de upload

En src/routes/payments.ts, reemplazar el placeholder "TODO: AI verification" con:

```typescript
// Este código corre en background, después de responder al cliente
setImmediate(async () => {
  try {
    const result = await verifyPaymentReceipt(
      receiptUrl,
      payment.amount_expected,
      payment.due_date,
      owner.iban
    )
    await processVerificationResult(paymentId, result)
  } catch (error) {
    console.error('AI verification failed:', error)
    // Si falla la verificación AI, dejar el pago en 'to_verify' para revisión manual
    await supabase
      .from('payments')
      .update({ status: 'to_verify' })
      .eq('id', paymentId)
  }
})
```

---

## Optimización de tokens de Claude

Para minimizar el costo de la API de Claude:
1. Comprimir imágenes antes de enviar: si la imagen es > 1MB, redimensionar a máximo 1500px de ancho antes de convertir a base64 (usar sharp: npm install sharp)
2. Usar claude-3-5-haiku-20241022 en vez de Sonnet para verificación de comprobantes (más barato, suficiente para OCR)
3. Cachear resultados: si el mismo receipt_url ya fue procesado, no llamar a Claude de nuevo (verificar receipt_data en DB)
4. max_tokens: 500 es suficiente para la respuesta JSON

---

## Manejo de errores específicos

- Si la imagen no se puede descargar desde Supabase Storage: marcar como 'to_verify', loguear error
- Si Claude devuelve JSON malformado: parsear con try/catch, si falla marcar como 'to_verify'
- Si Claude API está caída (status 500+): retry con exponential backoff (3 intentos), luego marcar como 'to_verify'
- Nunca rechazar automáticamente un pago por error técnico, siempre escalar a 'to_verify' como fallback

---

## Entregable

Al terminar este prompt:
1. Subir un comprobante real (foto de una transferencia) y verificar que Claude extrae los datos correctamente
2. Un pago con monto correcto debe pasar a status 'paid' automáticamente
3. Un comprobante borroso o con monto incorrecto debe pasar a 'to_verify'
4. La consola debe mostrar los mensajes de notificación que se enviarían
5. El dashboard debe reflejar el cambio de estado en tiempo real (gracias al refetchInterval de 30s)
6. Revisar agent_actions_log en Supabase para confirmar que se registran todas las acciones
```

---

## PROMPT 6 — Sistema de notificaciones: WhatsApp, Email y llamadas

```
Continuamos con RentFlow. El agente verifica comprobantes automáticamente. Ahora implementás el sistema de notificaciones multicanal real: WhatsApp vía Twilio, Email vía Resend, y llamadas de voz vía Twilio.

---

## Variables de entorno adicionales

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_PHONE_FROM=+1XXXXXXXXXX
RESEND_API_KEY=
RENTFLOW_DOMAIN=https://rentflow.app
```

---

## Dependencias

npm install twilio resend

---

## Crear: src/lib/notifications.ts

Este módulo centraliza TODAS las notificaciones del sistema.

### Tipos de notificación

```typescript
type NotificationType = 
  | 'welcome'              // primer contacto con inquilino
  | 'reminder_3_days'      // 3 días antes del vencimiento
  | 'reminder_due_today'   // día del vencimiento sin pago
  | 'overdue_day_1'        // 1 día de mora
  | 'overdue_day_3'        // 3 días de mora
  | 'overdue_day_7'        // 7 días de mora (incluye llamada)
  | 'overdue_day_14'       // 14 días: escalar a propietario
  | 'payment_confirmed'    // pago verificado (para inquilino)
  | 'payment_rejected'     // comprobante rechazado (para inquilino)
  | 'needs_review_owner'   // alerta al propietario de revisión pendiente
  | 'auto_verified_owner'  // confirmación al propietario de pago auto-verificado
  | 'daily_report_owner'   // reporte diario al propietario
  | 'lease_expiry_90'      // contrato vence en 90 días (para propietario)
  | 'lease_expiry_30'      // contrato vence en 30 días (para inquilino)
```

### Función: sendWhatsApp

```typescript
async function sendWhatsApp(
  to: string,           // número con código de país: +34600000001
  message: string,      // mensaje generado por el agente
  paymentId?: string,   // para el log
  tenantId?: string
): Promise<{ success: boolean, externalId?: string }>
```

Usar Twilio WhatsApp Sandbox en desarrollo (whatsapp:+14155238886) y el número aprobado en producción.
Formato del número destino: 'whatsapp:' + to

### Función: sendEmail

```typescript
async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  paymentId?: string,
  ownerId?: string
): Promise<{ success: boolean, externalId?: string }>
```

Usar Resend con from: 'RentFlow <noreply@rentflow.app>'

### Función: makeVoiceCall

```typescript
async function makeVoiceCall(
  to: string,           // número del inquilino
  tenantName: string,
  amountOwed: number,
  currency: string,
  monthName: string,
  ownerPhone?: string   // para que el inquilino pueda devolver la llamada
): Promise<{ success: boolean, callSid?: string }>
```

Usar Twilio Programmable Voice con TwiML:
```xml
<Response>
  <Say language="es-ES" voice="Polly.Lucia">
    Hola ${tenantName}. Le llamamos de parte de su arrendador.
    Su pago de alquiler correspondiente a ${monthName} por un monto de 
    ${amountOwed} ${currency} está pendiente de confirmación.
    Si ya realizó la transferencia, por favor ingrese a su portal de inquilino
    y suba el comprobante de pago. Si necesita hablar con su arrendador,
    puede contactarlo directamente. Gracias.
  </Say>
</Response>
```
La llamada usa AWS Polly voz española "Lucia" vía Twilio para sonar más natural.

### Función principal: generateAndSendNotification

Esta es la función que el agente llama para cada notificación. Genera el mensaje con Claude y lo envía:

```typescript
async function generateAndSendNotification(params: {
  type: NotificationType
  tenantId: string
  ownerId: string
  paymentId?: string
  extraContext?: Record<string, any>
}): Promise<void>
```

Flujo interno:
1. Cargar datos del inquilino, pago, propiedad y propietario desde la DB
2. Llamar a generateNotificationMessage(type, data) para generar el mensaje
3. Según el tipo y canal apropiado, llamar a sendWhatsApp / sendEmail / makeVoiceCall
4. Guardar en notifications_log con todos los datos

### Función: generateNotificationMessage

Usa Claude para generar mensajes personalizados:

```typescript
async function generateNotificationMessage(
  type: NotificationType,
  data: {
    tenantName: string
    tenantLanguage: string     // 'es', 'en', 'ca'
    ownerName: string
    propertyAddress: string
    amountExpected: number
    currency: string
    dueDate: string
    daysOverdue?: number
    receiptRejectionReason?: string
    receiptPdfUrl?: string
    monthName: string
  }
): Promise<{ whatsapp: string, email_subject: string, email_body: string }>
```

System prompt para Claude:
```
Sos el asistente de comunicaciones de RentFlow, una plataforma de gestión de alquileres. 
Generás mensajes de comunicación entre propietarios e inquilinos. 
Tus mensajes son siempre: claros, directos, profesionales pero cálidos, nunca agresivos.
Respondés SOLO con JSON válido con las claves: whatsapp, email_subject, email_body (HTML básico).
El idioma de los mensajes debe ser: ${tenantLanguage}
```

Usar claude-3-5-haiku-20241022 para minimizar costo. max_tokens: 800.

### Canal por tipo de notificación

```
welcome:              WhatsApp + Email
reminder_3_days:      WhatsApp
reminder_due_today:   WhatsApp + Email
overdue_day_1:        WhatsApp
overdue_day_3:        WhatsApp + Email
overdue_day_7:        WhatsApp + Email + Llamada de voz
overdue_day_14:       Email al propietario (NO contactar más al inquilino)
payment_confirmed:    WhatsApp + Email al inquilino
payment_rejected:     WhatsApp al inquilino
needs_review_owner:   Email al propietario
auto_verified_owner:  Email al propietario (batch, no uno por uno)
daily_report_owner:   Email al propietario
lease_expiry_90:      Email al propietario
lease_expiry_30:      WhatsApp + Email al inquilino
```

---

## Reemplazar los console.log del Prompt 5

En src/lib/ai-verification.ts, reemplazar todos los "TODO: enviar notificación" con llamadas reales a generateAndSendNotification.

En src/routes/payments.ts, cuando el propietario aprueba/rechaza manualmente, llamar a generateAndSendNotification con el tipo correcto.

---

## Rate limiting de notificaciones

Agregar una verificación antes de enviar cualquier notificación al inquilino:
- Máximo 1 WhatsApp por inquilino por día
- Máximo 1 llamada por inquilino por semana
- Si el inquilino ya recibió esa notificación hoy (verificar notifications_log), no enviar de nuevo

```typescript
async function hasRecentNotification(
  tenantId: string,
  type: NotificationType,
  withinHours: number
): Promise<boolean>
```

---

## Entregable

Al terminar este prompt:
1. Subir un comprobante válido → el inquilino recibe WhatsApp de confirmación en < 30 segundos
2. Subir un comprobante inválido → el inquilino recibe WhatsApp explicando qué está mal
3. Aprobar manualmente un pago → propietario e inquilino reciben notificación
4. Verificar en Twilio dashboard que los mensajes se enviaron
5. Verificar en Resend dashboard que los emails se enviaron
6. Todos los envíos quedan registrados en la tabla notifications_log
7. El rate limiting funciona: no se puede enviar el mismo tipo de notificación dos veces al mismo inquilino en 24 horas
```

---

## PROMPT 7 — Agente autónomo: cron jobs y escalación

```
Continuamos con RentFlow. Las notificaciones funcionan. Ahora implementás el loop autónomo del agente: los cron jobs que corren diariamente sin intervención humana.

---

## Objetivo

El agente debe correr cada día a las 9AM y ejecutar un pipeline completo de acciones autónomas sin que el propietario tenga que hacer nada.

---

## Dependencias

npm install node-cron
npm install --save-dev @types/node-cron

---

## Crear: src/agent/daily-loop.ts

Esta es la función principal que se ejecuta cada mañana:

```typescript
async function runDailyAgentLoop(): Promise<void>
```

### FASE 1: Crear pagos del mes (si es el día 1 del mes)

Si hoy es el día 1 del mes:
- Para cada propietario activo, llamar a createMonthlyPayments(ownerId, currentMonth, currentYear)
- Registrar en agent_actions_log

### FASE 2: Actualizar estados vencidos

Para todos los pagos del mes actual con status 'pending':
- Si due_date < hoy: cambiar status a 'overdue'
- Registrar el cambio en agent_actions_log

### FASE 3: Pipeline de escalación

Para cada pago con status 'overdue', calcular días de mora:
daysOverdue = diferencia en días entre due_date y hoy

Para cada caso, verificar si ya se envió esa notificación (usando hasRecentNotification). Si no se envió:

```
daysOverdue == 1: enviar overdue_day_1 al inquilino (WhatsApp)
daysOverdue == 3: enviar overdue_day_3 al inquilino (WhatsApp + Email)
daysOverdue == 7: enviar overdue_day_7 al inquilino (WhatsApp + Email + Llamada)
daysOverdue == 14: enviar overdue_day_14 al propietario (Email de escalación)
daysOverdue > 14: no hacer nada automático, el propietario ya fue notificado
```

La notificación de overdue_day_14 al propietario debe incluir:
- Nombre del inquilino y propiedad
- Monto adeudado
- Todos los intentos de contacto previos (desde notifications_log)
- Recomendación: "Sugerimos contacto directo o iniciar proceso formal"

### FASE 4: Recordatorios previos al vencimiento

Para pagos del mes actual con status 'pending' (aún no vencidos):
- Si due_date - hoy == 3 días: enviar reminder_3_days
- Si due_date - hoy == 0 días (vence hoy) y no hay comprobante: enviar reminder_due_today

### FASE 5: Alertas de vencimiento de contratos

Para todos los inquilinos activos con lease_end definido:
- Si lease_end - hoy == 90 días: enviar lease_expiry_90 al propietario
- Si lease_end - hoy == 30 días: enviar lease_expiry_30 al inquilino
- Si lease_end - hoy == 0 días: marcar alerta crítica al propietario

### FASE 6: Reporte diario al propietario

Para cada propietario que tenga al menos una propiedad activa:
1. Compilar el resumen del día:
   - Acciones tomadas hoy por el agente
   - Estado actual de todos los pagos del mes
   - Pagos que necesitan revisión manual
   - Vencimientos de contratos próximos
2. Generar el email de reporte con Claude (un mensaje cohesivo, no una lista mecánica)
3. Enviar vía Resend

El reporte NO se envía si el propietario no tiene ninguna novedad (todas las propiedades al día, sin acciones pendientes). Esto evita spam de emails vacíos.

---

## Crear: src/agent/index.ts

Setup del cron scheduler:

```typescript
import cron from 'node-cron'
import { runDailyAgentLoop } from './daily-loop'

// Correr todos los días a las 9:00 AM hora local
cron.schedule('0 9 * * *', async () => {
  console.log(`[AGENT] Starting daily loop at ${new Date().toISOString()}`)
  try {
    await runDailyAgentLoop()
    console.log(`[AGENT] Daily loop completed successfully`)
  } catch (error) {
    console.error(`[AGENT] Daily loop failed:`, error)
    // TODO Prompt 8: alertar al admin si el loop falla
  }
}, {
  timezone: 'Europe/Madrid'
})

// Endpoint para trigger manual (útil para testing)
export { runDailyAgentLoop }
```

---

## Agregar endpoint de trigger manual (solo para testing y desarrollo)

En src/routes/agent.ts:

POST /api/agent/run-daily-loop
- Solo accesible con un header especial: X-Agent-Secret: [valor de env var AGENT_SECRET]
- No requiere auth de propietario
- Ejecuta runDailyAgentLoop() y responde con el log de acciones tomadas
- Solo disponible en NODE_ENV !== 'production' O con IP whitelisted

---

## Logging del agente

Crear src/agent/logger.ts que wrappea todas las acciones del agente:

```typescript
async function logAgentAction(params: {
  ownerId: string
  actionType: string
  description: string
  metadata?: Record<string, any>
}): Promise<void>
```

Guarda en agent_actions_log y también hace console.log con timestamp y formato claro:
`[AGENT 2026-05-03T09:00:15Z] owner:abc123 | payment_auto_verified | Ana Martínez - Carrer de Mallorca 123 - €1100`

---

## Integrar el agente en src/index.ts

Importar src/agent/index.ts al final de index.ts para que el scheduler se registre cuando el servidor arranca:

```typescript
// Arrancar el agente autónomo
import './agent'
console.log('[AGENT] Autonomous agent scheduled and running')
```

---

## Entregable

Al terminar este prompt:
1. Usar el endpoint POST /api/agent/run-daily-loop para triggear el loop manualmente
2. Verificar en la consola que cada fase se ejecuta y loguea correctamente
3. Crear un pago con due_date = hace 3 días y verificar que el agente envía overdue_day_3
4. Crear un inquilino con lease_end = en 30 días y verificar que el agente lo detecta
5. Verificar que agent_actions_log en Supabase tiene registros de todas las acciones
6. Verificar que el cron job está registrado (debería aparecer en los logs del servidor al arrancar)
```

---

## PROMPT 8 — Deploy a producción

```
Continuamos con RentFlow. Todo el sistema funciona localmente. Ahora desplegás a producción para que sea accesible públicamente.

---

## Prerrequisitos (confirmá que tenés esto antes de empezar)

1. Cuenta en Railway con tarjeta de crédito registrada
2. Cuenta en Vercel con el repositorio de GitHub conectado
3. El código está en un repositorio de GitHub (público o privado)
4. Dominio comprado (ej: rentflow.app) - opcional para primera versión
5. Todas las API keys de producción listas (Twilio número real aprobado, Resend dominio verificado)

---

## PARTE 1 — Preparar el backend para producción

### Crear: backend/Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Crear: backend/railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Actualizar src/index.ts para producción

Agregar:
1. Trust proxy para Railway: app.set('trust proxy', 1)
2. Logging de requests con morgan: npm install morgan
3. Graceful shutdown cuando Railway envía SIGTERM:
```typescript
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
```

### Variables de entorno en Railway

Instrucciones de qué variables configurar en el dashboard de Railway:
```
NODE_ENV=production
PORT=4000
SUPABASE_URL=[de Supabase dashboard]
SUPABASE_ANON_KEY=[de Supabase dashboard]
SUPABASE_SERVICE_ROLE_KEY=[de Supabase dashboard - Settings > API]
ANTHROPIC_API_KEY=[de console.anthropic.com]
RESEND_API_KEY=[de resend.com dashboard]
TWILIO_ACCOUNT_SID=[de twilio.com console]
TWILIO_AUTH_TOKEN=[de twilio.com console]
TWILIO_WHATSAPP_FROM=whatsapp:+[tu número aprobado]
TWILIO_PHONE_FROM=+[tu número Twilio]
JWT_SECRET=[string random de 64 caracteres - usar: openssl rand -hex 32]
AGENT_SECRET=[string random de 32 caracteres]
FRONTEND_URL=https://rentflow.app
RENTFLOW_DOMAIN=https://rentflow.app
```

---

## PARTE 2 — Preparar el frontend para producción

### Actualizar frontend/vite.config.ts

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', '@tanstack/react-query']
        }
      }
    }
  }
})
```

### Crear: frontend/vercel.json

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

El rewrites es crítico para que React Router funcione correctamente — sin esto, hacer refresh en /owner/dashboard da 404.

### Variables de entorno en Vercel

```
VITE_API_URL=https://[tu-app].railway.app
VITE_SUPABASE_URL=[mismo que backend]
VITE_SUPABASE_ANON_KEY=[mismo que backend, el anon key es seguro en frontend]
```

---

## PARTE 3 — Configurar Supabase para producción

### Ejecutar las migraciones en Supabase producción

Instrucciones paso a paso:
1. Ir a Supabase Dashboard > SQL Editor
2. Copiar y ejecutar el contenido de supabase/migrations/001_initial_schema.sql
3. Verificar que todas las tablas existen en Table Editor
4. Verificar que RLS está habilitado en cada tabla (el ícono de candado debe estar verde)
5. Crear los Storage buckets: receipts, contracts, comprobantes (todos privados)

### Configurar Auth en Supabase

En Authentication > URL Configuration:
- Site URL: https://rentflow.app
- Redirect URLs: https://rentflow.app/owner/dashboard

En Authentication > Email Templates:
- Personalizar el email de confirmación con el branding de RentFlow

---

## PARTE 4 — Configurar CORS para producción

En src/index.ts, actualizar la configuración de CORS:

```typescript
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:3000', 'http://localhost:5173']

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
```

---

## PARTE 5 — Checklist de deploy

Crear un script scripts/pre-deploy-check.ts que verifica:
- [ ] Todas las variables de entorno requeridas están definidas
- [ ] Conexión a Supabase funciona (hacer un SELECT simple)
- [ ] Claude API responde (hacer un ping con max_tokens: 5)
- [ ] Twilio credenciales son válidas
- [ ] Resend API key es válida
- [ ] GET /health devuelve 200

Si alguna verificación falla, el script loguea qué faltó y sale con código 1.

---

## PARTE 6 — Monitoreo básico post-deploy

Agregar a src/index.ts:

1. Log de cada request con: timestamp, método, path, status code, tiempo de respuesta
2. Log de errores no manejados:
```typescript
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
```

3. Endpoint GET /api/agent/status (protegido con X-Agent-Secret) que devuelve:
```json
{
  "agent_running": true,
  "last_loop_at": "2026-05-03T09:00:00Z",
  "last_loop_actions": 5,
  "next_loop_at": "2026-05-04T09:00:00Z",
  "total_actions_today": 12
}
```

---

## Entregable final

Al terminar este prompt, el sistema completo debe estar funcionando en producción:

1. https://rentflow.app carga el role selector
2. Un inquilino puede autenticarse con DNI desde su teléfono
3. Un inquilino puede subir un comprobante y recibe WhatsApp de confirmación en < 60 segundos
4. El propietario ve el dashboard actualizado con los datos reales
5. El agente corre cada mañana a las 9AM automáticamente
6. GET /health en Railway responde 200
7. Los logs de Railway muestran el agente corriendo

El sistema está listo para el primer cliente real.
```

---

## NOTAS IMPORTANTES PARA USAR ESTOS PROMPTS

1. **Siempre dale contexto previo a Claude Code.** Al empezar cada prompt nuevo, pegá primero: "Aquí está el estado actual del proyecto:" y compartí los archivos más relevantes del prompt anterior.

2. **Si Claude Code se equivoca**, no borres y empieces de cero. Decile exactamente qué está mal y pedile que lo corrija. Claude Code funciona mejor de forma iterativa.

3. **Testea antes de avanzar.** Cada prompt tiene un "Entregable" — no pases al siguiente hasta que ese entregable esté funcionando.

4. **El orden importa.** Prompt 5 (AI verification) depende de Prompt 3 (PDF generation). No mezcles fases.

5. **Las variables de entorno son tu responsabilidad.** Claude Code puede escribir el código pero no puede crear las cuentas ni obtener las API keys. Eso lo hacés vos.
