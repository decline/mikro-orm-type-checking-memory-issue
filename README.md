# MikroORM 7.2.7+: `tsc` runs out of memory

Since `@mikro-orm/core` 7.2.7, type-checking [`src/repro.ts`](src/repro.ts) runs out of memory. It only depends on `@mikro-orm/core` and `typescript`.

```sh
npm install
npm run check
```

`npm run check` runs `tsc --noEmit` with a 2 GB heap:

| `@mikro-orm/core` | Result                                           |
| ----------------- | ------------------------------------------------ |
| 7.2.6             | passes, ~272k instantiations, ~0.4 GB            |
| 7.2.7, 7.2.8      | `FATAL ERROR: ... JavaScript heap out of memory` |

## What triggers it

Two declarations in one program:

```ts
export type Query = { [K in "$eq"]: string };

export declare const options: Parameters<EntityRepository<Prompt>["findAll"]>;
```

`Parameters<...['findAll']>` is what mock helpers such as `vi.mocked()` evaluate for a mocked repository method. The mapped type over `$eq` is what Mongo-style query types contain, e.g. CASL's `MongoQuery` (`@casl/ability`), which is how we ran into it.

On 7.2.8 each of these passes:

| Change                                                              | Result                       |
| ------------------------------------------------------------------- | ---------------------------- |
| remove the `Query` line                                             | passes, ~345k instantiations |
| move the `Query` line below `options`                               | passes, ~345k instantiations |
| use the key `$foo` instead of `$eq`                                 | passes, ~345k instantiations |
| revert `ExpandProperty` in `typings.d.ts` to its 7.2.6 form (below) | passes, ~332k instantiations |

```ts
// 7.2.8
type ExpandPropertyOf<T, R> = T extends LazyRef.Brand<infer U> ? unknown extends U ? NotLazyRef<U, NonNullable<R>> : NonNullable<U> : ...
// 7.2.6
export type ExpandProperty<T> = T extends LazyRef.Brand<infer U> ? NonNullable<U> : ...
```

`ExpandProperty` changed in mikro-orm/mikro-orm#8564 (record types no longer treated as `LazyRef`) and mikro-orm/mikro-orm#8589. The plain revert breaks mikro-orm/mikro-orm#8564's record case.

## Possible fix

Checking for the brand key instead of `any` in the record branch keeps the expectations of mikro-orm/mikro-orm#8564's test and avoids the blowup:

```ts
type ExpandPropertyOf<T, R> =
  T extends LazyRef.Brand<infer U>
    ? unknown extends U
      ? typeof LazyRef.__lazyRef extends keyof R
        ? U
        : NonNullable<R>
      : NonNullable<U>
    : ...
```

| Variant | mikro-orm/mikro-orm#8564's `ExpandProperty` expectations | This repro |
|---|---|---|
| 7.2.8 | pass | heap out of memory |
| revert to 7.2.6 | `Record<string, number>` case fails | ~332k instantiations |
| possible fix | pass | ~314k instantiations |

A record's `keyof` is `string`, which doesn't contain the brand's unique symbol key, so it keeps its own type, while `LazyRef<any>` still has the key and stays `any`. `T` isn't referenced inside the brand branch (see mikro-orm/mikro-orm#8589). Not checked against MikroORM's type benchmarks.
