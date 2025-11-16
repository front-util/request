import Type from 'typebox';

import { createApiClient, createRepository, createStoresForKeys, createStoreWithRepo, RequestConfigData } from '../src/index';

const getTestTypes = {
    name         : 'getTestTypes' as const,
    method       : 'get',
    path         : '/test/types',
    responseModel: Type.Object({
        res1: Type.Integer(),
        res2: Type.Integer(),
        res3: Type.Integer(),
    }),
} satisfies RequestConfigData;

const shareTest = {
    name     : 'shareTest' as const,
    method   : 'post',
    path     : '/test/share',
    bodyModel: Type.Object({
        value1: Type.Integer(),
        value2: Type.Integer(),
        value3: Type.Integer(),
    }),
} satisfies RequestConfigData;

const addTestItemRead = {
    name       : 'addTestItemRead' as const,
    method     : 'put',
    path       : '/test/read/:id',
    paramsModel: Type.Object({
        id: Type.Integer(),
    }),
    responseModel: Type.Object({
        testArray: Type.Array(Type.Integer()),
    }),
} satisfies RequestConfigData;

const requestConfigs = [
    getTestTypes,
    shareTest,
    addTestItemRead
];

const apiClient = createApiClient({
    baseURL: 'http://test.ru',
});

export const testRepository = createRepository(requestConfigs, apiClient);

const testStore1 = testRepository.getTestTypes({});
const testStore2 = testRepository.shareTest({});
const testStore3 = testRepository.addTestItemRead({});

testStore1.request({});
testStore2.request({body: {
    value1: 1,
    value2: 1,
    value3: 1,
},});
testStore3.request({
    urlParams: {
        id: 1,
    },
});

if(testStore1.$state.value.type === 'success') {
    const testData1 = testStore1.$state.value.data;

    console.log('%c log', 'background: #222; color: #bada55', testData1);
}

if(testStore2.$state.value.type === 'success') {
    const testData2 = testStore2.$state.value.data;

    console.log('%c log', 'background: #222; color: #bada55', testData2);
}

const {
    data1,
    data2,
} = createStoresForKeys(testRepository, ['addTestItemRead', 'getTestTypes'], (stores) => ({
    data1: stores.addTestItemRead.$state.value.data,
    data2: stores.getTestTypes.$state.value.data,
}));

const createStore = createStoreWithRepo(testRepository);

const {
    data12,
    data22,
} = createStore(['addTestItemRead', 'getTestTypes'], (stores) => ({
    data12: stores.addTestItemRead.$state.value.data,
    data22: stores.getTestTypes.$state.value.data,
}));

console.log('%c testlog', 'background: #222; color: #bada55', {
    data1,
    data12,
    data2,
    data22,
});
