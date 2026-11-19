# Rubro y schema.org

Antes de proponer nodos, define el rubro del sitio y busca su tipo en [schema.org](https://schema.org).
Schema.org lista, para cada tipo de negocio, los datos que la gente suele buscar sobre él: un hotel
tiene `checkinTime` y `petsAllowed`; un restaurante, `servesCuisine` y `acceptsReservations`. Usar esa
lista como pauta tiene tres ventajas:

- **Cobertura.** Las propiedades del tipo son las preguntas probables. Si una no tiene nodo, lo más
  probable es que falte un dato, no que nadie lo pregunte.
- **Nodos comparables.** Dos sitios del mismo rubro quedan con nodos parecidos, y es más fácil revisarlos
  y mantenerlos.
- **Datos reutilizables.** Los mismos datos sirven después para el JSON-LD del sitio. pregunta-al-sitio
  no lo genera; es un uso aparte.

## Preguntar el rubro

Al comenzar, pregunta a la persona:

1. **Rubro**: qué es el negocio (hotel boutique, agencia de turismo aventura, estudio contable…).
2. **Contexto**: qué ofrece, a quién y dónde (ciudad o zona que atiende, idiomas, temporada).
3. **Lo que más le preguntan** sus clientes, si lo sabe.

Si las fuentes ya muestran el rubro, propón tú la respuesta y pide que la confirme. No sigas sin esa
confirmación. Anota el resultado en `sitio.yaml`. El chat no usa este campo; queda como registro:

```yaml
rubro:
  descripcion: Hotel boutique de 12 habitaciones en Pucón, abierto todo el año
  schema: Hotel                 # tipo principal de schema.org
  otros: [TouristTrip]          # tipos de otras ofertas del sitio (tours, cursos, productos…)
```

Elige el tipo más específico que calce: `Hotel` antes que `LodgingBusiness`, y `LodgingBusiness` antes
que `LocalBusiness`. Si hay dudas, ofrece dos o tres opciones y que la persona decida.

## Del tipo a los nodos

1. Recorre las propiedades del tipo y de sus tipos padre (`Hotel` → `LodgingBusiness` → `LocalBusiness`
   → `Organization`). Descarta las que un visitante no preguntaría (`duns`, `isicV4`…).
2. Agrupa las propiedades que se preguntan juntas en un solo nodo. Por ejemplo, `address`, `geo` y
   `hasMap` van en el nodo de ubicación, y `checkinTime`, `checkoutTime` y `petsAllowed` en el de
   políticas. Una propiedad que da para un tema propio (`amenityFeature` en un hotel con spa) lleva su
   propio nodo.
3. Las ofertas concretas (habitaciones, tours, servicios, productos, cursos) usan su propio tipo
   (`HotelRoom`, `TouristTrip`, `Service`, `Product`, `Course`): **un nodo por oferta**, con los datos de
   sus propiedades.
4. Para cada propiedad agrupada, busca el dato en las fuentes:
   - Si está, va en `respuesta_corta`. Los datos breves o numéricos van en `tarjeta.items` o
     `tarjeta.cifras` (`numberOfRooms`, `starRating`, `priceRange`).
   - Si no está, no lo inventes: anótalo en `informes/pendientes.md` como dato faltante, con el nombre
     de la propiedad.
5. En el mapa de nodos, agrega una columna `schema` con el tipo y las propiedades que cubre cada nodo.
   Al final del mapa, lista las propiedades del tipo principal que ningún nodo cubre y explica por qué
   (sin dato o no aplica).

En cada nodo, anota lo mismo en el campo opcional `schema`. El chat no lo usa; sirve para revisar la
cobertura y para un JSON-LD posterior:

```yaml
schema: { tipo: Hotel, propiedades: [checkinTime, checkoutTime, petsAllowed] }
```

**Schema.org ordena los nodos; no reemplaza las palabras del visitante.** `titulo`, `preguntas`,
`keywords` y `sinonimos` siguen escritos en español y como los escribiría un cliente ("¿a qué hora
puedo entrar a la pieza?"). Nunca usan nombres de propiedades como `checkinTime`.

## Tipos frecuentes

Son puntos de partida, no listas cerradas. Confirma las propiedades en la página del tipo en schema.org.

| Rubro | Tipo | Propiedades que suelen dar nodos |
|---|---|---|
| Hotel, hostal, cabañas, camping | `Hotel`, `Hostel`, `BedAndBreakfast`, `Campground`, `Resort` (todos `LodgingBusiness`) | `checkinTime`, `checkoutTime`, `amenityFeature`, `petsAllowed`, `numberOfRooms`, `starRating`, `availableLanguage`; habitaciones como `HotelRoom` (`bed`, `occupancy`, `amenityFeature`) |
| Restaurante, café, bar | `Restaurant`, `CafeOrCoffeeShop`, `BarOrPub` (`FoodEstablishment`) | `servesCuisine`, `hasMenu`, `acceptsReservations`, `openingHoursSpecification` |
| Tours, excursiones | `TravelAgency`, `TouristAttraction`; cada tour como `TouristTrip` | `itinerary`, `touristType`, `offers` (precio, disponibilidad), `subTrip` |
| Servicios profesionales | `ProfessionalService`, `AccountingService`, `LegalService`; cada servicio como `Service` | `serviceType`, `areaServed`, `audience`, `offers`, `hasOfferCatalog` |
| Tienda | `Store` y sus subtipos; cada producto como `Product` | `brand`, `offers` (`price`, `availability`, `shippingDetails`), `hasMerchantReturnPolicy` |
| Salud | `MedicalClinic`, `Dentist`, `Physician` | `medicalSpecialty`, `availableService`, `openingHoursSpecification` |
| Educación | `EducationalOrganization`; cada curso como `Course` | `coursePrerequisites`, `hasCourseInstance` (`courseMode`, fechas), `educationalCredentialAwarded`, `offers` |
| Software, SaaS | `SoftwareApplication`, `WebApplication` | `applicationCategory`, `operatingSystem`, `featureList`, `offers` |
| Eventos | `Event` y sus subtipos | `startDate`, `location`, `eventAttendanceMode`, `offers`, `organizer` |

Comunes a casi cualquier negocio con local (`LocalBusiness`): `address`, `geo` y `hasMap` (ubicación),
`openingHoursSpecification` (horario), `telephone` y `email` (contacto), `paymentAccepted` y
`currenciesAccepted` (pagos), `priceRange` y `areaServed`. Las preguntas frecuentes del sitio, si las
tiene, corresponden a `FAQPage`: cada pregunta con respuesta propia es candidata a nodo.
