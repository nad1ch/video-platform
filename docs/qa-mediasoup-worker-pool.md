# QA: mediasoup worker pool (pre-merge / pre-prod)

Чеклист для перевірки пулу workers перед merge у `main` і перед деплоєм на production.

## Must-have перед продом (обов’язково)

**§1–3** — **мінімум** для merge: backward compatibility, облік `roomCount` (rooms ≠ users) і cleanup.

**§4–7** — **козирі** (bulletproof): sticky assignment, burst, ізоляція dead worker, **сумовий** sanity check по `/health` — закривають міграцію, рейси та подвійний register.

### 1. `MEDIASOUP_WORKER_POOL_SIZE=1` (fallback)

- [ ] Підняти сервер з **`MEDIASOUP_WORKER_POOL_SIZE=1`**
- [ ] У логах: пул стартує з **одним** worker (див. pino `mediasoup-worker-pool` — `mediasoup worker pool: started` з `workerCount: 1`)
- [ ] `GET /health` → `mediasoupWorkers` містить **один** елемент, `roomCount: 0` / очікувано при навантаженні
- [ ] **Очікування:** усе поводиться **як до пулу** (один процес mediasoup worker на всі кімнати) — call / Mafia / join без нових регресій
- [ ] **Навіщо:** швидкий **fallback** на проді, якщо пул або розподіл викликатимуть проблеми — можна тимчасово відкотитись на `=1` без зміни клієнта

### 2. Reuse кімнати: `roomCount` рахує **rooms**, не **users**

- [ ] Стан пулу: `MEDIASOUP_WORKER_POOL_SIZE` ≥ 2 (щоб мати сенс розподілу)
- [ ] **Три** користувачі заходять в **одну й ту саму** room id (той самий call / Mafia room)
- [ ] `GET /health` після повного join усіх трьох: для worker, на якому ця room, **`roomCount` збільшилось на +1**, а **не** на +3
- [ ] **Очікування:** `registerRoom` / `unregisterRoom` прив’язані до **життєвого циклу кімнати**, а не до кожного peer

### 3. Порожня кімната й зменшення `roomCount` (після cleanup)

- [ ] Коли **усі** вийшли з кімнати (остання людня закрила таб / `leave` і т.д.): кімната на сервері **видаляється** — після цього **`roomCount` на відповідному worker падає**
- [ ] **Не обов’язково миттєво в одному HTTP-запиті:** можна кілька разів оновлювати `GET /health` (опитування 1–5 с), якщо десь з’явиться **затримка** або асинхронне прибирання
- [ ] **Зараз у коді** (`finalizeRoomIfEmpty` → `roomManager.removeRoom`) видалення кімнати після виходу останнього peer **синхронне**; цей пункт залишається актуальним для регресій, polling `/health` і **майбутніх** змін з `setTimeout` / delay

### 4. Sticky worker (без міграції room між processes)

**Навіщо:** якщо room «переїде» на інший worker під час життя сесії — усі mediasoup router/transports/consumer state для цієї room стають неконсистентними (клієнт і сервер очікують одну кімнату на одному worker). Дизайн: **one room → one worker for lifetime**.

- [ ] Створити **одну** room (запам’ятати **room id**)
- [ ] Подивитись `GET /health` або логи старту / відлагодження: зафіксувати **worker `index`**, на якому з’явилась перша `roomCount` для цієї кімнати
- [ ] **Підключити й від’єднати** кілька peers (2–3) у **ту саму** room, можливо rejoin з іншого таба
- [ ] **Очікування:** поки **та сама** room існує, **`roomCount` залишається на тому самому `index`**; немає «стрибка» room на інший worker при join/leave peers
- [ ] *Примітка:* `/health` не показує `roomId` per worker; для суворої фіксації можна тимчасово скористатись `entriesForDebug` у логах / одноразовим dev-логом. Для black-box достатньо: **одна** room, один worker у snapshot має +1, інші 0, і **індекс не змінюється** на проти join/leave циклу

### 5. Burst create (мінімальний stress)

**Навіщо:** ловить **race** в `getLeastLoadedWorker` + `getOrCreateRoom` (pending room), подвійний register тощо.

- [ ] `MEDIASOUP_WORKER_POOL_SIZE` ≥ 2
- [ ] **Швидко** створити **10–20 різних** room id (різні call-room коди, скрипт `join-room` або кілька табів) — наскільки дозволяє локальне середовище
- [ ] **Очікування:** нема **crash** процесу; у відповідь на `GET /health` сума `roomCount` і розподіл по workers **адекватні** (кластися з least-loaded, без «провалу» в мінус)
- [ ] Потім **порожнити** кімнати (вийти) і переконатись, що `roomCount` повертаються до 0 (разом з §7)

### 6. Після смерті worker: нова room **не** потрапляє в **dead** worker

**Навіщо:** `getLeastLoadedWorker` **має** ігнорувати `dead: true` — інакше нова room створиться на мертвому процесі.

- [ ] (Окремо / staging) **Симулювати** смерть одного child worker з пулу
- [ ] У `GET /health` цей worker: **`dead: true`**, `roomCount` вичищений або 0 (після евакуації)
- [ ] Створити **нову** room (новий id)
- [ ] **Очікування:** нова room з’являється лише на **живих** workers (`dead: false`); **немає** приросту `roomCount` на `dead` worker

### 7. Health sanity: сума `roomCount` = кількість активних rooms

**Навіщо:** швидко ловить **double `registerRoom`**, **відсутній `unregister`**, «фантомні» room у лічильнику.

- [ ] Кількісно: **N** активних кімнат (під твій контроль — N різних room id, у кожній хоча б 1 peer або порожнє після сценарію)
- [ ] `sum(mediasoupWorkers[i].roomCount) === N` (у момент знімка)
- [ ] Після **повного** закриття всіх кімнат: `sum(roomCount) === 0` і всі `dead: false` (крім окремо протестованого сценарію смерті worker)
- [ ] *Обмеження:* якщо на сервері з’являться **інші** джерела mediasoup rooms поза call-потоком (інший модуль) — тоді рівність треба уточнювати; зараз **усі** call rooms проходять через `RoomManager` + pool

---

## Базовий план (коротко)

| Перевірка | Pass |
|-----------|------|
| Старт з `MEDIASOUP_WORKER_POOL_SIZE` (1..64) / дефолт | ☐ |
| `GET /health` → `mediasoupWorkers: [{ index, roomCount, dead }]` | ☐ |
| Нові **різні** room id — розкладка по **least-loaded** workers | ☐ |
| `roomCount` відповідає кількості **живих** room на worker | ☐ |
| Call + Mafia + OBS `?mode=view` (viewer) без регресій | ☐ |
| Смерть worker: **критичний** лог, евакуація / не тиха помилка; `dead: true` | ☐ |
| Жодна **активна** room **не мігрує** між workers | ☐ |
| Graceful shutdown: кімнати задізпоузені, `unregisterRoom` узгоджений, пул закритий | ☐ |
| **§4–7** (sticky, burst, після смерті worker, `sum(roomCount)`) | ☐ — деталі в розділах 4–7 вище |

### Логи (орієнтири)

- **pino** `mediasoup-worker-pool`: старт пулу, **fatal** при падінні child worker
- **Термінал сервера** після `SIGINT`/`SIGTERM`: послідовне завершення без необроблених винятків

### Рейси (для рев’ю, не обов’язково E2E)

- Одночасне `getOrCreateRoom` для **однієї** room id (має бути одна `Room` і один `+1` `roomCount`)
- Створення room падає **до** `registerRoom` — `roomCount` не повинен зростати «порожнім» слотом
- Після `evacuateRoomsForDeadWorker` лічильники на мертвому worker скидаються / worker виключений з вибору

### Метрики пізніше (не в scope зараз)

Мінімальний пакет, коли буде готова інфра:

- `rooms` / `peers` per worker (и за бажанням — bitrate/CPU на child process)
- лічильник «немає живих workers», latency join
- (далі) **клієнтський auto-degrade** за якістю мережі (типовий адаптивний receive policy) — **без** rewrite стеку, оркестраційно
- (далі) **room health score** (лагає room vs ні) — агрегація сигналів, не костиль у hot path

Усе для Prometheus / панелей, **не** в гарячий шлях.

### Що поки **не** оптимізувати

Кластер з кількох нод, Redis, **міграція** room між workers, ребалансування, зміна **протоколу** сигнальної частини — поза дизайном поточного пулу.

---

## Вердикт по архітектурі (референс)

- **1 room / до ~12 гравців** — далі оптимізація в основному **viewer** + simulcast / layers, не кількістю workers на одну room
- **Багато rooms** — **розподіл** по mediasoup workers
- **`/health`** — знімок стану пулу
- **Смерть worker** — **не** silent fail

_Оновлюйте цей документ, якщо змінюється семантика `removeRoom` або з’являється відкладене прибирання кімнат._
