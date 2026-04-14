import { hostControlChromeStore as store } from './hostControlChrome.js'

/** Дії пульта ведучого: делегує в store.actions (синхронізація з ControlPage). */
export function useHostChromeAct() {
  return function hostChromeAct(name, ...args) {
    const fn = store.actions?.[name]
    if (typeof fn === 'function') fn(...args)
  }
}
