export default async function globalTeardown(): Promise<void> {
  await globalThis.__INTEGRATION_POSTGRES__?.stop();
}
