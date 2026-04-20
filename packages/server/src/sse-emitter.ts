export interface SseWriter {
  write(data: string): void;
}

export class SseEmitter {
  private readonly clients = new Set<SseWriter>();

  addClient(writer: SseWriter): void {
    this.clients.add(writer);
  }

  removeClient(writer: SseWriter): void {
    this.clients.delete(writer);
  }

  emit(name: string, data: unknown): void {
    const message = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach(client => client.write(message));
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
