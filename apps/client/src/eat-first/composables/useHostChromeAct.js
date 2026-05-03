import { hostControlChromeStore as store } from './hostControlChrome.js'


export function useHostChromeAct() {
  return function hostChromeAct(name, ...args) {
    const fn = store.actions?.[name]
    if (typeof fn === 'function') fn(...args)
  }
}
