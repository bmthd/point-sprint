# Handler imports

Server functions and route handlers load Worker-dependent modules with `import()` inside their handlers.
These modules transitively import `cloudflare:workers`, which the test runtime cannot
resolve. Keeping the imports inside handlers lets tests import server functions, routes, and
their callers without loading the Workers runtime. Preserve this boundary when moving
imports; type-only imports can stay at module scope.
