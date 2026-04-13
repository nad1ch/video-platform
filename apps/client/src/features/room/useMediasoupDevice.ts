import type { RtpCapabilities } from 'mediasoup-client/types'
import { Device } from 'mediasoup-client'
import { onUnmounted, ref, shallowRef } from 'vue'

export function useMediasoupDevice() {
  const device = shallowRef<Device | null>(null)
  const loaded = ref(false)

  async function loadDevice(routerRtpCapabilities: RtpCapabilities): Promise<void> {
    if (loaded.value && device.value) {
      return
    }

    if (!device.value) {
      device.value = new Device()
    }

    await device.value.load({ routerRtpCapabilities })
    loaded.value = true
  }

  function reset(): void {
    device.value = null
    loaded.value = false
  }

  onUnmounted(() => {
    reset()
  })

  return {
    device,
    loaded,
    loadDevice,
    reset,
  }
}
