import { onUnmounted, shallowRef } from 'vue'

export function useLocalMedia() {
  const localStream = shallowRef<MediaStream | null>(null)

  async function startLocalMedia(): Promise<MediaStream> {
    stopLocalMedia()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    })
    localStream.value = stream
    return stream
  }

  function stopLocalMedia(): void {
    const stream = localStream.value
    if (!stream) {
      return
    }
    for (const track of stream.getTracks()) {
      track.stop()
    }
    localStream.value = null
  }

  onUnmounted(() => {
    stopLocalMedia()
  })

  return {
    localStream,
    startLocalMedia,
    stopLocalMedia,
  }
}
