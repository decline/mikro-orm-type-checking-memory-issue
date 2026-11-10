import { defineEntity, p, type EntityRepository } from '@mikro-orm/core';

// a mapped type over the key `$eq`, e.g. from a Mongo-style query library
export type Query = { [K in '$eq']: string };

const promptSchema = defineEntity({
  name: 'Prompt',
  properties: {
    name: p.string().primary(),
    text: p.text(),
  },
});

class Prompt extends promptSchema.class {}
promptSchema.setClass(Prompt);

// what mock helpers such as `vi.mocked()` evaluate for `repository.findAll`
export declare const options: Parameters<EntityRepository<Prompt>['findAll']>;
