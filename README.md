# 🚀 Front-utils/request

Современный HTTP-клиент для браузера с использованием нативного `fetch` API, реактивным состоянием и расширенными возможностями.

## ✨ Особенности

- 🔥 **Нативный fetch API** - использует встроенные возможности браузера
- ⚡ **Реактивное состояние** - интеграция с `@preact/signals` для реактивности
- 🎯 **Автоматическое кэширование** - встроенная система кэширования с TTL
- 🔄 **Дедупликация запросов** - предотвращает дублирующиеся запросы
- 🛡️ **Интерсепторы** - middleware для модификации запросов и ответов
- 🔁 **Автоматический retry** - с экспоненциальным бэкоффом
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
import { createApiClient } from '@front-utils/request';

// Создаем клиент с базовым URL
const apiClient = createApiClient({
  baseURL: 'https://jsonplaceholder.typicode.com'
});

// Создаем реактивный запрос
const userStore = apiClient.createRequest<User>({
  url: '/users/1',
  method: 'GET'
});

// Используем реактивные данные
effect(() => {
  if (userStore.data.value) {
    console.log('User loaded:', userStore.data.value);
  }

  if (userStore.isLoading.value) {
    console.log('Loading user...');
  }

  if (userStore.isError.value) {
    console.error('Error loading user:', userStore.error.value);
  }
});
```

### Использование с React

```tsx
import { createApiClient } from '@front-utils/request';
import { useSignals } from '@preact/signals-react';

function UserProfile({ userId }: { userId: number }) {
  // Создаем клиент
  const apiClient = createApiClient({
    baseURL: 'https://api.example.com'
  });

  // Создаем запрос
  const userStore = apiClient.createRequest<User>({
    url: `/users/${userId}`,
    method: 'GET'
  });

  return (
    <div>
      {userStore.isLoading.value && <div>Loading...</div>}
      {userStore.isError.value && <div>Error: {userStore.error.value.message}</div>}
      {userStore.data.value && (
        <div>
          <h1>{userStore.data.value.name}</h1>
          <p>{userStore.data.value.email}</p>
        </div>
      )}
      <button onClick={() => userStore.refetch()}>
        Обновить
      </button>
    </div>
  );
}
```

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

### Конфигурация запроса

```typescript
const store = apiClient.createRequest<User>({
  url: '/users/1',
  method: 'GET',

  // Кэширование
  ttl: 5 * 60 * 1000, // 5 минут
  cacheKey: 'user-profile', // Кастомный ключ кэша

  // Retry логика
  retries: 3,
  retryDelay: 1000,
  retryOn: (error) => error instanceof NetworkError,

  // Валидация
  validate: {
    response: true,
    onValidationError: (error) => console.error('Validation error:', error)
  },

  // Кастомные статусы для empty state
  emptyStatusCodes: [204, 205]
});
```

## 🎯 Репозиторий паттерн

### Создание репозитория

```typescript
import { createRepository } from '@front-utils/request';
import Type from 'typebox';

// Определяем схемы для API
const requestConfigs = [
  {
    name: 'getUser',
    method: 'get' as const,
    path: '/users/:id',
    queryModel: Type.Object({
      fields: Type.String()
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
];

// Создаем репозиторий
const userRepository = createRepository(requestConfigs, apiClient);

// Используем типизированные методы
const userStore = userRepository.getUser({});

// Выполняем запрос с параметрами
await userStore.request({
  urlParams: { id: 123 },
  query: { fields: 'id,name,email' }
});

// Доступ к реактивным данным
effect(() => {
  if (userStore.state.value.type === 'success') {
    console.log('User:', userStore.state.value.data);
  }
});

// Повторный запрос
await userStore.refetch();

// Создание пользователя
const newUserStore = userRepository.createUser({});

await newUserStore.request({
  body: { name: 'John Doe', email: 'john@example.com' }
});
```




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

### `createRequest<T>(config)`

Создает реактивный запрос.

**Параметры:**
- `url` - URL запроса
- `method` - HTTP метод
- `ttl` - время жизни кэша в миллисекундах
- `retries` - количество попыток повторных запросов
- `cacheKey` - кастомный ключ кэша

**Возвращает:** Реактивный store с полями:
- `data` - реактивные данные
- `isLoading` - состояние загрузки
- `isError` - состояние ошибки
- `error` - объект ошибки
- `refetch()` - повторный запрос
- `cancel()` - отмена запроса
- `destroy()` - очистка ресурсов

## 🎨 Примеры использования

### Загрузка списка постов с пагинацией

```typescript
function PostsList() {
  const apiClient = createApiClient({ baseURL: 'https://jsonplaceholder.typicode.com' });

  const postsStore = apiClient.createRequest<Post[]>({
    url: '/posts',
    method: 'GET',
    ttl: 2 * 60 * 1000 // 2 минуты
  });

  return (
    <div>
      <button onClick={() => postsStore.refetch()}>
        Обновить посты
      </button>

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
    method: 'POST',
    retries: 2
  });

  const handleSubmit = async () => {
    try {
      await createPostStore.refetch({
        body: JSON.stringify({ title, body, userId: 1 }),
        headers: { 'Content-Type': 'application/json' }
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





## 🤝 Вклад в проект

Мы приветствуем вклад в развитие библиотеки! Пожалуйста, ознакомьтесь с [Contributing Guide](CONTRIBUTING.md) перед началом работы.

## 📄 Лицензия

ISC License - см. [LICENSE](LICENSE) файл для подробностей.

## 🆘 Поддержка

- 📚 [Документация](./docs)
- 💬 [Чат сообщества](https://discord.gg/example)
- 🐛 [Issues](https://github.com/front-util/request/issues)
- 📧 [Email поддержки](mailto:support@example.com)

---

**Создано с ❤️ командой Front-utils**
