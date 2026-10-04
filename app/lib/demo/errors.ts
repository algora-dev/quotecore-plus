export class DemoError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = 'demo_error') {
    super(message); this.name = 'DemoError';
  }
}
