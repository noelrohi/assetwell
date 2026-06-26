import { mock } from "bun:test"
import { EventEmitter } from "node:events"
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptionsWithoutStdio,
} from "node:child_process"

type ProcessSignal = NodeJS.Signals | null

type ProcessEventMap = {
  close: [code: number | null, signal: ProcessSignal]
  error: [error: NodeJS.ErrnoException]
}

class FakeStream extends EventEmitter {
  setEncoding(_encoding: BufferEncoding) {
    return this
  }

  writeData(chunk: string) {
    this.emit("data", chunk)
  }
}

export class FakeChildProcess extends EventEmitter {
  readonly stdout = new FakeStream()
  readonly stderr = new FakeStream()
  readonly kill = mock((_signal?: NodeJS.Signals | number) => {
    void this.close(null, "SIGTERM")
    return true
  })

  async close(exitCode: number | null = 0, signal: ProcessSignal = null) {
    await this.emitAndWait("close", exitCode, signal)
  }

  async fail(error: NodeJS.ErrnoException) {
    await this.emitAndWait("error", error)
  }

  private async emitAndWait<EventName extends keyof ProcessEventMap>(
    eventName: EventName,
    ...args: ProcessEventMap[EventName]
  ) {
    for (const listener of this.listeners(eventName)) {
      await (
        listener as (...listenerArgs: ProcessEventMap[EventName]) => unknown
      )(...args)
    }
  }
}

export interface SpawnCall {
  command: string
  args: string[]
  options: SpawnOptionsWithoutStdio
  child: FakeChildProcess
}

export interface CompleteSpawnOptions {
  stdout?: string | readonly string[]
  stderr?: string | readonly string[]
  exitCode?: number | null
  signal?: ProcessSignal
}

export const spawnCalls: SpawnCall[] = []

export function resetSpawnMock() {
  spawnCalls.length = 0
}

export function lastSpawn() {
  const call = spawnCalls.at(-1)
  if (!call) throw new Error("No process has been spawned.")
  return call
}

export async function completeSpawn(
  call: SpawnCall,
  options: CompleteSpawnOptions = {},
) {
  for (const chunk of chunks(options.stdout)) call.child.stdout.writeData(chunk)
  for (const chunk of chunks(options.stderr)) call.child.stderr.writeData(chunk)
  await call.child.close(options.exitCode ?? 0, options.signal ?? null)
}

export async function completeLastSpawn(options: CompleteSpawnOptions = {}) {
  await completeSpawn(lastSpawn(), options)
}

function chunks(value: string | readonly string[] | undefined) {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function spawnFake(
  command: string,
  args: readonly string[] = [],
  options: SpawnOptionsWithoutStdio = {},
) {
  const child = new FakeChildProcess()
  spawnCalls.push({ command, args: [...args], options, child })
  return child as unknown as ChildProcessWithoutNullStreams
}

mock.module("node:child_process", () => ({ spawn: spawnFake }))
