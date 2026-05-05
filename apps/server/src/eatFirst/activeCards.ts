/**
 * Server-side mirror of `apps/client/src/eat-first/data/activeCards.js`.
 *
 * Kept as a duplicate (instead of importing across the package boundary)
 * because `apps/server/tsconfig.json` enforces `rootDir: ./src`. The titles
 * and descriptions are user-facing Ukrainian strings stored on
 * `EatFirstPlayer.data.activeCard`; client and server pools must stay in
 * sync. If you add or rename a template, update both files.
 */

export type EatFirstActiveCardTemplate = {
  id: string
  title: string
  description: string
  effectId: string
}

export type EatFirstActiveCardSnapshot = {
  templateId: string
  title: string
  description: string
  effectId: string
  used: false
}

const TEMPLATES: readonly EatFirstActiveCardTemplate[] = [
  {
    id: 'immunity_once',
    title: 'Імунітет (один раунд)',
    description:
      'У цьому раунді тебе не можна виключити за результатом голосування — фіксує ведучий.',
    effectId: 'immunity_once',
  },
  {
    id: 'reroll_prof',
    title: 'Нова професія',
    description: 'Змінюєш свою професію; ведучий підтверджує кидок або правку.',
    effectId: 'reroll_profession_self',
  },
  {
    id: 'reroll_health',
    title: 'Новий медичний стан',
    description: 'Змінюєш здоров’я (нове значення за правилами шоу).',
    effectId: 'reroll_health_self',
  },
  {
    id: 'reroll_phobia',
    title: 'Інша фобія',
    description: 'Змінюєш фобію.',
    effectId: 'reroll_phobia_self',
  },
  {
    id: 'reroll_bag',
    title: 'Новий багаж',
    description: 'Змінюєш предмет багажу.',
    effectId: 'reroll_luggage_self',
  },
  {
    id: 'reroll_fact',
    title: 'Інший факт',
    description: 'Змінюєш біографічний факт.',
    effectId: 'reroll_fact_self',
  },
  {
    id: 'reroll_quirk',
    title: 'Нова особливість',
    description: 'Змінюєш рису характеру.',
    effectId: 'reroll_quirk_self',
  },
  {
    id: 'lucky_draw',
    title: 'Щасливий жереб',
    description:
      'Обираєш гравця; разом із ведучим визначаєш, яку саме карту він відкриє в наступному раунді.',
    effectId: 'narrative',
  },
  {
    id: 'all_prof',
    title: 'Хаос професій',
    description: 'Усім гравцям нові професії.',
    effectId: 'reroll_profession_all',
  },
  {
    id: 'all_health',
    title: 'Медичний перегляд',
    description: 'Усім гравцям новий стан здоров’я.',
    effectId: 'reroll_health_all',
  },
  {
    id: 'all_phobia',
    title: 'Колективний страх',
    description: 'Усім гравцям нові фобії.',
    effectId: 'reroll_phobia_all',
  },
  {
    id: 'all_luggage',
    title: 'Багажна метушня',
    description: 'Усім гравцям новий багаж.',
    effectId: 'reroll_luggage_all',
  },
  {
    id: 'extra_minute',
    title: 'Хвилина правди',
    description: 'Додатковий час на виступ у дискусії.',
    effectId: 'extra_speak_once',
  },
  {
    id: 'silence_vote',
    title: 'Заборона голосу',
    description: 'Один гравець не голосує в цьому раунді — кого, вирішує ведучий.',
    effectId: 'veto_vote_round',
  },
  {
    id: 'revote',
    title: 'Переголосування',
    description: 'Провести голосування заново.',
    effectId: 'force_revote',
  },
  {
    id: 'cancel_decision',
    title: 'Скасування',
    description:
      'Скасувати останню активну карту до її застосування — за правилами ведучий оформлює в ефірі.',
    effectId: 'cancel_last_decision',
  },
  {
    id: 'swap_profession',
    title: 'Обмін професією',
    description: 'Обмін професіями з обраним гравцем (ведучий фіксує в системі / на столі).',
    effectId: 'narrative',
  },
  {
    id: 'swap_health',
    title: 'Обмін здоров’ям',
    description: 'Обмін станом здоров’я з обраним гравцем.',
    effectId: 'narrative',
  },
  {
    id: 'swap_luggage',
    title: 'Обмін багажем',
    description: 'Обмін предметами багажу з обраним гравцем.',
    effectId: 'narrative',
  },
  {
    id: 'heal_health',
    title: 'Лікування здоров’я',
    description: 'Вилікувати себе або іншого гравця (на раді ведучого).',
    effectId: 'narrative',
  },
  {
    id: 'heal_phobia',
    title: 'Лікування фобії',
    description: 'Прибрати фобію у себе або в іншого гравця.',
    effectId: 'narrative',
  },
  {
    id: 'double_vote',
    title: 'Подвійний голос',
    description: 'У цьому раунді твій голос рахується за два — фіксує ведучий.',
    effectId: 'narrative',
  },
  {
    id: 'host_phrase',
    title: 'Фраза ведучому',
    description:
      'Сказавши в ефірі «у нас найкращий ведучий», ведучий змінює одну твою карту на власний вибір.',
    effectId: 'narrative',
  },
]

/**
 * Pick a fresh template for a player. `excludeIds` lets the caller avoid
 * re-rolling the same template the player just had; passing the union of all
 * currently-held cards in the room would also rotate the active set, but the
 * client picker only de-dupes per-player so we mirror that here.
 */
export function pickRandomEatFirstActiveCard(
  excludeIds: ReadonlySet<string> = new Set<string>(),
): EatFirstActiveCardSnapshot {
  const candidates = TEMPLATES.filter((t) => !excludeIds.has(t.id))
  const pool = candidates.length > 0 ? candidates : TEMPLATES
  const t = pool[Math.floor(Math.random() * pool.length)] ?? TEMPLATES[0]
  return {
    templateId: t.id,
    title: t.title,
    description: t.description,
    effectId: t.effectId,
    used: false,
  }
}
