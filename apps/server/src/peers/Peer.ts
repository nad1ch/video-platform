import WebSocket from 'ws'
import type { Consumer, Producer, WebRtcTransport } from 'mediasoup/node/lib/types'

export class Peer {
  readonly id: string
  readonly socket: WebSocket
  readonly roomId: string

  private readonly transports = new Map<string, WebRtcTransport>()
  private readonly producers = new Map<string, Producer>()
  private readonly consumers = new Map<string, Consumer>()

  constructor(id: string, socket: WebSocket, roomId: string) {
    this.id = id
    this.socket = socket
    this.roomId = roomId
  }

  sendJson(payload: unknown): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload))
    }
  }

  addTransport(transport: WebRtcTransport): void {
    this.transports.set(transport.id, transport)
  }

  getTransport(transportId: string): WebRtcTransport | undefined {
    return this.transports.get(transportId)
  }

  removeTransport(transportId: string): void {
    const transport = this.transports.get(transportId)
    if (transport && !transport.closed) {
      transport.close()
    }
    this.transports.delete(transportId)
  }

  closeTransportsForDirection(direction: 'send' | 'recv'): void {
    for (const transport of [...this.transports.values()]) {
      const appData = transport.appData as { direction?: string }
      if (appData?.direction === direction) {
        this.removeTransport(transport.id)
      }
    }
  }

  addProducer(producer: Producer): void {
    this.producers.set(producer.id, producer)
  }

  getProducer(producerId: string): Producer | undefined {
    return this.producers.get(producerId)
  }

  removeProducer(producerId: string): void {
    const producer = this.producers.get(producerId)
    if (producer && !producer.closed) {
      producer.close()
    }
    this.producers.delete(producerId)
  }

  getProducers(): Producer[] {
    return [...this.producers.values()]
  }

  addConsumer(consumer: Consumer): void {
    this.consumers.set(consumer.id, consumer)
  }

  getConsumer(consumerId: string): Consumer | undefined {
    return this.consumers.get(consumerId)
  }

  removeConsumer(consumerId: string): void {
    const consumer = this.consumers.get(consumerId)
    if (consumer && !consumer.closed) {
      consumer.close()
    }
    this.consumers.delete(consumerId)
  }

  getConsumers(): Consumer[] {
    return [...this.consumers.values()]
  }

  closeAllMedia(): void {
    for (const consumer of [...this.consumers.values()]) {
      if (!consumer.closed) {
        consumer.close()
      }
    }
    this.consumers.clear()

    for (const producer of [...this.producers.values()]) {
      if (!producer.closed) {
        producer.close()
      }
    }
    this.producers.clear()

    for (const transport of [...this.transports.values()]) {
      if (!transport.closed) {
        transport.close()
      }
    }
    this.transports.clear()
  }
}
