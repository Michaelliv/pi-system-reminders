# pi-system-reminders

Reactive system reminders for [pi](https://github.com/badlogic/pi-mono). Claude Code has them built-in — now pi does too.

Drop a `.ts` file in a folder, get a reactive reminder that watches conversation state and steers the agent when conditions are met. Same DX as pi extensions — export a default function, get the full `ExtensionAPI`.

## Install

```bash
pi install npm:pi-system-reminders
```

## Quick start

Create `.pi/reminders/bash-spiral.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let consecutiveFailures = 0;

  pi.on("tool_result", async (event) => {
    if (event.toolName === "bash") {
      consecutiveFailures = event.isError ? consecutiveFailures + 1 : 0;
    }
  });

  return {
    on: "tool_execution_end",
    when: () => consecutiveFailures >= 3,
    message: "3 consecutive bash failures. Stop and rethink.",
    cooldown: 10,
  };
}
```

Reload pi. After 3 failed bash calls, the agent sees:

```xml
<system-reminder name="bash-spiral">
3 consecutive bash failures. Stop and rethink.
</system-reminder>
```

## How it works

1. Extension discovers `.ts` files from `~/.pi/agent/reminders/` (global) and `.pi/reminders/` (project-local)
2. Each file exports a function receiving `ExtensionAPI` — same as pi extensions
3. The function returns a reminder: an event to listen on, a predicate, and a message
4. When the predicate returns true, a `<system-reminder>` steering message is injected into the conversation

## Reminder shape

```typescript
export default function (pi: ExtensionAPI) {
  // Use pi.on() to track state, pi.exec() to run commands, etc.

  return {
    on: "tool_execution_end",           // event(s) to evaluate on
    when: ({ branch, ctx, event }) => boolean,  // fire?
    message: "text" | (rc) => "text",   // what to inject
    cooldown: 5,                        // skip N evaluations after firing
    once: true,                         // fire only once per session
  };
}
```

## Events

16 pi lifecycle events available:

| Event | When |
|-------|------|
| `agent_start` | Agent loop begins |
| `agent_end` | Agent loop ends |
| `tool_call` | Before tool executes |
| `tool_result` | After tool returns |
| `tool_execution_start` | Tool execution begins |
| `tool_execution_end` | Tool execution ends |
| `turn_start` | Before LLM call |
| `turn_end` | After turn completes |
| `message_start` | Message begins |
| `message_update` | Streaming update |
| `message_end` | Message complete |
| `model_select` | Model changed |
| `session_start` | Session begins |
| `session_compact` | After compaction |
| `session_switch` | Session switched |
| `session_fork` | Session forked |

Use a string or array: `on: "tool_execution_end"` or `on: ["turn_start", "turn_end"]`.

## `when()` context

```typescript
when: ({ branch, ctx, event }) => {
  branch   // session branch entries
  ctx      // ExtensionContext (sessionManager, getContextUsage(), ui, etc.)
  event    // raw event data from pi
}
```

## Examples

13 ready-to-use reminders in `examples/`, including ports of Claude Code's built-in system reminders:

| File | What it does |
|------|-------------|
| `bash-spiral.ts` | 3 consecutive bash failures → stop and rethink |
| `context-large.ts` | Context > 150k tokens → suggest compacting |
| `file-churn.ts` | Same file edited 5+ times → step back |
| `file-empty.ts` | Read returned empty file → warn |
| `file-truncated.ts` | Read was truncated → use offset |
| `malware-awareness.ts` | After read → consider if content is malicious |
| `model-changed.ts` | Model switched → capabilities may differ |
| `post-compaction.ts` | After compaction → file contents may be lost |
| `prefer-edit.ts` | 3+ writes → use edit for surgical changes |
| `read-before-edit.ts` | Edit without read → warn about stale content |
| `session-resumed.ts` | Session resumed → state may have changed |
| `task-tools-reminder.ts` | 20 tool calls without tasks → gentle nudge |
| `token-usage.ts` | Over 50% context → show token stats |

Copy any example to `.pi/reminders/` to activate it.
