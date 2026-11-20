import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Runtime } from '../src/runtime/runtime';

// Runs NoobScript source and captures everything it prints.
function run(source: string, runtime?: Runtime) {
    const out: string[] = [];
    const err: string[] = [];
    const rt = runtime ?? new Runtime({ out: (s) => out.push(s), err: (s) => err.push(s) });
    const ok = rt.run(source);
    return { ok, out, err };
}

test('prints values, nihil for null', () => {
    const r = run('chat("hi"); chat(1 + 2); chat(nihil);');
    assert.deepEqual(r.out, ['hi', '3', 'nihil']);
});

test('arithmetic precedence and string concatenation', () => {
    assert.deepEqual(run('chat(2 + 3 * 4); chat("a" + 1);').out, ['14', 'a1']);
});

test('functions, recursion and closures', () => {
    const r = run(`
        queue fib(n) { skillcheck (n < 2) { gg n; } gg fib(n - 1) + fib(n - 2); }
        chat(fib(10));
        queue counter() { vibe c = 0; queue inc() { c = c + 1; gg c; } gg inc; }
        vibe next = counter();
        next(); chat(next());
    `);
    assert.deepEqual(r.out, ['55', '2']);
});

test('loops with ragequit', () => {
    const r = run('farm (vibe i = 0; i < 10; i = i + 1) { skillcheck (i == 3) { ragequit; } chat(i); }');
    assert.deepEqual(r.out, ['0', '1', '2']);
});

test('closures capture the variable in scope where they were written', () => {
    const r = run(`
        vibe a = "global";
        {
            queue show() { chat(a); }
            show();
            vibe a = "local";
            show();
        }
    `);
    assert.deepEqual(r.out, ['global', 'global']);
});

test('lockedin variables cannot be reassigned', () => {
    const r = run('lockedin x = 1; x = 2;');
    assert.equal(r.ok, false);
    assert.match(r.err[0], /Runtime error: Cannot assign to lockedin/);
});

test('runtime errors report the line', () => {
    const r = run('chat(1);\nchat(1 / 0);');
    assert.equal(r.ok, false);
    assert.deepEqual(r.out, ['1']);
    assert.match(r.err[0], /^\[line 2\] Runtime error: Division by zero/);
});

test('syntax errors stop execution before anything runs', () => {
    const r = run('chat("before");\nvibe = 3;');
    assert.equal(r.ok, false);
    assert.deepEqual(r.out, []);
    assert.match(r.err[0], /^\[line 2\] Syntax error/);
});

test('resolver rejects gg and ragequit in the wrong place', () => {
    assert.match(run('gg 1;').err[0], /outside of a queue/);
    assert.match(run('ragequit;').err[0], /outside of a loop/);
});

test('built-ins validate their arguments', () => {
    assert.match(run('rng(3, 1);').err[0], /min <= max/);
    assert.match(run('rng(1.5, 2);').err[0], /whole numbers/);
    assert.match(run('num("Infinity");').err[0], /can't convert/);
    assert.deepEqual(run('chat(num("42") + 1); chat(len("abc"));').out, ['43', '3']);
});

test('arity is checked on calls', () => {
    assert.match(run('queue f(a) { gg a; } f();').err[0], /expected 1 arguments but got 0/);
});

test('deep recursion reports a stack overflow instead of crashing', () => {
    const r = run('queue f() { gg f(); } f();');
    assert.equal(r.ok, false);
    assert.match(r.err[0], /Stack overflow/);
});

test('REPL-style runtime keeps globals between runs and recovers from errors', () => {
    const out: string[] = [];
    const rt = new Runtime({ out: (s) => out.push(s), err: () => {} });
    rt.run('vibe x = 5;');
    assert.equal(rt.run('chat(oops);'), false);
    rt.run('chat(x * 2);');
    assert.deepEqual(out, ['10']);
});
