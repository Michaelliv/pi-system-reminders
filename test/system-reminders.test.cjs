const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { createJiti } = require("jiti");

const jiti = createJiti(__filename, { moduleCache: false });
const extension = jiti("../index.ts").default;

function setupProject(reminderSource) {
	const cwd = mkdtempSync(join(tmpdir(), "pi-system-reminders-"));
	const remindersDir = join(cwd, ".pi", "reminders");
	mkdirSync(remindersDir, { recursive: true });
	writeFileSync(join(remindersDir, "example.ts"), reminderSource);
	return cwd;
}

function setupPi() {
	const handlers = new Map();
	const messages = [];
	const pi = {
		on(event, handler) {
			handlers.set(event, handler);
		},
		sendMessage(message, options) {
			messages.push({ message, options });
		},
	};
	return { pi, handlers, messages };
}

test("does not read the branch when no reminders match the event", async () => {
	const cwd = setupProject(`
		export default () => ({
			on: "tool_call",
			when: () => true,
			message: "tool reminder",
		});
	`);
	const { pi, handlers, messages } = setupPi();
	extension(pi);

	const ctx = {
		cwd,
		ui: { notify() {} },
		sessionManager: {
			getBranch() {
				throw new Error("getBranch should not be called");
			},
		},
	};

	await handlers.get("session_start")({}, ctx);
	await handlers.get("message_end")({}, ctx);

	assert.equal(messages.length, 0);
});

test("skips matching reminders when branch lookup is unavailable", async () => {
	const cwd = setupProject(`
		export default () => ({
			on: "message_end",
			when: () => true,
			message: "message reminder",
		});
	`);
	const { pi, handlers, messages } = setupPi();
	extension(pi);

	const ctx = {
		cwd,
		ui: { notify() {} },
		sessionManager: {
			getBranch() {
				throw new Error("branch unavailable");
			},
		},
	};

	await handlers.get("session_start")({}, ctx);
	await handlers.get("message_end")({}, ctx);

	assert.equal(messages.length, 0);
});

test("fires a matching reminder when branch lookup succeeds", async () => {
	const cwd = setupProject(`
		export default () => ({
			on: "message_end",
			when: ({ branch, event }) => branch[0].role === "user" && event.done === true,
			message: ({ branch }) => "branch length " + branch.length,
		});
	`);
	const { pi, handlers, messages } = setupPi();
	extension(pi);

	let getBranchCalls = 0;
	const ctx = {
		cwd,
		ui: { notify() {} },
		sessionManager: {
			getBranch() {
				getBranchCalls++;
				return [{ role: "user", content: "hello" }];
			},
		},
	};

	await handlers.get("session_start")({}, ctx);
	await handlers.get("message_end")({ done: true }, ctx);

	assert.equal(getBranchCalls, 1);
	assert.equal(messages.length, 1);
	assert.match(messages[0].message.content, /<system-reminder name="example">\nbranch length 1\n<\/system-reminder>/);
	assert.deepEqual(messages[0].options, { deliverAs: "steer", triggerTurn: true });
});

test("evaluates only reminders matching the current event", async () => {
	const cwd = setupProject(`
		export default () => [
			{
				on: "message_end",
				when: () => true,
				message: "matching reminder",
			},
			{
				on: "tool_call",
				when: () => { throw new Error("non-matching reminder should not run"); },
				message: "non-matching reminder",
			},
		];
	`);
	const { pi, handlers, messages } = setupPi();
	extension(pi);

	const ctx = {
		cwd,
		ui: { notify() {} },
		sessionManager: {
			getBranch() {
				return [];
			},
		},
	};

	await handlers.get("session_start")({}, ctx);
	await handlers.get("message_end")({}, ctx);

	assert.equal(messages.length, 1);
	assert.match(messages[0].message.content, /matching reminder/);
	assert.doesNotMatch(messages[0].message.content, /non-matching reminder/);
});
