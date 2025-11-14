import type { CreatorRepository, RepositoryRequestConfig, RequestConfigData, StoresForKeys } from './types';

function getConfig<T extends readonly RequestConfigData[], Repo extends CreatorRepository<T>, Key extends keyof Repo = keyof Repo>(c: Key | {name: Key; config: RepositoryRequestConfig}) {
    const isConfig = typeof c === 'object' && c !== null && 'name' in c;

    return {
        name  : isConfig ? c.name : c,
        config: isConfig ? c.config : {},
    };
}
export function createStoresForKeys<
    Configs extends readonly RequestConfigData[],
    Repo extends CreatorRepository<Configs>,
    Keys extends readonly (keyof Repo)[],
    CustomStore extends object,
>(
    repository: Repo,
    configs: Keys | {name: Keys[number]; config: RepositoryRequestConfig}[],
    createCustomStore: (store: StoresForKeys<Configs, Repo, Keys>) => CustomStore
){
    const stores = {} as StoresForKeys<Configs, Repo, Keys>;

    for(const configItem of configs) {
        const {name, config,} = getConfig<Configs, Repo>(configItem);
        const factory = repository[name];

        if(typeof factory !== 'function') {
            console.error(`Factory for repo key ${String(name)} is not a function`, configItem);
            continue;
        }
        stores[name] = factory(config) as ReturnType<Repo[typeof name]>;
    }

    const customStore = createCustomStore(stores);

    function destroyAll() {
        const storeItems: ReturnType<Repo[Keys[number]]>[] = Object.values(stores);

        for(const store of storeItems) {
            store?.destroy?.();
        }
    }

    return {
        ...stores,
        ...customStore,
        destroyAll,
    } as const;
}

export function createStoreWithRepo<
    Configs extends readonly RequestConfigData[],
    Repo extends CreatorRepository<Configs>,
>(repository: Repo) {
    return function<Keys extends readonly (keyof Repo)[], CustomStore extends object,>( 
        configs: Keys | {name: Keys[number]; config: RepositoryRequestConfig}[],
        createCustomStore: (store: StoresForKeys<Configs, Repo, Keys>) => CustomStore
    ) {
        return createStoresForKeys(repository, configs, createCustomStore);
    };
}