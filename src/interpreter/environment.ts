import { Token } from '../lexer/token';
import { RuntimeError } from '../errors';

interface Binding {
    value: any;
    isConst: boolean;
}

export class Environment {
    private readonly values = new Map<string, Binding>();

    constructor(public readonly enclosing: Environment | null = null) {}

    define(name: string, value: any, isConst: boolean) {
        // Note: redeclaring in the same scope silently overwrites for now.
        // Add a check here later if you want NoobScript to error on redeclaration.
        this.values.set(name, { value, isConst });
    }

    // Lookup by walking the scope chain — used for globals.
    get(name: Token): any {
        return this.find(name).value;
    }

    assign(name: Token, value: any) {
        this.setBinding(this.find(name), name, value);
    }

    // Fast path for locals: the resolver already knows exactly which scope holds the variable.
    getAt(distance: number, name: Token): any {
        return this.ancestor(distance).find(name).value;
    }

    assignAt(distance: number, name: Token, value: any) {
        this.setBinding(this.ancestor(distance).find(name), name, value);
    }

    private ancestor(distance: number): Environment {
        let env: Environment = this;
        for (let i = 0; i < distance; i++) env = env.enclosing!;
        return env;
    }

    private find(name: Token): Binding {
        let env: Environment | null = this;
        while (env !== null) {
            const binding = env.values.get(name.value);
            if (binding !== undefined) return binding;
            env = env.enclosing;
        }
        throw new RuntimeError(name, `Undefined variable '${name.value}'.`);
    }

    private setBinding(binding: Binding, name: Token, value: any) {
        if (binding.isConst) {
            throw new RuntimeError(name, `Cannot assign to lockedin (const) variable '${name.value}'.`);
        }
        binding.value = value;
    }
}
