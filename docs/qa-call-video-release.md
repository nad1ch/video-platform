# QA: call video (pre-release / pre-prod)

Чеклист для перевірки **стабільності відео/аудіо** і **адаптивної якості** у кімнатах **6–12** учасників (Mafia, `CallPage`). Мета: зміни в `videoQualityPreset`, шарах, BWE чи receive-політиці не випадково ламають досвід через 2–3 тижні.

Окрема зона: пул mediasoup workers — див. [qa-mediasoup-worker-pool.md](./qa-mediasoup-worker-pool.md).

## 1. Scope

Переконатись, що:

- **Simulcast + adaptive receive** (preferred layers, тиск `normal` / `constrained` / `critical`) поводяться передбачувано.
- **Out capture** `auto_large_room` відповідає **960×540 @ 24 fps** і не «повзе» до 720p для всіх без зміни пресетів.
- **Аудіо** не деградує «за компанію» з відео.

## 2. У коді (для preconditions перевірок)

| Що | Де в репо |
|----|------------|
| `VIDEO_PRESET_MAFIA`, `AUTO_LARGE_ROOM_SIMULCAST` | `packages/call-core/src/media/videoQualityPreset.ts` |
| `MAX_HIGH_STREAMS`, `MAX_MEDIUM_STREAMS` | `packages/call-core/src/media/adaptiveVideoPreferredLayers.ts` |
| Тиск receive | `packages/call-core/src/media/receiveVideoQualityPressure.ts` |
| Simulcast увімкнено при ≥N peers у кімнаті | `VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM` у `packages/call-core/src/media/videoSimulcast.ts` (зараз **6**) |

**Орієнтири з пресету large room:**

- Capture: **960×540**, **24** fps, `ideal` = `max` (без випадкового 720p).
- Ladder: LOW **150k / 12 fps / ×4** → MEDIUM **600k / 20 fps / ×2** → HIGH **1.2M / 24 fps / ×1**.
- Слоти receive: **не більше 2** HIGH, **не більше 5** MEDIUM; далі — LOW (R0) за політикою.
- `auto_large_room` tier, коли авто-режим і на wire ≥ 5 активних камер (див. `resolveOutgoingVideoPublishTier` + `ACTIVE_CAMERA_SMALL_ROOM_MAX`).

## 3. Core scenarios

### 3.1 Мала кімната (2–4)

- [ ] Усі стабільні, без зайвого «стрибання» шарів (thrashing).
- [ ] Simulcast може **не** бути (peer count &lt; `VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM`) — це **очікувана** single-layer гілка, не регресія.
- [ ] Відео виглядає добре для всіх (нема деградації «як на 12»).

### 3.2 Середня (6–8)

- [ ] **Active speaker** помітно краща якість, ніж фон.
- [ ] Більшість учасників на **MEDIUM** (spatial 1), а не **тотальне** загальне падіння в LOW.
- [ ] Навантаження CPU **без** різких піків; **аудіо** чисте.

### 3.3 Велика (10–12)

- [ ] Немає **масових** фризів; FPS стабільний у розумних межах (орієнтир **~15–24** залежно від шару/мережі).
- [ ] **Максимум 2** потоки на HIGH (speaker / priority).
- [ ] **Максимум 5** на MEDIUM; решта — LOW без лагу керування.
- [ ] R1@×2 при 540p дає **480×270** (не «480p» у сенсі 1080/2) — **очікувана** геометрія; якщо тестуєте «дорогий» middle rung, це **окрема** зміна (наприклад, дробовий `scale`).

## 4. Auto-degrade (critical path)

- [ ] **CPU throttle** (Chrome DevTools) або **імітація** повільної мережі.
- [ ] **Очікувано:** деградує **перш за все цей** клієнт; `receiveQualityPressure` → `constrained` / `critical`.
- [ ] Шари падають **поступово**, не «одним обвалом».
- [ ] **Active speaker** лишається **читабельним** (у `critical` — не нижче spatial 1 для active / pinned; див. `applyReceiveQualityPressureToLayers`).
- [ ] **Аудіо** не псується (нема «порізання» бітуз як покарання за відео).

## 5. Recovery

- [ ] Зняти throttle / нормальна мережа.
- [ ] `pressure` повертається до `normal` (або м’якше), шари **піднімаються** поступово.
- [ ] Без flapping, без **обов’язкового** реконнекту лише через відео-тиск.

## 6. OBS / viewer (`?mode=view`)

- [ ] **Recv-only** (нема publish) — стабільне відео, **нема** зайвих CPU-піків.
- [ ] **Нема** дубляжу/ехо аудіо.

## 7. Simulcast ON / OFF

**ON** (peers ≥ поріг):

- [ ] Перемикання шарів працює, нема **спаму** в логах (prod).

**OFF** (вимушено, якщо є тестовий хук; інакше пропустити з приміткою):

- [ ] **Нема** crash; single-layer **стабільний**; прийнятна якість (cap ≈ 1.2M для `auto_large_room` — див. пресет).

## 8. Браузери

- [ ] **Chrome** — повна поведінка OK.
- [ ] **Safari / WebKit** — без crash, відео не «бите»; якщо згодом увімкнути **дробовий** `scaleResolutionDownBy` — окремо перевірити або зафіксувати **fallback**.

## 9. Stats (валідація)

Перевірити **WebRTC** стати (inbound, де є):

- `framesDropped`, `framesPerSecond`, `packetsLost`.

**Очікувано:**

- [ ] Degrade **спрацьовує** на поганих метриках.
- [ ] Немає **постійних** false positives на стабільному з’єднанні (warmup / пороги в `evaluateInboundVideoStatsForPressure`).

## 10. Аудіо (критично)

- [ ] **Не** вважається «деградованим» разом із відео-тиском (окремі шляхи).
- [ ] Нема десинхрону, кліпінгу, артефактів; **стабільно** під навантаженням.

## 11. Регресії (guard)

- [ ] Не зростає **кількість** реконнектів без причини.
- [ ] Після **toggle** камери — нема **чорних** кадрів «назавжди».
- [ ] **Screen share** не зламано.
- [ ] **Consumers** не застряють (нема вічного `paused` / stuck tile без логу помилки).

## 12. Очікуваний UX (коротко)

- Користувач **стабільно** чує всіх.
- **Active speaker** видно **краще** за фон.
- Немає відчуття «важкого» лагу з дефолтних пресетів на 6–12 людей.

## Чому це важливо

Без чеклиста зміни в бітрейті, `scale`, capture або лімітах шарів легко **зламати стабільність** без жодного бага в TypeScript. Цей док — **дисципліна** перевірки, не заміна метрик.

## Подальші кроки (не блокують реліз)

- Telemetry: layer distribution, dropped frames, pressure state.
- Dev overlay: HIGH / MEDIUM / LOW, `pressure` (тільки DEV).
- Можлива (окрема) тонка зміна R1: **дробовий** `scale` замість ×2 для **кращого** middle rung (з метриками по Safari).

---

**Version:** v1 (540p baseline, simulcast adaptive)  
**Last updated:** 2026-04-24
