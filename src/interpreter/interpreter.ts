import { TokenType, Token } from '../lexer/token';
import {
    Expr, Stmt,
    BinaryExpr, LogicalExpr, UnaryExpr, CallExpr,
    WhileStmt, ForStmt, FunctionDeclStmt
} from '../parser/ast';
import { Environment } from './environment';
import { RuntimeError } from '../errors';
import { NoobCallable } from './callable';

// ── Control-flow signals ─────────────────────
// execute() returns how a statement finished. `gg` (return) and
// `ragequit` (break) propagate up as plain return values, which is much
// cheaper than throwing exceptions to unwind the stack.

const enum Signal {
    Normal,
    Break,
    Return, // value is stashed in Interpreter.returnValue
}

// ── Values ───────────────────────────────────

export function stringify(value: any): string {
    if (value === null || value === undefined) return 'nihil';
    return String(value);
}

export function isTruthy(value: any): boolean {
    if (value === null) return false;
    if (typeof value === 'boolean') return value;
    return true; // 0 and "" are truthy in this design — change if you'd rather match JS/Python
}

// ── User-defined functions ───────────────────

class NoobFunction extends NoobCallable {
    constructor(
        private readonly declaration: FunctionDeclStmt,
        private readonly closure: Environment
    ) {
        super();
    }

    get arity(): number {
        return this.declaration.params.length;
    }

    call(interpreter: Interpreter, args: any[]): any {
        // New scope for this call, chained to where the function was DEFINED
        // (not where it was called from) — this is what makes closures work.
        const env = new Environment(this.closure);

        const params = this.declaration.params;
        for (let i = 0; i < params.length; i++) {
            env.define(params[i].value, args[i], false);
        }

        if (interpreter.executeBlock(this.declaration.body, env) === Signal.Return) {
            return interpreter.takeReturnValue();
        }
        return null; // no explicit gg -> implicit nihil return
    }

    toString(): string {
        return `<queue ${this.declaration.name.value}>`;
    }
}

// ── Interpreter ───────────────────────────────

export class Interpreter {
    private environment: Environment;
    private returnValue: any = null;

    constructor(private readonly globals: Environment = new Environment()) {
        this.environment = globals;
    }

    // Runtime errors propagate to the caller (Runtime), which reports them.
    public interpret(statements: Stmt[]) {
        this.environment = this.globals;
        for (const stmt of statements) {
            this.execute(stmt);
        }
    }

    public takeReturnValue(): any {
        const value = this.returnValue;
        this.returnValue = null;
        return value;
    }

    // ── Statement execution ─────────────────

    private execute(stmt: Stmt): Signal {
        switch (stmt.kind) {
            case 'VarDecl': {
                const value = stmt.initializer !== null ? this.evaluate(stmt.initializer) : null;
                this.environment.define(stmt.name.value, value, stmt.isConst);
                return Signal.Normal;
            }
            case 'Print':
                console.log(stringify(this.evaluate(stmt.expression)));
                return Signal.Normal;
            case 'ExpressionStmt':
                this.evaluate(stmt.expression);
                return Signal.Normal;
            case 'Block':
                return stmt.scoped
                    ? this.executeBlock(stmt.statements, new Environment(this.environment))
                    : this.executeStatements(stmt.statements);
            case 'If':
                if (isTruthy(this.evaluate(stmt.condition))) return this.execute(stmt.thenBranch);
                if (stmt.elseBranch !== null) return this.execute(stmt.elseBranch);
                return Signal.Normal;
            case 'While':
                return this.execWhile(stmt);
            case 'For':
                return this.execFor(stmt);
            case 'FunctionDecl':
                this.environment.define(stmt.name.value, new NoobFunction(stmt, this.environment), false);
                return Signal.Normal;
            case 'Return':
                this.returnValue = stmt.value !== null ? this.evaluate(stmt.value) : null;
                return Signal.Return;
            case 'Break':
                return Signal.Break;
        }
    }

    private executeStatements(statements: Stmt[]): Signal {
        for (const stmt of statements) {
            const signal = this.execute(stmt);
            if (signal !== Signal.Normal) return signal;
        }
        return Signal.Normal;
    }

    public executeBlock(statements: Stmt[], env: Environment): Signal {
        const previous = this.environment;
        this.environment = env;
        try {
            return this.executeStatements(statements);
        } finally {
            // Always restore the outer scope, even if a runtime error unwinds through here.
            this.environment = previous;
        }
    }

    private execWhile(stmt: WhileStmt): Signal {
        while (isTruthy(this.evaluate(stmt.condition))) {
            const signal = this.execute(stmt.body);
            if (signal === Signal.Break) break;
            if (signal === Signal.Return) return signal;
        }
        return Signal.Normal;
    }

    private execFor(stmt: ForStmt): Signal {
        const previous = this.environment;
        this.environment = new Environment(previous);

        try {
            if (stmt.initializer !== null) this.execute(stmt.initializer);

            while (stmt.condition === null || isTruthy(this.evaluate(stmt.condition))) {
                const signal = this.execute(stmt.body);
                if (signal === Signal.Break) break;
                if (signal === Signal.Return) return signal;
                if (stmt.increment !== null) this.evaluate(stmt.increment);
            }
            return Signal.Normal;
        } finally {
            this.environment = previous;
        }
    }

    // ── Expression evaluation ────────────────

    private evaluate(expr: Expr): any {
        switch (expr.kind) {
            case 'Literal':
                return expr.value;
            case 'Grouping':
                return this.evaluate(expr.expression);
            case 'Variable':
                return expr.depth === undefined
                    ? this.globals.get(expr.name)
                    : this.environment.getAt(expr.depth, expr.name);
            case 'Assign': {
                const value = this.evaluate(expr.value);
                if (expr.depth === undefined) this.globals.assign(expr.name, value);
                else this.environment.assignAt(expr.depth, expr.name, value);
                return value;
            }
            case 'Logical':
                return this.evalLogical(expr);
            case 'Unary':
                return this.evalUnary(expr);
            case 'Binary':
                return this.evalBinary(expr);
            case 'Call':
                return this.evalCall(expr);
        }
    }

    // Short-circuits and returns the deciding operand, like JS.
    private evalLogical(expr: LogicalExpr): any {
        const left = this.evaluate(expr.left);
        if (expr.operator.type === TokenType.OR) {
            if (isTruthy(left)) return left;
        } else if (!isTruthy(left)) {
            return left;
        }
        return this.evaluate(expr.right);
    }

    private evalUnary(expr: UnaryExpr): any {
        const right = this.evaluate(expr.right);

        switch (expr.operator.type) {
            case TokenType.MINUS:
                this.checkNumberOperand(expr.operator, right);
                return -right;
            case TokenType.BANG:
                return !isTruthy(right);
        }

        throw new RuntimeError(expr.operator, `Unknown unary operator.`);
    }

    private evalBinary(expr: BinaryExpr): any {
        const left = this.evaluate(expr.left);
        const right = this.evaluate(expr.right);
        const op = expr.operator;

        switch (op.type) {
            case TokenType.PLUS:
                // supports both number addition and string concatenation
                if (typeof left === 'number' && typeof right === 'number') return left + right;
                if (typeof left === 'string' || typeof right === 'string') {
                    return stringify(left) + stringify(right);
                }
                throw new RuntimeError(op, `Operands of '+' must be numbers or strings.`);

            case TokenType.MINUS:
                this.checkNumberOperands(op, left, right);
                return left - right;
            case TokenType.STAR:
                this.checkNumberOperands(op, left, right);
                return left * right;
            case TokenType.SLASH:
                this.checkNumberOperands(op, left, right);
                if (right === 0) throw new RuntimeError(op, `Division by zero.`);
                return left / right;
            case TokenType.PERCENT:
                this.checkNumberOperands(op, left, right);
                if (right === 0) throw new RuntimeError(op, `Modulo by zero.`);
                return left % right;

            case TokenType.GREATER:
                this.checkNumberOperands(op, left, right);
                return left > right;
            case TokenType.GREATER_EQUAL:
                this.checkNumberOperands(op, left, right);
                return left >= right;
            case TokenType.LESS:
                this.checkNumberOperands(op, left, right);
                return left < right;
            case TokenType.LESS_EQUAL:
                this.checkNumberOperands(op, left, right);
                return left <= right;

            case TokenType.EQUAL_EQUAL:
                return left === right;
            case TokenType.BANG_EQUAL:
                return left !== right;
        }

        throw new RuntimeError(op, `Unknown binary operator.`);
    }

    private evalCall(expr: CallExpr): any {
        const callee = this.evaluate(expr.callee);

        if (!(callee instanceof NoobCallable)) {
            throw new RuntimeError(expr.paren, `Can only call functions (queue), got '${stringify(callee)}'.`);
        }

        if (expr.args.length !== callee.arity) {
            throw new RuntimeError(
                expr.paren,
                `${callee} expected ${callee.arity} arguments but got ${expr.args.length}.`
            );
        }

        const args = new Array(expr.args.length);
        for (let i = 0; i < args.length; i++) {
            args[i] = this.evaluate(expr.args[i]);
        }

        return callee.call(this, args, expr.paren);
    }

    // ── Helpers ───────────────────────────────

    private checkNumberOperand(op: Token, operand: any) {
        if (typeof operand === 'number') return;
        throw new RuntimeError(op, `Operand of '${op.value}' must be a number.`);
    }

    private checkNumberOperands(op: Token, left: any, right: any) {
        if (typeof left === 'number' && typeof right === 'number') return;
        throw new RuntimeError(op, `Operands of '${op.value}' must be numbers.`);
    }
}
