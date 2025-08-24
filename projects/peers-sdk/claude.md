---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/claude.md'
---
Here’s a summary of our discussions on Dependency Injection (DI) and a guide for implementing your own simple DI library with decorators, without requiring reflect-metadata.

⸻

🧠 Summary of DI Discussions
	•	You’ve mostly avoided formal DI up to this point, managing dependencies manually.
	•	You’re now facing enough complexity that a centralized DI system feels necessary.
	•	You’re interested in decorators for ergonomics but want to avoid reflect-metadata due to:
	•	Compatibility concerns, especially with React Native.
	•	The need for tight control over behavior and minimal dependencies.
	•	You considered libraries like:
	•	NestJS DI: Powerful but tightly coupled to reflect-metadata and complex.
	•	tsyringe: Decorator-based and simpler, but also requires reflect-metadata.
	•	You’re leaning toward building your own simple DI system, tailored for your use case.

⸻

⚙️ Instructions to Build a Simple DI Library with Decorators (No reflect-metadata)

Step 1: Define a basic container

type Constructor<T = any> = new (...args: any[]) => T;

class Container {
  private singletons = new Map<string | symbol | Constructor, any>();
  private providers = new Map<string | symbol | Constructor, Constructor>();

  register<T>(token: string | symbol | Constructor<T>, provider: Constructor<T>) {
    this.providers.set(token, provider);
  }

  resolve<T>(token: string | symbol | Constructor<T>): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token);
    }

    const provider = this.providers.get(token);
    if (!provider) throw new Error(`No provider found for token: ${token.toString()}`);

    // Manual injection via static `inject` property
    const deps = (provider as any).inject?.map((dep: any) => this.resolve(dep)) ?? [];
    const instance = new provider(...deps);
    this.singletons.set(token, instance);
    return instance;
  }
}

export const container = new Container();


⸻

Step 2: Create decorators

export function Injectable(...deps: any[]) {
  return function <T extends Constructor>(target: T) {
    (target as any).inject = deps;
    container.register(target, target);
  };
}

Usage:

@Injectable()
class Logger {
  log(msg: string) {
    console.log(msg);
  }
}

@Injectable(Logger)
class Service {
  constructor(private logger: Logger) {}
  doSomething() {
    this.logger.log("Service did something");
  }
}


⸻

Step 3: Resolve and use

const service = container.resolve(Service);
service.doSomething();


⸻

✅ Advantages
	•	No reflect-metadata needed.
	•	Works in browsers and React Native.
	•	Clear, explicit dependencies.
	•	Easy to extend (e.g., for scoped instances or factories).

⚠️ Limitations
	•	You must declare dependencies manually via @Injectable(...).
	•	No property injection (constructor-only).
	•	No circular dependency support (without extra logic).


Instructions to Claude: improve on the discussion above.  Write out your own recommendations for how we can implement a very simple and isomorphic DI library for peers-sdk.
I think the main things that need DI are tables and some kind of factory or container for the persistentVars.  The most trouble is coming from them being instantiated when the module is imported.  This makes it so we can't control when they are instantiated so multiple instances of the peers-sdk library produce multiple instances of the instantiations.  

What we want is a single top-level DI container that we can inject into downstream dependencies (like peers-ui, peers-electron, peers-react-native, peers-device, etc) and it's okay if they all are using their own instance of the peers-sdk because that is just types and static code.  The state will all be shared (if needed) by one dependency's main file instantiating the DI container and injecting that into the rest of the upstream dependencies.  

Write out your thoughts and recommendations to injection.md.  Keep it simple and concise.  
