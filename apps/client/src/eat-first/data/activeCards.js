/**
 * Активна карта (1 на гру): ефекти в межах party survival після авіакатастрофи.
 * effectId обробляється в activeCardEffects.js
 */
export const ACTIVE_CARD_EFFECT_IDS = {
  NARRATIVE: 'narrative',
  REROLL_PROFESSION_SELF: 'reroll_profession_self',
  REROLL_HEALTH_SELF: 'reroll_health_self',
  REROLL_PHOBIA_SELF: 'reroll_phobia_self',
  REROLL_LUGGAGE_SELF: 'reroll_luggage_self',
  REROLL_FACT_SELF: 'reroll_fact_self',
  REROLL_QUIRK_SELF: 'reroll_quirk_self',
  REROLL_RANDOM_TRAIT_SELF: 'reroll_random_trait_self',
  REROLL_PROFESSION_ALL: 'reroll_profession_all',
  REROLL_HEALTH_ALL: 'reroll_health_all',
  REROLL_PHOBIA_ALL: 'reroll_phobia_all',
  REROLL_LUGGAGE_ALL: 'reroll_luggage_all',
  REVEAL_ALL_SELF: 'reveal_all_self',
  HIDE_ALL_SELF: 'hide_all_self',
  EXTRA_SPEAK_ONCE: 'extra_speak_once',
  VETO_VOTE_ROUND: 'veto_vote_round',
  FORCE_REVOTE: 'force_revote',
  CANCEL_LAST_DECISION: 'cancel_last_decision',
  SECOND_CHANCE_ELIMINATION: 'second_chance_elimination',
  IMMUNITY_ONCE: 'immunity_once',
  SWAP_TWO_TRAITS_SELF: 'swap_two_traits_self',
}

/** Порядок і формулювання з узгодженого списку подій (🎴 активні · 🌪 масові · 🗣 дискусія · 🔄 взаємодія). */
export const ACTIVE_CARD_TEMPLATES = [
  /* 🎴 Активні карти */
  {
    id: 'immunity_once',
    title: 'Імунітет (один раунд)',
    description: 'У цьому раунді тебе не можна виключити за результатом голосування — фіксує ведучий.',
    effectId: ACTIVE_CARD_EFFECT_IDS.IMMUNITY_ONCE,
  },
  {
    id: 'reroll_prof',
    title: 'Нова професія',
    description: 'Змінюєш свою професію; ведучий підтверджує кидок або правку.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_PROFESSION_SELF,
  },
  {
    id: 'reroll_health',
    title: 'Новий медичний стан',
    description: 'Змінюєш здоров’я (нове значення за правилами шоу).',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_HEALTH_SELF,
  },
  {
    id: 'reroll_phobia',
    title: 'Інша фобія',
    description: 'Змінюєш фобію.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_PHOBIA_SELF,
  },
  {
    id: 'reroll_bag',
    title: 'Новий багаж',
    description: 'Змінюєш предмет багажу.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_LUGGAGE_SELF,
  },
  {
    id: 'reroll_fact',
    title: 'Інший факт',
    description: 'Змінюєш біографічний факт.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_FACT_SELF,
  },
  {
    id: 'reroll_quirk',
    title: 'Нова особливість',
    description: 'Змінюєш рису характеру.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_QUIRK_SELF,
  },
  {
    id: 'lucky_draw',
    title: 'Щасливий жереб',
    description:
      'Обираєш гравця; разом із ведучим визначаєш, яку саме карту він відкриє в наступному раунді.',
    effectId: ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  },
  /* 🌪 Масові ефекти */
  {
    id: 'all_prof',
    title: 'Хаос професій',
    description: 'Усім гравцям нові професії.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_PROFESSION_ALL,
  },
  {
    id: 'all_health',
    title: 'Медичний перегляд',
    description: 'Усім гравцям новий стан здоров’я.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_HEALTH_ALL,
  },
  {
    id: 'all_phobia',
    title: 'Колективний страх',
    description: 'Усім гравцям нові фобії.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_PHOBIA_ALL,
  },
  {
    id: 'all_luggage',
    title: 'Багажна метушня',
    description: 'Усім гравцям новий багаж.',
    effectId: ACTIVE_CARD_EFFECT_IDS.REROLL_LUGGAGE_ALL,
  },
  /* 🗣 Дискусія і голосування */
  {
    id: 'extra_minute',
    title: 'Хвилина правди',
    description: 'Додатковий час на виступ у дискусії.',
    effectId: ACTIVE_CARD_EFFECT_IDS.EXTRA_SPEAK_ONCE,
  },
  {
    id: 'silence_vote',
    title: 'Заборона голосу',
    description: 'Один гравець не голосує в цьому раунді — кого, вирішує ведучий.',
    effectId: ACTIVE_CARD_EFFECT_IDS.VETO_VOTE_ROUND,
  },
  {
    id: 'revote',
    title: 'Переголосування',
    description: 'Провести голосування заново.',
    effectId: ACTIVE_CARD_EFFECT_IDS.FORCE_REVOTE,
  },
  {
    id: 'cancel_decision',
    title: 'Скасування',
    description: 'Скасувати останню активну карту до її застосування — за правилами ведучий оформлює в ефірі.',
    effectId: ACTIVE_CARD_EFFECT_IDS.CANCEL_LAST_DECISION,
  },
  /* 🔄 Взаємодія між гравцями */
  {
    id: 'swap_profession',
    title: 'Обмін професією',
    description: 'Обмін професіями з обраним гравцем (ведучий фіксує в системі / на столі).',
    effectId: ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  },
  {
    id: 'swap_health',
    title: 'Обмін здоров’ям',
    description: 'Обмін станом здоров’я з обраним гравцем.',
    effectId: ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  },
  {
    id: 'swap_luggage',
    title: 'Обмін багажем',
    description: 'Обмін предметами багажу з обраним гравцем.',
    effectId: ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  },
  {
    id: 'heal_health',
    title: 'Лікування здоров’я',
    description: 'Вилікувати себе або іншого гравця (на раді ведучого).',
    effectId: ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  },
  {
    id: 'heal_phobia',
    title: 'Лікування фобії',
    description: 'Прибрати фобію у себе або в іншого гравця.',
    effectId: ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  },
  {
    id: 'double_vote',
    title: 'Подвійний голос',
    description: 'У цьому раунді твій голос рахується за два — фіксує ведучий.',
    effectId: ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  },
  {
    id: 'host_phrase',
    title: 'Фраза ведучому',
    description:
      'Сказавши в ефірі «у нас найкращий ведучий», ведучий змінює одну твою карту на власний вибір.',
    effectId: ACTIVE_CARD_EFFECT_IDS.NARRATIVE,
  },
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function pickRandomActiveCardTemplate() {
  return pickRandomActiveCardTemplateAvoiding(new Set())
}

/** Уникає templateId з excludeIds; якщо пул вичерпано — повний список (рідко, коли гравців більше за шаблони). */
export function pickRandomActiveCardTemplateAvoiding(excludeIds = new Set()) {
  const ex = excludeIds instanceof Set ? excludeIds : new Set(excludeIds)
  const candidates = ACTIVE_CARD_TEMPLATES.filter((t) => !ex.has(t.id))
  const pool = candidates.length ? candidates : ACTIVE_CARD_TEMPLATES
  const t = pick(pool)
  return {
    title: t.title,
    description: t.description,
    effectId: t.effectId,
    templateId: t.id,
    used: false,
  }
}
