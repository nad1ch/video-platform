/**
 * Server-side trait pools for Eat First. Mirror of the rich UA pools at
 * `apps/client/src/eat-first/data/pools/characterPools.js` and `randomPools.js`.
 * Kept in `apps/server/src/eatFirst` because `apps/server/tsconfig.json` blocks
 * cross-package imports. Both sides read the same identifiers, but the server
 * pool is the authoritative source for reroll values broadcast over signaling.
 *
 * Subset chosen to keep the file small while still giving enough variation for
 * 11-player rooms over many rerolls.
 */

export type EatFirstTraitKey =
  | 'gender'
  | 'age'
  | 'profession'
  | 'health'
  | 'hobby'
  | 'phobia'
  | 'fact'
  | 'baggage'

export const EAT_FIRST_TRAIT_KEYS: readonly EatFirstTraitKey[] = [
  'gender',
  'age',
  'profession',
  'health',
  'hobby',
  'phobia',
  'fact',
  'baggage',
]

const GENDERS: readonly string[] = ['Чоловік', 'Жінка', 'Non-binary', 'Не вказано']

const PROFESSIONS: readonly string[] = [
  'Пілот', 'Бортпровідник', 'Лікар-швидкої', 'Медсестра', 'Хірург (пасажир)',
  'Парамедик', 'Ветеринар', 'Інженер-механік', 'Електрик', 'Будівельник',
  'Архітектор', 'Агроном', 'Лісник', 'Гід туристичний', 'Інструктор з виживання',
  'Рятувальник', 'Пожежник', 'Військовий запасу', 'Поліцейський', 'Охоронець',
  'Вчитель фізкультури', 'Програміст', 'Журналіст', 'Фотограф', 'Кухар',
  'Кондитер', 'Бармен', 'Психолог', 'Юрист', 'Менеджер логістики',
  'Дальнобійник', 'Музикант', 'Стрімер', 'Перекладач', 'Дайвер-аматор',
]

const HEALTH: readonly string[] = [
  'Повністю здоровий', 'Контузія', 'Хронічна астма', 'Алергія на горіхи',
  'Дальтонізм', 'Цукровий діабет', 'Гіпертонія', 'Гастрит', 'Панічні атаки',
  'Тремор рук', 'Лунатик', 'Амнезія', 'Слабкий зір', 'Слабкий слух',
  'Алергія на пил', 'Хронічний бронхіт', 'Зламана рука (гіпс)',
  'Алергія на сонце', 'Тиск піднімається від стресу', 'Без зубів',
  'Ішіас', 'Артрит коліна',
]

const HOBBIES: readonly string[] = [
  'Відеоігри', 'Фотографія', 'Малювання', 'Риболовля', 'Шахи',
  'Гірський велосипед', 'Скелелазіння', 'Карате', 'Йога', 'Вокал',
  'Гра на гітарі', 'Колекціонування марок', 'Реставрація меблів', 'Кулінарія',
  'Бойові мистецтва', 'Орігамі', 'Парапланеризм', 'Серфінг', 'Лижі',
  'Стрітарт', 'Підкастинг', 'Книжки про детективів', 'Ретроконсолі',
]

const PHOBIAS: readonly string[] = [
  'Висота', 'Темрява', 'Гучні звуки', 'Кров', 'Голки', 'Павуки', 'Змії',
  'Щури', 'Вогонь', 'Гроза', 'Натовпи', 'Самотність', 'Клаустрофобія',
  'Холод', 'Голод', 'Бананофобія', 'Трипофобія', 'Номофобія',
  'Страх не прокинутись', 'Страх замерзнути', 'Страх бути з’їденим',
]

const FACTS: readonly string[] = [
  'Був у двох авіапригодах (без травм)', 'Спав під час катастрофи',
  'Перший раз літав літаком', 'Має сертифікат першої допомоги',
  'Проходив курс виживання', 'Колись ночував у лісі тиждень',
  'Вміє добувати вогонь без сірників', 'Знає їстівні корені регіону',
  'Сидів біля аварійного виходу', 'Знав пілота особисто',
  'Їхав до весілля друга', 'Віз валізу з грошима',
  'Має трьох дітей вдома', 'Нещодавно розлучився', 'Щойно зробив пропозицію',
  'Алкоголь у крові під час катастрофи', 'Тверезий як скло',
  'Допомагав дітям при евакуації', 'Перший вибрався з уламків',
  'Має подвійне громадянство', 'Колись тонув і його врятували',
  'Колись вижив у землетрусі', 'Носить амулет «від біди»',
]

const BAGGAGE: readonly string[] = [
  'Ніж мультитул', 'Складна пила', 'Трос 10 м', 'Запальничка + вогниво',
  'Сірники у герметику', 'Компас', 'Карта місцевості', 'GPS-годинник (розряджений)',
  'Павербанк + кабель', 'Рація (без батарей)', 'Ліхтарик налобний',
  'Фільтр для води', 'Міні-аптечка', 'Бинти + пластир', 'Антисептик',
  'Термос їжі', 'Сухпай на 2 доби', 'Батончики мюслі', 'Шоколад',
  'Намет одномісний', 'Спальник легкий', 'Дощовик-пончо', 'Тепла куртка',
  'Запасні шкарпетки', 'Свисток рятувальний', 'Маска від пилу', 'Пляшка води 1 л',
  'Книга «Виживання в дикій природі»', 'Гітара без чохла',
]

const POOL_BY_KEY: Record<Exclude<EatFirstTraitKey, 'age'>, readonly string[]> = {
  gender: GENDERS,
  profession: PROFESSIONS,
  health: HEALTH,
  hobby: HOBBIES,
  phobia: PHOBIAS,
  fact: FACTS,
  baggage: BAGGAGE,
}

const AGE_MIN = 18
const AGE_MAX = 80

function randomAgeString(): string {
  const n = Math.floor(Math.random() * (AGE_MAX - AGE_MIN + 1)) + AGE_MIN
  return `${n}`
}

/**
 * Pick a fresh trait value, avoiding `current` so consecutive rerolls always
 * produce a different string when the pool has more than one entry.
 */
export function pickEatFirstTraitValue(key: EatFirstTraitKey, current?: string): string {
  if (key === 'age') {
    let next = randomAgeString()
    if (typeof current === 'string' && current.trim() === next) {
      next = randomAgeString()
    }
    return next
  }
  const pool = POOL_BY_KEY[key]
  if (!pool || pool.length < 1) return 'Невідомо'
  const cur = typeof current === 'string' ? current.trim() : ''
  const filtered = cur.length > 0 ? pool.filter((v) => v !== cur) : [...pool]
  const target = filtered.length > 0 ? filtered : pool
  return target[Math.floor(Math.random() * target.length)] ?? pool[0] ?? 'Невідомо'
}

/** Return a complete, freshly randomized trait map for one player. */
export function buildFreshEatFirstTraits(): Record<EatFirstTraitKey, string> {
  const out = {} as Record<EatFirstTraitKey, string>
  for (const key of EAT_FIRST_TRAIT_KEYS) {
    out[key] = pickEatFirstTraitValue(key)
  }
  return out
}
