import { computed, nextTick, ref, watch } from 'vue'

type ChatPanelRect = { left: number; top: number; width: number; height: number }
type ChatPanelGesture = {
  kind: 'move' | 'resize'
  startX: number
  startY: number
  startRect: ChatPanelRect
}

export function useCallChatPanel(input: {
  inCall: () => boolean
  roomId: () => unknown
}) {
  const chatOpen = ref(false)
  const chatPanelRect = ref<ChatPanelRect | null>(null)
  const chatPanelCustomized = ref(false)
  let chatPanelGesture: ChatPanelGesture | null = null

  function chatOpenPrefKey(): string {
    const roomId = input.roomId()
    const r = typeof roomId === 'string' ? roomId.trim() : String(roomId ?? '')
    return `streamassist_call_chat_open:${r || 'demo'}`
  }

  function clampNumber(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  function defaultChatPanelRect(): ChatPanelRect {
    if (typeof window === 'undefined') {
      return { left: 0, top: 0, width: 320, height: 520 }
    }
    const margin = 12
    const width = Math.min(340, Math.max(280, window.innerWidth - margin * 2))
    const top = 72
    const height = Math.min(Math.max(360, window.innerHeight - top - 100), window.innerHeight - margin * 2)
    return clampChatPanelRect({
      left: window.innerWidth - width - margin,
      top,
      width,
      height,
    })
  }

  function clampChatPanelRect(rect: ChatPanelRect): ChatPanelRect {
    if (typeof window === 'undefined') {
      return rect
    }
    const margin = 8
    const minWidth = Math.min(260, Math.max(180, window.innerWidth - margin * 2))
    const minHeight = Math.min(300, Math.max(220, window.innerHeight - margin * 2))
    const maxWidth = Math.max(minWidth, window.innerWidth - margin * 2)
    const maxHeight = Math.max(minHeight, window.innerHeight - margin * 2)
    const width = clampNumber(rect.width, minWidth, maxWidth)
    const height = clampNumber(rect.height, minHeight, maxHeight)
    return {
      left: clampNumber(rect.left, margin, window.innerWidth - width - margin),
      top: clampNumber(rect.top, margin, window.innerHeight - height - margin),
      width,
      height,
    }
  }

  function ensureChatPanelRect(): ChatPanelRect {
    const rect = clampChatPanelRect(chatPanelRect.value ?? defaultChatPanelRect())
    chatPanelRect.value = rect
    return rect
  }

  const chatPanelStyle = computed(() => {
    const rect = chatPanelRect.value
    if (!rect) {
      return undefined
    }
    return {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    }
  })

  const chatPanelClass = computed(() => ({
    'call-page__chat--open': chatOpen.value,
    'call-page__chat--customized': chatPanelCustomized.value,
  }))

  function onChatPanelPointerMove(ev: PointerEvent): void {
    if (!chatPanelGesture) {
      return
    }
    const dx = ev.clientX - chatPanelGesture.startX
    const dy = ev.clientY - chatPanelGesture.startY
    const start = chatPanelGesture.startRect
    const next =
      chatPanelGesture.kind === 'move'
        ? { ...start, left: start.left + dx, top: start.top + dy }
        : { ...start, left: start.left + dx, width: start.width - dx, height: start.height + dy }
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      chatPanelCustomized.value = true
    }
    chatPanelRect.value = clampChatPanelRect(next)
  }

  function stopChatPanelGesture(): void {
    chatPanelGesture = null
    if (typeof window === 'undefined') {
      return
    }
    window.removeEventListener('pointermove', onChatPanelPointerMove)
    window.removeEventListener('pointerup', stopChatPanelGesture)
    window.removeEventListener('pointercancel', stopChatPanelGesture)
  }

  function startChatPanelGesture(ev: PointerEvent, kind: ChatPanelGesture['kind']): void {
    if (ev.button !== 0) {
      return
    }
    const target = ev.target
    if (kind === 'move' && target instanceof Element && target.closest('button, input, textarea, select, a')) {
      return
    }
    ev.preventDefault()
    stopChatPanelGesture()
    chatPanelGesture = {
      kind,
      startX: ev.clientX,
      startY: ev.clientY,
      startRect: ensureChatPanelRect(),
    }
    window.addEventListener('pointermove', onChatPanelPointerMove)
    window.addEventListener('pointerup', stopChatPanelGesture)
    window.addEventListener('pointercancel', stopChatPanelGesture)
  }

  function onChatPanelDragPointerDown(ev: PointerEvent): void {
    startChatPanelGesture(ev, 'move')
  }

  function onChatPanelResizePointerDown(ev: PointerEvent): void {
    startChatPanelGesture(ev, 'resize')
  }

  function syncChatPanelToViewport(): void {
    if (chatPanelRect.value) {
      chatPanelRect.value = clampChatPanelRect(chatPanelRect.value)
    }
  }

  watch(chatOpen, (open) => {
    if (!input.inCall()) {
      return
    }
    if (open) {
      void nextTick(() => {
        ensureChatPanelRect()
      })
    }
    try {
      sessionStorage.setItem(chatOpenPrefKey(), open ? '1' : '0')
    } catch {
      /* private mode */
    }
  })

  watch(
    () => [input.inCall(), input.roomId()] as const,
    ([inCall]) => {
      if (!inCall) {
        chatOpen.value = false
        return
      }
      queueMicrotask(() => {
        try {
          if (sessionStorage.getItem(chatOpenPrefKey()) === '1') {
            chatOpen.value = true
          }
        } catch {
          /* ignore */
        }
      })
    },
  )

  return {
    chatOpen,
    chatPanelClass,
    chatPanelStyle,
    onChatPanelDragPointerDown,
    onChatPanelResizePointerDown,
    stopChatPanelGesture,
    syncChatPanelToViewport,
  }
}
