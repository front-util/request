# 🚀 Front-utils/request

Современный HTTP-клиент для браузера с использованием нативного `fetch` API, реактивным состоянием, строгой типизацией и расширенными возможностями.

## ✨ Особенности

- 🔥 **Нативный fetch API** - использует встроенные возможности браузера
- ⚡ **Реактивное состояние** - интеграция с `@preact/signals` для реактивности
- 🎯 **Автоматическое кэширование** - встроенная система кэширования с TTL
- 🔄 **Дедупликация запросов** - предотвращает дублирующиеся запросы
- 🛡️ **Интерсепторы** - middleware для модификации запросов и ответов

- 📝 **Репозиторий паттерн** - типизированные запросы с TypeBox схемами

## 📦 Установка

```bash
npm install @front-utils/request
# или
yarn add @front-utils/request
# или
bun add @front-utils/request
```

## 🚀 Быстрый старт

### Базовое использование

```typescript
import { createApiClient, createRepository } from '@front-utils/request';
import Type from 'typebox';

const endpoints = [
  {
    name: 'getUsers',
    method: 'get' as const,
    path: '/users',
    responseModel: Type.Array(Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String()
    }))
  },
  {
    name: 'getUser',
    method: 'get' as const,
    path: '/users/:id',
    paramsModel: Type.Object({ id: Type.Number() }),
    responseModel: Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String()
    })
  }
] as const;

// Создаем клиент с базовым URL
const apiClient = createApiClient({
  baseURL: 'https://jsonplaceholder.typicode.com'
});

// Создаем типизированный репозиторий
const userRepository = createRepository(endpoints, apiClient);

// Получаем реактивный запрос с автоматической типизацией
const userStore = userRepository.getUser({});

// Выполняем запрос с типизированными параметрами
await userStore.request({ urlParams: { id: 1 } });

// Доступ к реактивным данным с типизацией
const state = userStore.$state.value;
if (state.type === 'success') console.log('User:', state.data); // { id: number, name: string, email: string }
```

### Использование с React

```tsx
import { createApiClient, createRepository } from '@front-utils/request';
import { useSignals } from '@preact/signals-react';
import Type from 'typebox';

const endpoints = [
  {
    name: 'getUser',
    method: 'get' as const,
    path: '/users/:id',
    paramsModel: Type.Object({ id: Type.Number() }),
    responseModel: Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String()
    })
  }
] as const;

function UserProfile({ userId }: { userId: number }) {
  const apiClient = createApiClient({ baseURL: 'https://api.example.com' });
  const userRepo = createRepository(endpoints, apiClient);
  const userStore = userRepo.getUser({});

  // Reactively update UI
  const user = userStore.state.value.type === 'success' ? userStore.state.value.data : null;
  const isLoading = userStore.state.value.type === 'loading';
  const error = userStore.state.value.type === 'error' ? userStore.state.value.error : null;

  React.useEffect(() => {
    userStore.request({ urlParams: { id: userId } });
  }, [userId]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;
  if (!user) return <div>Пользователь не найден</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

## 🔧 Конфигурация

### Базовая конфигурация клиента

```typescript
const apiClient = createApiClient({
  baseURL: 'https://api.example.com',
  requestInterceptors: [
    // Добавляем интерсепторы
    (config) => ({
      ...config,
      headers: {
        ...config.headers,
        'Authorization': 'Bearer your-token'
      }
    })
  ]
});
```

### Конфигурация запроса в репозитории

Для конфигурации запроса через репозиторий, укажите базовые параметры в конечном конфиге:

```typescript
const endpoints = [
  {
    name: 'getUser',
    method: 'get' as const,
    path: '/users/:id',
    responseModel: Type.Object({ id: Type.Number(), name: Type.String(), email: Type.String() })
  }
] as const;

const apiClient = createApiClient({
  baseURL: 'https://api.example.com',
  requestInterceptors: [/* ... */]
});

const userRepo = createRepository(endpoints, apiClient);

// Конфигурируем запрос с дополнительными параметрами
await userRepo.getUser({
  config: {
    ttl: 5 * 60 * 1000, // Кэширование 5 минут
    cacheKey: 'user-profile'
  }
}).request({ urlParams: { id: 123 } });
```

## 🎯 Репозиторий паттерн с типизированными запросами

### Создание типизированного репозитория

```typescript
import { createRepository } from '@front-utils/request';
import Type from 'typebox';

// Определяем схемы для API с типизацией
const endpoints = [
  {
    name: 'getUser',
    method: 'get' as const,
    path: '/users/:id',
    paramsModel: Type.Object({ id: Type.Number() }),
    queryModel: Type.Object({
      includePosts: Type.Optional(Type.Boolean())
    }),
    responseModel: Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String()
    })
  },
  {
    name: 'createUser',
    method: 'post' as const,
    path: '/users',
    bodyModel: Type.Object({
      name: Type.String(),
      email: Type.String()
    }),
    responseModel: Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String()
    })
  }
] as const;

// Создаем репозиторий
const userRepository = createRepository(endpoints, apiClient);

// Используем типизированные методы
const getUserStore = userRepository.getUser({});

// Выполняем запрос с параметрами (типы выводятся из схем)
await getUserStore.request({
  urlParams: { id: 123 }, // Тип: { id: number } из paramsModel
  query: { includePosts: true } // Тип: { includePosts?: boolean } из queryModel
});

// Доступ к реактивным данным
useSignals(() => {
  if (getUserStore.state.value.type === 'success') {
    console.log('User:', getUserStore.state.value.data);
  }
});

// Для повторного запроса используйте тот же вызов request

// Создание пользователя
const createUserStore = userRepository.createUser({});

await createUserStore.request({
  body: { name: 'John Doe', email: 'john@example.com' } // Тип: { name: string, email: string } из bodyModel
});
```

**Типы параметров:**
- `urlParams` - параметры пути (если `paramsModel` определена)
- `query` - query параметры (если `queryModel` определена)
- `body` - тело запроса (если `bodyModel` определена)
- `config` - дополнительные опции запроса

Типы автоматически выводятся из определенных моделей в конфигурации эндпоинтов. Если модель не определена, соответствующий параметр недоступен для передачи.




## 🔧 Расширенная конфигурация

### Кастомные интерсепторы

```typescript
// Логирование запросов
const loggingInterceptor = (config) => {
  console.log(`Making ${config.method} request to ${config.url}`);
  return config;
};

// Добавление timestamp
const timestampInterceptor = (config) => ({
  ...config,
  headers: {
    ...config.headers,
    'X-Request-Time': Date.now().toString()
  }
});

// Регистрируем интерсепторы
apiClient.interceptors.request.use(loggingInterceptor);
apiClient.interceptors.request.use(timestampInterceptor);
```

### Обработка ошибок

```typescript
// Глобальная обработка ошибок
effect(() => {
  if (store.isError.value) {
    const error = store.error.value;

    if (error instanceof HttpError) {
      // Обработка HTTP ошибок
      if (error.status === 401) {
        // Перенаправление на авторизацию
        window.location.href = '/login';
      }
    }

    if (error instanceof NetworkError) {
      // Показать уведомление об ошибке сети
      showNotification('Network error occurred', 'error');
    }
  }
});
```

## 🛠️ API Reference

### `createApiClient(config?)`

Создает экземпляр API клиента.

**Параметры:**
- `config.baseURL` - базовый URL для всех запросов
- `config.requestInterceptors` - массив интерсепторов

**Возвращает:** API клиент с методами:
- `createRequest<T>(config)` - создает реактивный запрос
- `interceptors.request.use(interceptor)` - добавляет интерсептор
- `invalidateCache(key)` - инвалидирует кэш по ключу
- `clearCache()` - очищает весь кэш

### `createRequest<TConfig extends RequestConfigData>(config?, initialConfig)`

Создает реактивный запрос с типизацией на основе конфигурации.

**Параметры:**
- `config` - конфигурация запроса с моделями типизации (RequestConfigData)
- `initialConfig` - базовая конфигурация запроса (RequestConfig)

**Возвращает:** ReactiveStore<InferResponse<TConfig>, Error, TConfig> с полями:
- `$state` - реактивное состояние типа FetchState<TData, TError>
- `request(params: RequestParams<TConfig>)` - выполнение типизированного запроса
- `cancel()` - отмена запроса
- `destroy()` - очистка ресурсов

Типы параметров запроса выводятся из `config`:
- `TData` = InferResponse<TConfig>
- `RequestParams<TConfig>` включает только доступные поля: urlParams, query, body, config

### `createRepository<TConfigs extends RequestConfigData[]>(configs, apiClient)`

Создает типизированный репозиторий методов API.

**Параметры:**
- `configs` - массив конфигураций эндпоинтов
- `apiClient` - экземпляр API клиента

**Возвращает:** репозиторий методов типа CreatorRepository<TConfigs>

### `createStoresForKeys<Configs, Repo, Keys, CustomStore>(repository, configs, createCustomStore)`

Создает несколько хранилищ (stores) для заданных ключей из репозитория с возможностью добавления кастомного хранилища.

**Параметры:**
- `repository` - репозиторий с фабричными функциями для создания хранилищ
- `configs` - массив ключей или объектов с именем и конфигурацией
- `createCustomStore` - функция для создания кастомного хранилища на основе созданных stores

**Возвращает:** объект, содержащий все созданные stores, кастомное хранилище и метод `destroyAll` для очистки ресурсов

### `createStoreWithRepo<Configs, Repo>(repository)`

Функция высшего порядка, возвращающая функцию для создания хранилищ с использованием заданного репозитория.

**Параметры:**
- `repository` - репозиторий с фабричными функциями

**Возвращает:** функцию, принимающую configs и createCustomStore, которая создает хранилища аналогично `createStoresForKeys`

## 🎨 Примеры использования

### Загрузка списка постов с пагинацией

```typescript
import { createApiClient, createRepository } from '@front-utils/request';
import Type from 'typebox';

const endpoints = [
  {
    name: 'getPosts',
    method: 'get' as const,
    path: '/posts',
    responseModel: Type.Array(Type.Object({
      id: Type.Number(),
      title: Type.String(),
      body: Type.String(),
      userId: Type.Number()
    }))
  }
] as const;

function PostsList() {
  const apiClient = createApiClient({ baseURL: 'https://jsonplaceholder.typicode.com' });
  const repo = createRepository(endpoints, apiClient);
  const postsStore = repo.getPosts({ config: { ttl: 2 * 60 * 1000 } }); // 2 минуты

  return (
    <div>
      {postsStore.data.value?.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.body}</p>
        </div>
      ))}
    </div>
  );
}
```

### Создание поста с обработкой ошибок

```typescript
function CreatePost() {
  const apiClient = createApiClient({ baseURL: 'https://jsonplaceholder.typicode.com' });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const createPostStore = apiClient.createRequest<Post>({
    url: '/posts',
    method: 'POST'
  });

  const handleSubmit = async () => {
    try {
      await createPostStore.request({
        body: { title, body, userId: 1 }
      });

      if (createPostStore.data.value) {
        console.log('Post created:', createPostStore.data.value);
      }
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Body"
      />
      <button onClick={handleSubmit}>
        Создать пост
      </button>
    </div>
  );
}
```

### Создание нескольких хранилищ с кастомным объединением

```typescript
import { createApiClient, createRepository, createStoresForKeys } from '@front-utils/request';
import Type from 'typebox';

const endpoints = [
  {
    name: 'getUser',
    method: 'get' as const,
    path: '/users/:id',
    paramsModel: Type.Object({ id: Type.Number() }),
    responseModel: Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String()
    })
  },
  {
    name: 'getPosts',
    method: 'get' as const,
    path: '/posts',
    queryModel: Type.Object({
      userId: Type.Optional(Type.Number())
    }),
    responseModel: Type.Array(Type.Object({
      id: Type.Number(),
      title: Type.String(),
      body: Type.String(),
      userId: Type.Number()
    }))
  }
] as const;

function UserDashboard({ userId }: { userId: number }) {
  const apiClient = createApiClient({ baseURL: 'https://jsonplaceholder.typicode.com' });
  const repository = createRepository(endpoints, apiClient);

  // Создаем несколько хранилищ с кастомным объединением
  const dashboardStore = createStoresForKeys(
    repository,
    [
      'getUser',
      'getPosts'
    ],
    (stores) => ({
      // Кастомное хранилище с объединенной логикой
      loadUserData: async () => {
        await stores.getUser.request({ urlParams: { id: userId } });
        await stores.getPosts.request({ query: { userId } });
      },
      get user() {
        return stores.getUser.state.value.type === 'success' ? stores.getUser.state.value.data : null;
      },
      get posts() {
        return stores.getPosts.state.value.type === 'success' ? stores.getPosts.state.value.data : [];
      },
      get isLoading() {
        return stores.getUser.state.value.type === 'loading' || stores.getPosts.state.value.type === 'loading';
      }
    })
  );

  React.useEffect(() => {
    dashboardStore.loadUserData();
  }, [userId]);

  if (dashboardStore.isLoading) return <div>Загрузка...</div>;

  return (
    <div>
      {dashboardStore.user && (
        <div>
          <h1>{dashboardStore.user.name}</h1>
          <p>{dashboardStore.user.email}</p>
        </div>
      )}
      <h2>Посты пользователя:</h2>
      {dashboardStore.posts.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.body}</p>
        </div>
      ))}
    </div>
  );
}
```

## 🔄 Миграция с других библиотек

### С Axios

```typescript
// Axios
const response = await axios.get('/users/1');

// Front-utils/request
const userStore = apiClient.createRequest<User>({
  url: '/users/1',
  method: 'GET'
});

const user = userStore.data.value;
```

### С React Query

```typescript
// React Query
const { data, isLoading, error } = useQuery({
  queryKey: ['users', 1],
  queryFn: () => fetch('/users/1').then(res => res.json())
});

// Front-utils/request
const userStore = apiClient.createRequest<User>({
  url: '/users/1',
  method: 'GET'
});

const data = userStore.data.value;
const isLoading = userStore.isLoading.value;
const error = userStore.error.value;
```
